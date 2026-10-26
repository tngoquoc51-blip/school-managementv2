<?php

namespace App\Support;

use PDO;

/**
 * Đợt thu / Kỳ thu học phí (API /api/kt/*).
 *
 * Một "đợt thu" = tập hợp các khoản thu áp dụng cho một phạm vi học sinh (toàn trường hoặc một khối)
 * trong một học kỳ, có ngày mở và hạn nộp. Khi phát hành, hệ thống tự tạo hóa đơn cho từng học sinh
 * (trừ miễn giảm đã duyệt) – hóa đơn đó xuất hiện ngay ở cổng học sinh (/student/fees).
 *
 * Dùng PDO + SQL chuẩn nên chạy giống nhau trên MySQL/MariaDB và SQLite (kiểm thử).
 */
class FeePeriodRepo
{
    public const ROLES = [
        'accountant' => 'Kế toán',
        'principal' => 'Hiệu trưởng',
        'vice_principal' => 'Phó hiệu trưởng',
        'super_admin' => 'Quản trị hệ thống',
    ];
    /** Vai trò được hủy một đợt thu đã phát hành (kiểm soát hai lớp) */
    public const CAN_CANCEL = ['principal', 'vice_principal', 'super_admin'];
    public const TERMS = ['YEAR' => 'Đầu năm học', 'HK1' => 'Học kỳ 1', 'HK2' => 'Học kỳ 2'];
    public const STATUS = ['draft' => 'Bản nháp', 'open' => 'Đang thu', 'closed' => 'Đã kết thúc', 'cancelled' => 'Đã hủy'];
    public const TOKEN_HOURS = 12;
    public const MAX_FAILS = 5;
    public const LOCK_MINUTES = 10;
    public const MAX_AMOUNT = 100000000;

    /** @var callable */
    private $clock;

    public function __construct(private PDO $pdo, ?callable $clock = null)
    {
        $this->clock = $clock ?? fn () => time();
    }

    /* ================================================================== tiện ích */

    private function now(): int
    {
        return (int) ($this->clock)();
    }

    private function ts(?int $t = null): string
    {
        return date('Y-m-d H:i:s', $t ?? $this->now());
    }

    private function today(): string
    {
        return date('Y-m-d', $this->now());
    }

    /** @return array<int,array<string,mixed>> */
    private function all(string $sql, array $p = []): array
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($p);
        return $st->fetchAll(PDO::FETCH_ASSOC);
    }

    /** @return array<string,mixed>|null */
    private function one(string $sql, array $p = []): ?array
    {
        return $this->all($sql, $p)[0] ?? null;
    }

    private function run(string $sql, array $p = []): int
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($p);
        return $st->rowCount();
    }

    private static function validDate(?string $d): bool
    {
        return is_string($d) && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
    }

    private static function fail(string $msg, int $status = 422, array $extra = []): array
    {
        return ['ok' => false, 'status' => $status, 'message' => $msg] + $extra;
    }

    private function log(int $periodId, string $action, string $detail, string $actor): void
    {
        $this->run('INSERT INTO sm_fee_period_log (period_id, action, detail, actor, created_at) VALUES (?, ?, ?, ?, ?)',
            [$periodId, $action, mb_substr($detail, 0, 500), $actor, $this->ts()]);
    }

    /* ================================================================== đăng nhập nhân viên kế toán */

    /** @return array<string,mixed> */
    public function login(string $username, string $password): array
    {
        $username = strtolower(trim($username));
        if (str_contains($username, '@')) {
            $username = strstr($username, '@', true); // cho phép nhập email nội bộ, ví dụ ketoan@thpt.edu.vn → ketoan
        }
        $a = $this->one('SELECT id, username, full_name, role, password_hash, status, failed_attempts, locked_until FROM sm_staff_accounts WHERE LOWER(username) = ?', [$username]);
        if (!$a) {
            password_verify($password, '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG');
            return self::fail('Sai tên đăng nhập hoặc mật khẩu.', 401);
        }
        if ($a['status'] !== 'active') {
            return self::fail('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.', 403);
        }
        $now = $this->now();
        if (!empty($a['locked_until']) && strtotime($a['locked_until']) > $now) {
            $m = (int) ceil((strtotime($a['locked_until']) - $now) / 60);
            return self::fail("Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau {$m} phút.", 423);
        }
        if (!password_verify($password, $a['password_hash'])) {
            $f = (int) $a['failed_attempts'] + 1;
            if ($f >= self::MAX_FAILS) {
                $this->run('UPDATE sm_staff_accounts SET failed_attempts = 0, locked_until = ? WHERE id = ?', [$this->ts($now + self::LOCK_MINUTES * 60), $a['id']]);
                return self::fail('Đăng nhập sai quá nhiều lần. Tài khoản tạm khóa ' . self::LOCK_MINUTES . ' phút.', 423);
            }
            $this->run('UPDATE sm_staff_accounts SET failed_attempts = ? WHERE id = ?', [$f, $a['id']]);
            return self::fail('Sai tên đăng nhập hoặc mật khẩu.', 401);
        }
        if (!isset(self::ROLES[$a['role']])) {
            return self::fail('Tài khoản này không có quyền vào khu Kế toán.', 403);
        }
        $this->run('UPDATE sm_staff_accounts SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?', [$this->ts($now), $a['id']]);
        $this->run('DELETE FROM sm_staff_tokens WHERE staff_id = ? AND expires_at < ?', [$a['id'], $this->ts($now)]);
        $raw = bin2hex(random_bytes(32));
        $exp = $this->ts($now + self::TOKEN_HOURS * 3600);
        $this->run('INSERT INTO sm_staff_tokens (staff_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)', [$a['id'], hash('sha256', $raw), $exp, $this->ts($now)]);
        return ['ok' => true, 'status' => 200, 'token' => $raw, 'expires_at' => $exp, 'staff' => $this->staffView($a)];
    }

    /** @param array<string,mixed> $a */
    private function staffView(array $a): array
    {
        return ['id' => (int) $a['id'], 'username' => $a['username'], 'name' => $a['full_name'], 'role' => $a['role'], 'role_label' => self::ROLES[$a['role']] ?? $a['role'],
            'can_cancel' => in_array($a['role'], self::CAN_CANCEL, true)];
    }

    /** @return array<string,mixed>|null */
    public function authenticate(?string $bearer): ?array
    {
        if (!$bearer) {
            return null;
        }
        $a = $this->one('SELECT a.id, a.username, a.full_name, a.role FROM sm_staff_tokens t JOIN sm_staff_accounts a ON a.id = t.staff_id
                          WHERE t.token_hash = ? AND t.expires_at > ? AND a.status = ?', [hash('sha256', $bearer), $this->ts(), 'active']);
        return $a && isset(self::ROLES[$a['role']]) ? $this->staffView($a) : null;
    }

    public function logout(string $bearer): void
    {
        $this->run('DELETE FROM sm_staff_tokens WHERE token_hash = ?', [hash('sha256', $bearer)]);
    }

    /* ================================================================== số liệu hóa đơn của đợt */

    /**
     * Mỗi hóa đơn một dòng, kèm đã thu / đang chờ xác nhận và lớp của học sinh trong năm học đó.
     *
     * @return array<int,array<string,mixed>>
     */
    private function invoiceRows(string $where, array $p): array
    {
        $rows = $this->all(
            "SELECT i.id, i.code, i.period_id, i.student_id, i.total, i.due_date, i.status AS inv_status,
                    s.code AS scode, s.full_name, c.id AS class_id, c.name AS class_name, c.grade,
                    COALESCE(SUM(CASE WHEN p.status = 'confirmed' THEN p.amount ELSE 0 END), 0) AS paid,
                    COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0) AS pend
               FROM sm_invoices i
               JOIN sm_students s ON s.id = i.student_id
          LEFT JOIN sm_enrollments e ON e.student_id = i.student_id AND e.school_year_id = i.school_year_id
          LEFT JOIN sm_classes c ON c.id = e.class_id
          LEFT JOIN sm_payments p ON p.invoice_id = i.id
              WHERE $where
           GROUP BY i.id, i.code, i.period_id, i.student_id, i.total, i.due_date, i.status, s.code, s.full_name, c.id, c.name, c.grade", $p);
        $today = $this->today();
        $out = [];
        foreach ($rows as $r) {
            $total = (int) $r['total'];
            $paid = (int) $r['paid'];
            $remaining = max(0, $total - $paid);
            if ($r['inv_status'] === 'cancelled') {
                $st = 'cancelled';
            } elseif ($remaining <= 0) {
                $st = 'paid';
            } elseif ($paid > 0) {
                $st = 'partial';
            } else {
                $st = 'unpaid';
            }
            $due = substr((string) $r['due_date'], 0, 10);
            $out[] = [
                'id' => (int) $r['id'], 'code' => $r['code'], 'period_id' => (int) $r['period_id'], 'student_id' => (int) $r['student_id'],
                'student_code' => $r['scode'], 'student_name' => $r['full_name'],
                'class_id' => $r['class_id'] !== null ? (int) $r['class_id'] : null, 'class_name' => $r['class_name'], 'grade' => $r['grade'] !== null ? (int) $r['grade'] : null,
                'total' => $total, 'paid' => $paid, 'pending' => (int) $r['pend'], 'remaining' => $remaining,
                'status' => $st, 'overdue' => in_array($st, ['unpaid', 'partial'], true) && $due < $today,
                'due_date' => $due, 'days_overdue' => in_array($st, ['unpaid', 'partial'], true) && $due < $today ? (int) floor((strtotime($today) - strtotime($due)) / 86400) : 0,
            ];
        }
        return $out;
    }

    /**
     * @param array<int,array<string,mixed>> $rows
     * @return array<string,mixed>
     */
    private static function stats(array $rows): array
    {
        $s = ['invoices' => 0, 'students' => 0, 'billed' => 0, 'paid' => 0, 'pending' => 0, 'remaining' => 0,
            'paid_count' => 0, 'partial_count' => 0, 'unpaid_count' => 0, 'overdue_count' => 0, 'overdue_amount' => 0, 'cancelled_count' => 0, 'rate' => 0.0];
        $stu = [];
        foreach ($rows as $r) {
            if ($r['status'] === 'cancelled') {
                $s['cancelled_count']++;
                continue;
            }
            $s['invoices']++;
            $stu[$r['student_id']] = 1;
            $s['billed'] += $r['total'];
            $s['paid'] += min($r['paid'], $r['total']);
            $s['pending'] += $r['pending'];
            $s['remaining'] += $r['remaining'];
            $s[$r['status'] . '_count']++;
            if ($r['overdue']) {
                $s['overdue_count']++;
                $s['overdue_amount'] += $r['remaining'];
            }
        }
        $s['students'] = count($stu);
        $s['rate'] = $s['billed'] > 0 ? round($s['paid'] / $s['billed'] * 100, 1) : 0.0;
        return $s;
    }

    /* ================================================================== danh mục dùng cho form */

    /** @return array<string,mixed> */
    public function meta(): array
    {
        $years = array_map(fn ($y) => ['id' => (int) $y['id'], 'label' => $y['label'], 'is_current' => (int) $y['is_current'] === 1],
            $this->all('SELECT id, label, is_current FROM sm_school_years ORDER BY start_date DESC'));
        $items = array_map(fn ($i) => [
            'id' => (int) $i['id'], 'code' => $i['code'], 'name' => $i['name'], 'category' => $i['category'], 'amount' => (int) $i['amount'],
            'unit' => $i['unit'], 'grade' => $i['grade'] !== null ? (int) $i['grade'] : null, 'mandatory' => (int) $i['is_mandatory'] === 1, 'note' => $i['note'],
        ], $this->all('SELECT id, code, name, category, amount, unit, grade, is_mandatory, note FROM sm_fee_items ORDER BY category, id'));
        $cnt = [];
        foreach ($this->all('SELECT e.school_year_id AS y, c.grade, COUNT(*) AS n FROM sm_enrollments e JOIN sm_classes c ON c.id = e.class_id GROUP BY e.school_year_id, c.grade') as $r) {
            $cnt[(int) $r['y']][(int) $r['grade']] = (int) $r['n'];
        }
        return [
            'years' => $years, 'terms' => self::TERMS, 'statuses' => self::STATUS, 'items' => $items, 'student_counts' => $cnt,
            'categories' => FeeRepo::CATEGORIES, 'today' => $this->today(),
        ];
    }

    /* ================================================================== danh sách đợt thu */

    /**
     * @param array<string,mixed> $f year, term, status, q
     * @return array<string,mixed>
     */
    public function index(array $f): array
    {
        $w = ['1 = 1'];
        $p = [];
        if (!empty($f['year'])) {
            $w[] = 'p.school_year_id = ?';
            $p[] = (int) $f['year'];
        }
        if (!empty($f['term']) && isset(self::TERMS[$f['term']])) {
            $w[] = 'p.term = ?';
            $p[] = $f['term'];
        }
        if (!empty($f['q'])) {
            $w[] = '(p.name LIKE ? OR p.code LIKE ?)';
            $p[] = '%' . trim((string) $f['q']) . '%';
            $p[] = '%' . trim((string) $f['q']) . '%';
        }
        $periods = $this->all("SELECT p.*, y.label AS year_label, y.is_current FROM sm_fee_periods p JOIN sm_school_years y ON y.id = p.school_year_id
                                WHERE " . implode(' AND ', $w) . ' ORDER BY y.start_date DESC, p.open_date DESC, p.id DESC', $p);

        $byPeriod = [];
        if ($periods) {
            foreach ($this->invoiceRows('i.period_id IS NOT NULL', []) as $r) {
                $byPeriod[$r['period_id']][] = $r;
            }
        }
        $today = $this->today();
        $items = [];
        $counts = ['all' => 0, 'draft' => 0, 'open' => 0, 'overdue' => 0, 'closed' => 0, 'cancelled' => 0];
        foreach ($periods as $per) {
            $v = $this->periodView($per, self::stats($byPeriod[(int) $per['id']] ?? []), $today);
            $counts['all']++;
            $counts[$v['status']]++;
            if ($v['phase'] === 'overdue') {
                $counts['overdue']++;
            }
            $items[] = $v;
        }
        // lọc theo trạng thái sau khi tính (vì "quá hạn" là trạng thái suy ra)
        $status = (string) ($f['status'] ?? '');
        if ($status !== '') {
            $items = array_values(array_filter($items, fn ($x) => $status === 'overdue' ? $x['phase'] === 'overdue' : $x['status'] === $status));
        }

        $open = array_filter($items, fn ($x) => $x['status'] === 'open');
        $sum = ['billed' => 0, 'paid' => 0, 'remaining' => 0, 'pending' => 0, 'overdue_amount' => 0];
        foreach ($open as $x) {
            foreach ($sum as $k => $_) {
                $sum[$k] += $x['stats'][$k];
            }
        }
        $sum['rate'] = $sum['billed'] > 0 ? round($sum['paid'] / $sum['billed'] * 100, 1) : 0.0;
        $sum['open_count'] = count($open);
        return ['items' => $items, 'counts' => $counts, 'summary' => $sum];
    }

    /**
     * @param array<string,mixed> $per
     * @param array<string,mixed> $stats
     * @return array<string,mixed>
     */
    private function periodView(array $per, array $stats, string $today): array
    {
        $due = substr((string) $per['due_date'], 0, 10);
        $phase = $per['status'];
        $daysLeft = (int) floor((strtotime($due) - strtotime($today)) / 86400);
        if ($per['status'] === 'open') {
            $phase = $daysLeft < 0 && $stats['remaining'] > 0 ? 'overdue' : ($daysLeft <= 7 && $stats['remaining'] > 0 ? 'due_soon' : 'open');
        }
        return [
            'id' => (int) $per['id'], 'code' => $per['code'], 'name' => $per['name'],
            'school_year_id' => (int) $per['school_year_id'], 'year_label' => $per['year_label'] ?? null,
            'term' => $per['term'], 'term_label' => self::TERMS[$per['term']] ?? $per['term'],
            'grade' => $per['grade'] !== null ? (int) $per['grade'] : null, 'scope_label' => $per['grade'] !== null ? 'Khối ' . $per['grade'] : 'Toàn trường',
            'open_date' => substr((string) $per['open_date'], 0, 10), 'due_date' => $due, 'days_left' => $daysLeft,
            'status' => $per['status'], 'status_label' => self::STATUS[$per['status']] ?? $per['status'], 'phase' => $phase,
            'note' => $per['note'], 'created_by' => $per['created_by'], 'created_at' => $per['created_at'], 'issued_at' => $per['issued_at'], 'closed_at' => $per['closed_at'],
            'stats' => $stats,
        ];
    }

    /* ================================================================== chi tiết một đợt */

    /** @return array<string,mixed>|null */
    private function periodRow(int $id): ?array
    {
        return $this->one('SELECT p.*, y.label AS year_label, y.is_current FROM sm_fee_periods p JOIN sm_school_years y ON y.id = p.school_year_id WHERE p.id = ?', [$id]);
    }

    /** @return array<int,array<string,mixed>> */
    private function periodItems(int $id): array
    {
        return array_map(fn ($i) => [
            'fee_item_id' => (int) $i['fee_item_id'], 'code' => $i['code'], 'name' => $i['name'], 'category' => $i['category'],
            'amount' => (int) $i['amount'], 'default_amount' => (int) $i['default_amount'], 'unit' => $i['unit'],
            'grade' => $i['grade'] !== null ? (int) $i['grade'] : null, 'mandatory' => (int) $i['is_mandatory'] === 1,
        ], $this->all('SELECT pi.fee_item_id, pi.amount, f.code, f.name, f.category, f.amount AS default_amount, f.unit, f.grade, f.is_mandatory
                         FROM sm_fee_period_items pi JOIN sm_fee_items f ON f.id = pi.fee_item_id WHERE pi.period_id = ? ORDER BY f.category, f.id', [$id]));
    }

    /** @return array<string,mixed>|null */
    public function show(int $id, array $staff): ?array
    {
        $per = $this->periodRow($id);
        if (!$per) {
            return null;
        }
        $rows = $this->invoiceRows('i.period_id = ?', [$id]);
        $stats = self::stats($rows);
        $view = $this->periodView($per, $stats, $this->today());

        $grade = [];
        $class = [];
        foreach ($rows as $r) {
            if ($r['status'] === 'cancelled') {
                continue;
            }
            foreach ([['g', $r['grade'], $grade, 'Khối ' . $r['grade']], ['c', $r['class_id'], $class, $r['class_name']]] as [$k, $key, , $label]) {
                if ($key === null) {
                    continue;
                }
                if ($k === 'g') {
                    $grade[$key] ??= ['key' => $key, 'label' => $label, 'invoices' => 0, 'billed' => 0, 'paid' => 0, 'remaining' => 0];
                    $t = &$grade[$key];
                } else {
                    $class[$key] ??= ['key' => $key, 'label' => $label, 'grade' => $r['grade'], 'invoices' => 0, 'billed' => 0, 'paid' => 0, 'remaining' => 0, 'paid_count' => 0];
                    $t = &$class[$key];
                }
                $t['invoices']++;
                $t['billed'] += $r['total'];
                $t['paid'] += min($r['paid'], $r['total']);
                $t['remaining'] += $r['remaining'];
                if ($k === 'c' && $r['status'] === 'paid') {
                    $t['paid_count']++;
                }
                unset($t);
            }
        }
        ksort($grade);
        $class = array_values($class);
        usort($class, fn ($a, $b) => [$a['grade'], $a['label']] <=> [$b['grade'], $b['label']]);
        $rate = fn (array $x) => $x['billed'] > 0 ? round($x['paid'] / $x['billed'] * 100, 1) : 0.0;
        $grade = array_map(fn ($x) => $x + ['rate' => $rate($x)], array_values($grade));
        $class = array_map(fn ($x) => $x + ['rate' => $rate($x)], $class);

        $daily = array_map(fn ($d) => ['date' => $d['d'], 'count' => (int) $d['n'], 'amount' => (int) $d['a']],
            $this->all("SELECT substr(p.paid_at, 1, 10) AS d, COUNT(*) AS n, SUM(p.amount) AS a FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id
                         WHERE i.period_id = ? AND p.status = 'confirmed' AND i.status = 'issued' GROUP BY substr(p.paid_at, 1, 10) ORDER BY d", [$id]));
        $daily = array_slice($daily, -30);
        $methods = array_map(fn ($m) => ['method' => $m['method'], 'label' => FeeRepo::METHODS[$m['method']] ?? $m['method'], 'count' => (int) $m['n'], 'amount' => (int) $m['a']],
            $this->all("SELECT p.method, COUNT(*) AS n, SUM(p.amount) AS a FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id
                         WHERE i.period_id = ? AND p.status = 'confirmed' AND i.status = 'issued' GROUP BY p.method ORDER BY a DESC", [$id]));
        $log = $this->all('SELECT id, action, detail, actor, created_at FROM sm_fee_period_log WHERE period_id = ? ORDER BY id DESC LIMIT 40', [$id]);

        $st = $per['status'];
        $role = $staff['role'] ?? '';
        $actions = [
            'edit' => $st === 'draft',
            'issue' => in_array($st, ['draft', 'open'], true),
            'extend' => $st === 'open',
            'close' => $st === 'open',
            'reopen' => $st === 'closed',
            'cancel' => ($st === 'draft') || ($st === 'open' && in_array($role, self::CAN_CANCEL, true)),
        ];
        return $view + [
            'items' => $this->periodItems($id),
            'by_grade' => $grade, 'by_class' => $class, 'daily' => $daily, 'methods' => $methods, 'log' => $log, 'actions' => $actions,
            'pending_payments' => (int) ($this->one("SELECT COUNT(*) AS n FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id WHERE i.period_id = ? AND p.status = 'pending'", [$id])['n'] ?? 0),
            'open_disputes' => (int) ($this->one("SELECT COUNT(*) AS n FROM sm_invoice_disputes d JOIN sm_invoices i ON i.id = d.invoice_id WHERE i.period_id = ? AND d.status = 'open'", [$id])['n'] ?? 0),
            'waivers' => $this->waiverSummary($id),
        ];
    }

    /** @return array<string,mixed> số hóa đơn đã được giảm và tổng tiền giảm */
    private function waiverSummary(int $id): array
    {
        $r = $this->one("SELECT COUNT(*) AS n, COALESCE(SUM(discount), 0) AS d FROM sm_invoices WHERE period_id = ? AND status = 'issued' AND discount > 0", [$id]);
        return ['invoices' => (int) ($r['n'] ?? 0), 'amount' => (int) ($r['d'] ?? 0)];
    }

    /**
     * Danh sách hóa đơn thuộc đợt thu.
     *
     * @param array<string,mixed> $f q, status, class_id, page, per, sort
     * @return array<string,mixed>
     */
    public function invoices(int $id, array $f): ?array
    {
        if (!$this->periodRow($id)) {
            return null;
        }
        $rows = $this->invoiceRows('i.period_id = ?', [$id]);
        $counts = ['all' => 0, 'paid' => 0, 'partial' => 0, 'unpaid' => 0, 'overdue' => 0, 'cancelled' => 0, 'pending' => 0];
        foreach ($rows as $r) {
            $counts['all']++;
            $counts[$r['status']]++;
            if ($r['overdue']) {
                $counts['overdue']++;
            }
            if ($r['pending'] > 0) {
                $counts['pending']++;
            }
        }
        $q = mb_strtolower(trim((string) ($f['q'] ?? '')));
        $status = (string) ($f['status'] ?? '');
        $classId = (int) ($f['class_id'] ?? 0);
        $rows = array_values(array_filter($rows, function ($r) use ($q, $status, $classId) {
            if ($status === 'overdue' && !$r['overdue']) {
                return false;
            }
            if ($status === 'pending' && $r['pending'] <= 0) {
                return false;
            }
            if (in_array($status, ['paid', 'partial', 'unpaid', 'cancelled'], true) && $r['status'] !== $status) {
                return false;
            }
            if ($classId && $r['class_id'] !== $classId) {
                return false;
            }
            return $q === '' || str_contains(mb_strtolower($r['student_name'] . ' ' . $r['student_code'] . ' ' . $r['code']), $q);
        }));
        $sort = (string) ($f['sort'] ?? 'class');
        usort($rows, fn ($a, $b) => $sort === 'remaining'
            ? [$b['remaining'], $a['student_code']] <=> [$a['remaining'], $b['student_code']]
            : [(string) $a['class_name'], $a['student_code']] <=> [(string) $b['class_name'], $b['student_code']]);

        $per = min(100, max(5, (int) ($f['per'] ?? 20)));
        $page = max(1, (int) ($f['page'] ?? 1));
        $total = count($rows);
        $pages = max(1, (int) ceil($total / $per));
        $page = min($page, $pages);
        return ['items' => array_slice($rows, ($page - 1) * $per, $per), 'total' => $total, 'page' => $page, 'pages' => $pages, 'counts' => $counts,
            'classes' => $this->classesOf($id)];
    }

    /** @return array<int,array<string,mixed>> */
    private function classesOf(int $id): array
    {
        return array_map(fn ($c) => ['id' => (int) $c['id'], 'name' => $c['name'], 'grade' => (int) $c['grade']],
            $this->all('SELECT DISTINCT c.id, c.name, c.grade FROM sm_invoices i
                          JOIN sm_enrollments e ON e.student_id = i.student_id AND e.school_year_id = i.school_year_id
                          JOIN sm_classes c ON c.id = e.class_id WHERE i.period_id = ? ORDER BY c.grade, c.name', [$id]));
    }

    /** Danh sách học sinh còn nợ để xuất file / in. @return array<string,mixed>|null */
    public function debtors(int $id): ?array
    {
        $per = $this->periodRow($id);
        if (!$per) {
            return null;
        }
        $rows = array_values(array_filter($this->invoiceRows('i.period_id = ?', [$id]), fn ($r) => in_array($r['status'], ['unpaid', 'partial'], true)));
        usort($rows, fn ($a, $b) => [(string) $a['class_name'], $a['student_code']] <=> [(string) $b['class_name'], $b['student_code']]);
        return ['period' => ['code' => $per['code'], 'name' => $per['name'], 'due_date' => substr((string) $per['due_date'], 0, 10)], 'items' => $rows, 'generated_at' => $this->ts()];
    }

    /* ================================================================== tạo / sửa đợt (bản nháp) */

    /**
     * Kiểm tra dữ liệu form. @return array{ok:bool,errors?:array<string,string>,data?:array<string,mixed>}
     */
    private function validate(array $in): array
    {
        $e = [];
        $name = trim((string) ($in['name'] ?? ''));
        if (mb_strlen($name) < 5 || mb_strlen($name) > 160) {
            $e['name'] = 'Tên đợt thu từ 5 đến 160 ký tự.';
        }
        $year = (int) ($in['school_year_id'] ?? 0);
        if (!$year || !$this->one('SELECT id FROM sm_school_years WHERE id = ?', [$year])) {
            $e['school_year_id'] = 'Vui lòng chọn năm học.';
        }
        $term = (string) ($in['term'] ?? '');
        if (!isset(self::TERMS[$term])) {
            $e['term'] = 'Vui lòng chọn học kỳ.';
        }
        $grade = $in['grade'] ?? null;
        $grade = ($grade === null || $grade === '' || $grade === 'all') ? null : (int) $grade;
        if ($grade !== null && !in_array($grade, [10, 11, 12], true)) {
            $e['grade'] = 'Khối chỉ gồm 10, 11, 12 hoặc toàn trường.';
        }
        $open = (string) ($in['open_date'] ?? '');
        $due = (string) ($in['due_date'] ?? '');
        if (!self::validDate($open)) {
            $e['open_date'] = 'Ngày mở không hợp lệ.';
        }
        if (!self::validDate($due)) {
            $e['due_date'] = 'Hạn nộp không hợp lệ.';
        } elseif (self::validDate($open) && $due < $open) {
            $e['due_date'] = 'Hạn nộp phải sau hoặc bằng ngày mở.';
        }
        $note = trim((string) ($in['note'] ?? ''));
        if (mb_strlen($note) > 255) {
            $e['note'] = 'Ghi chú tối đa 255 ký tự.';
        }
        $items = [];
        $seen = [];
        foreach ((array) ($in['items'] ?? []) as $it) {
            $fid = (int) ($it['fee_item_id'] ?? 0);
            $amount = $it['amount'] ?? null;
            if (!$fid || isset($seen[$fid])) {
                continue;
            }
            $seen[$fid] = 1;
            $fee = $this->one('SELECT id, name, is_mandatory FROM sm_fee_items WHERE id = ?', [$fid]);
            if (!$fee) {
                $e['items'] = 'Có khoản thu không tồn tại trong danh mục.';
                continue;
            }
            if ((int) $fee['is_mandatory'] !== 1) {
                $e['items'] = 'Khoản "' . $fee['name'] . '" là tự nguyện, không thể thu tự động cho cả đợt.';
                continue;
            }
            if (!is_numeric($amount) || (int) $amount < 0 || (int) $amount > self::MAX_AMOUNT) {
                $e['items'] = 'Số tiền của khoản "' . $fee['name'] . '" phải từ 0 đến ' . number_format(self::MAX_AMOUNT, 0, ',', '.') . 'đ.';
                continue;
            }
            $items[] = ['fee_item_id' => $fid, 'amount' => (int) $amount];
        }
        if (!$items && !isset($e['items'])) {
            $e['items'] = 'Vui lòng chọn ít nhất một khoản thu.';
        }
        if ($e) {
            return ['ok' => false, 'errors' => $e];
        }
        return ['ok' => true, 'data' => ['name' => $name, 'school_year_id' => $year, 'term' => $term, 'grade' => $grade, 'open_date' => $open, 'due_date' => $due, 'note' => $note, 'items' => $items]];
    }

    private function newCode(int $yearId, string $term, ?int $grade): string
    {
        $y = (string) ($this->one('SELECT label FROM sm_school_years WHERE id = ?', [$yearId])['label'] ?? '');
        $base = 'DT' . substr($y, 2, 2) . substr($y, -2) . '-' . $term . ($grade ? "-K$grade" : '');
        $code = $base;
        for ($n = 2; $this->one('SELECT id FROM sm_fee_periods WHERE code = ?', [$code]); $n++) {
            $code = "$base-$n";
        }
        return $code;
    }

    /** @return array<string,mixed> */
    public function create(array $in, array $staff): array
    {
        $v = $this->validate($in);
        if (!$v['ok']) {
            return self::fail('Thông tin chưa hợp lệ, vui lòng kiểm tra lại.', 422, ['errors' => $v['errors']]);
        }
        $d = $v['data'];
        $this->pdo->beginTransaction();
        try {
            $this->run('INSERT INTO sm_fee_periods (code, name, school_year_id, term, grade, open_date, due_date, status, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$this->newCode($d['school_year_id'], $d['term'], $d['grade']), $d['name'], $d['school_year_id'], $d['term'], $d['grade'], $d['open_date'], $d['due_date'], 'draft', $d['note'] ?: null, $staff['name'], $this->ts()]);
            $id = (int) $this->pdo->lastInsertId();
            foreach ($d['items'] as $it) {
                $this->run('INSERT INTO sm_fee_period_items (period_id, fee_item_id, amount) VALUES (?, ?, ?)', [$id, $it['fee_item_id'], $it['amount']]);
            }
            $this->log($id, 'create', 'Tạo bản nháp với ' . count($d['items']) . ' khoản thu', $staff['name']);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
        return ['ok' => true, 'status' => 200, 'message' => 'Đã lưu bản nháp đợt thu.', 'id' => $id];
    }

    /** Chỉ sửa được bản nháp. @return array<string,mixed> */
    public function update(int $id, array $in, array $staff): array
    {
        $per = $this->periodRow($id);
        if (!$per) {
            return self::fail('Không tìm thấy đợt thu.', 404);
        }
        if ($per['status'] !== 'draft') {
            return self::fail('Chỉ sửa được đợt thu ở trạng thái bản nháp. Với đợt đã phát hành, hãy dùng "Gia hạn" hoặc "Đóng đợt".');
        }
        $v = $this->validate($in);
        if (!$v['ok']) {
            return self::fail('Thông tin chưa hợp lệ, vui lòng kiểm tra lại.', 422, ['errors' => $v['errors']]);
        }
        $d = $v['data'];
        $this->pdo->beginTransaction();
        try {
            $this->run('UPDATE sm_fee_periods SET name = ?, school_year_id = ?, term = ?, grade = ?, open_date = ?, due_date = ?, note = ? WHERE id = ?',
                [$d['name'], $d['school_year_id'], $d['term'], $d['grade'], $d['open_date'], $d['due_date'], $d['note'] ?: null, $id]);
            $this->run('DELETE FROM sm_fee_period_items WHERE period_id = ?', [$id]);
            foreach ($d['items'] as $it) {
                $this->run('INSERT INTO sm_fee_period_items (period_id, fee_item_id, amount) VALUES (?, ?, ?)', [$id, $it['fee_item_id'], $it['amount']]);
            }
            $this->log($id, 'update', 'Cập nhật bản nháp (' . count($d['items']) . ' khoản thu)', $staff['name']);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
        return ['ok' => true, 'status' => 200, 'message' => 'Đã cập nhật bản nháp.', 'id' => $id];
    }

    /** Dữ liệu để đổ vào form sửa bản nháp. @return array<string,mixed>|null */
    public function editData(int $id): ?array
    {
        $per = $this->periodRow($id);
        if (!$per) {
            return null;
        }
        return [
            'id' => (int) $per['id'], 'status' => $per['status'], 'name' => $per['name'], 'school_year_id' => (int) $per['school_year_id'], 'term' => $per['term'],
            'grade' => $per['grade'] !== null ? (int) $per['grade'] : null, 'open_date' => substr((string) $per['open_date'], 0, 10),
            'due_date' => substr((string) $per['due_date'], 0, 10), 'note' => $per['note'] ?? '',
            'items' => array_map(fn ($i) => ['fee_item_id' => $i['fee_item_id'], 'amount' => $i['amount']], $this->periodItems($id)),
        ];
    }

    /* ================================================================== lập kế hoạch hóa đơn (xem trước & phát hành) */

    /**
     * Tính hóa đơn sẽ tạo cho từng học sinh trong phạm vi của đợt.
     *
     * @param array<string,mixed> $spec school_year_id, term, grade, items:[{fee_item_id,amount}]
     * @return array<string,mixed>
     */
    private function plan(array $spec, ?int $periodId): array
    {
        $yid = (int) $spec['school_year_id'];
        $grade = $spec['grade'];
        $w = 'e.school_year_id = ?';
        $p = [$yid];
        if ($grade) {
            $w .= ' AND c.grade = ?';
            $p[] = (int) $grade;
        }
        $students = $this->all("SELECT s.id, s.code, s.full_name, c.grade, c.name AS class_name FROM sm_enrollments e
                                  JOIN sm_students s ON s.id = e.student_id JOIN sm_classes c ON c.id = e.class_id WHERE $w ORDER BY c.grade, c.name, s.code", $p);

        $feeInfo = [];
        foreach ($spec['items'] as $it) {
            $f = $this->one('SELECT id, code, name, category, grade FROM sm_fee_items WHERE id = ?', [(int) $it['fee_item_id']]);
            if ($f) {
                $feeInfo[(int) $f['id']] = $f + ['price' => (int) $it['amount']];
            }
        }
        $waiver = [];
        foreach ($this->all('SELECT student_id, MAX(percent) AS pc FROM sm_fee_waivers WHERE school_year_id = ? GROUP BY student_id', [$yid]) as $r) {
            $waiver[(int) $r['student_id']] = (int) $r['pc'];
        }
        $have = [];
        if ($periodId) {
            foreach ($this->all('SELECT student_id FROM sm_invoices WHERE period_id = ?', [$periodId]) as $r) {
                $have[(int) $r['student_id']] = 1;
            }
        }

        $plan = [];
        $sum = ['students' => count($students), 'to_create' => 0, 'already' => 0, 'no_items' => 0, 'subtotal' => 0, 'discount' => 0, 'total' => 0, 'waived_students' => 0];
        $byGrade = [];
        foreach ($students as $s) {
            $sid = (int) $s['id'];
            if (isset($have[$sid])) {
                $sum['already']++;
                continue;
            }
            $lines = [];
            $sub = $disc = 0;
            foreach ($feeInfo as $f) {
                if ($f['grade'] !== null && (int) $f['grade'] !== (int) $s['grade']) {
                    continue;
                }
                $d = ($f['category'] === 'tuition' && isset($waiver[$sid])) ? intdiv($f['price'] * $waiver[$sid], 100) : 0;
                $lines[] = ['fee_item_id' => (int) $f['id'], 'description' => $f['name'], 'unit_price' => $f['price'], 'discount' => $d, 'amount' => $f['price'] - $d];
                $sub += $f['price'];
                $disc += $d;
            }
            if (!$lines) {
                $sum['no_items']++;
                continue;
            }
            $sum['to_create']++;
            $sum['subtotal'] += $sub;
            $sum['discount'] += $disc;
            $sum['total'] += $sub - $disc;
            if ($disc > 0) {
                $sum['waived_students']++;
            }
            $g = (int) $s['grade'];
            $byGrade[$g] ??= ['grade' => $g, 'students' => 0, 'total' => 0, 'per_student' => $sub];
            $byGrade[$g]['students']++;
            $byGrade[$g]['total'] += $sub - $disc;
            $plan[] = ['student_id' => $sid, 'lines' => $lines, 'subtotal' => $sub, 'discount' => $disc, 'total' => $sub - $disc];
        }
        ksort($byGrade);
        return ['plan' => $plan, 'summary' => $sum, 'by_grade' => array_values($byGrade), 'lines' => array_values($feeInfo)];
    }

    /**
     * Xem trước kết quả phát hành (không ghi dữ liệu).
     *
     * @param array<string,mixed> $in dữ liệu form, hoặc ['period_id' => n]
     * @return array<string,mixed>
     */
    public function preview(array $in): array
    {
        $periodId = !empty($in['period_id']) ? (int) $in['period_id'] : null;
        if ($periodId) {
            $d = $this->editData($periodId);
            if (!$d) {
                return self::fail('Không tìm thấy đợt thu.', 404);
            }
            $v = ['ok' => true, 'data' => $d];
        } else {
            $v = $this->validate($in);
        }
        if (!$v['ok']) {
            return self::fail('Thông tin chưa hợp lệ, vui lòng kiểm tra lại.', 422, ['errors' => $v['errors']]);
        }
        $d = $v['data'];
        $pl = $this->plan($d, $periodId);

        $warnings = [];
        $others = $this->all("SELECT id, code, name, grade, status FROM sm_fee_periods WHERE school_year_id = ? AND term = ? AND status IN ('draft', 'open') AND id <> ?",
            [$d['school_year_id'], $d['term'], $periodId ?? 0]);
        foreach ($others as $o) {
            if ($o['grade'] === null || $d['grade'] === null || (int) $o['grade'] === (int) $d['grade']) {
                $warnings[] = 'Đã có đợt thu "' . $o['name'] . '" (' . $o['code'] . ') cùng học kỳ và phạm vi chồng nhau. Hãy chắc rằng không thu trùng khoản.';
            }
        }
        if ($d['due_date'] < $this->today()) {
            $warnings[] = 'Hạn nộp đã qua. Hãy chọn hạn nộp từ hôm nay trở đi trước khi phát hành.';
        }
        if ($pl['summary']['students'] === 0) {
            $warnings[] = 'Không có học sinh nào trong phạm vi đã chọn ở năm học này.';
        }
        if ($pl['summary']['no_items'] > 0) {
            $warnings[] = $pl['summary']['no_items'] . ' học sinh không có khoản nào áp dụng (ví dụ khoản chỉ dành cho một khối khác) nên sẽ không có hóa đơn.';
        }
        return ['ok' => true, 'status' => 200, 'data' => ['summary' => $pl['summary'], 'by_grade' => $pl['by_grade'], 'lines' => $pl['lines'], 'warnings' => $warnings]];
    }

    /**
     * Phát hành hóa đơn cho học sinh chưa có hóa đơn của đợt này (chạy lại để bổ sung học sinh mới nhập lớp).
     *
     * @return array<string,mixed>
     */
    public function issue(int $id, array $staff): array
    {
        $per = $this->periodRow($id);
        if (!$per) {
            return self::fail('Không tìm thấy đợt thu.', 404);
        }
        if (!in_array($per['status'], ['draft', 'open'], true)) {
            return self::fail('Đợt thu đã ' . ($per['status'] === 'closed' ? 'kết thúc. Hãy mở lại đợt trước khi phát hành thêm.' : 'bị hủy.'));
        }
        $first = $per['status'] === 'draft';
        $today = $this->today();
        $due = substr((string) $per['due_date'], 0, 10);
        if ($first && $due < $today) {
            return self::fail('Hạn nộp đã qua. Hãy sửa hạn nộp từ hôm nay trở đi rồi phát hành.');
        }
        $d = $this->editData($id);
        $pl = $this->plan($d, $id);
        if (!$pl['plan'] && $first) {
            return self::fail('Không có học sinh nào để phát hành hóa đơn. Kiểm tra lại năm học, khối và khoản thu.');
        }
        $y = (string) ($this->one('SELECT label FROM sm_school_years WHERE id = ?', [$d['school_year_id']])['label'] ?? '');
        $yy = substr($y, 2, 2) . substr($y, -2);
        $open = substr((string) $per['open_date'], 0, 10);
        $issueDate = $open <= $today ? $open : $today;

        $this->pdo->beginTransaction();
        try {
            $created = 0;
            foreach ($pl['plan'] as $x) {
                $this->run('INSERT INTO sm_invoices (code, student_id, school_year_id, term, title, issue_date, due_date, subtotal, discount, total, status, period_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    ['TMP' . bin2hex(random_bytes(7)), $x['student_id'], $d['school_year_id'], $d['term'], mb_substr($per['name'], 0, 160), $issueDate, $due, $x['subtotal'], $x['discount'], $x['total'], 'issued', $id]);
                $iid = (int) $this->pdo->lastInsertId();
                $this->run('UPDATE sm_invoices SET code = ? WHERE id = ?', [sprintf('HD%s-%05d', $yy, $iid), $iid]);
                foreach ($x['lines'] as $l) {
                    $this->run('INSERT INTO sm_invoice_lines (invoice_id, fee_item_id, description, quantity, unit_price, discount, amount) VALUES (?, ?, ?, 1, ?, ?, ?)',
                        [$iid, $l['fee_item_id'], $l['description'], $l['unit_price'], $l['discount'], $l['amount']]);
                }
                $created++;
            }
            if ($first) {
                $this->run('UPDATE sm_fee_periods SET status = ?, issued_at = ?, issued_by = ?, open_date = ? WHERE id = ?', ['open', $this->ts(), $staff['name'], $issueDate, $id]);
            }
            $this->log($id, 'issue', ($first ? 'Phát hành đợt thu: ' : 'Phát hành bổ sung: ') . "$created hóa đơn, tổng " . number_format($pl['summary']['total'], 0, ',', '.') . 'đ'
                . ($pl['summary']['discount'] > 0 ? ', đã trừ miễn giảm ' . number_format($pl['summary']['discount'], 0, ',', '.') . 'đ' : ''), $staff['name']);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
        $msg = $created === 0
            ? 'Tất cả học sinh trong phạm vi đã có hóa đơn, không có gì để bổ sung.'
            : ($first ? "Đã phát hành $created hóa đơn. Học sinh xem được ngay trong cổng học sinh." : "Đã phát hành bổ sung $created hóa đơn.");
        return ['ok' => true, 'status' => 200, 'message' => $msg, 'created' => $created];
    }

    /* ================================================================== vòng đời đợt thu */

    /** Gia hạn hạn nộp cho đợt và mọi hóa đơn chưa đóng đủ. @return array<string,mixed> */
    public function extend(int $id, string $newDue, string $reason, array $staff): array
    {
        $per = $this->periodRow($id);
        if (!$per) {
            return self::fail('Không tìm thấy đợt thu.', 404);
        }
        if ($per['status'] !== 'open') {
            return self::fail('Chỉ gia hạn được đợt thu đang thu.');
        }
        $old = substr((string) $per['due_date'], 0, 10);
        if (!self::validDate($newDue)) {
            return self::fail('Hạn nộp mới không hợp lệ.');
        }
        if ($newDue <= $old) {
            return self::fail('Hạn nộp mới phải sau hạn hiện tại (' . date('d/m/Y', strtotime($old)) . ').');
        }
        if ($newDue > date('Y-m-d', strtotime($old) + 180 * 86400)) {
            return self::fail('Chỉ gia hạn tối đa 180 ngày một lần.');
        }
        $reason = trim($reason);
        if (mb_strlen($reason) < 5 || mb_strlen($reason) > 200) {
            return self::fail('Vui lòng nhập lý do gia hạn (5 đến 200 ký tự).');
        }
        $this->pdo->beginTransaction();
        try {
            $this->run('UPDATE sm_fee_periods SET due_date = ? WHERE id = ?', [$newDue, $id]);
            $n = $this->run("UPDATE sm_invoices SET due_date = ? WHERE period_id = ? AND status = 'issued'
                               AND total > (SELECT COALESCE(SUM(p.amount), 0) FROM sm_payments p WHERE p.invoice_id = sm_invoices.id AND p.status = 'confirmed')", [$newDue, $id]);
            $this->log($id, 'extend', 'Gia hạn ' . date('d/m/Y', strtotime($old)) . ' → ' . date('d/m/Y', strtotime($newDue)) . " ($n hóa đơn chưa đóng đủ). Lý do: $reason", $staff['name']);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
        return ['ok' => true, 'status' => 200, 'message' => "Đã gia hạn đến " . date('d/m/Y', strtotime($newDue)) . ", cập nhật $n hóa đơn chưa đóng đủ."];
    }

    /** Kết thúc đợt thu: ngừng nhận khai báo thanh toán mới từ học sinh. @return array<string,mixed> */
    public function close(int $id, array $staff): array
    {
        $per = $this->periodRow($id);
        if (!$per) {
            return self::fail('Không tìm thấy đợt thu.', 404);
        }
        if ($per['status'] !== 'open') {
            return self::fail('Chỉ đóng được đợt thu đang thu.');
        }
        $st = self::stats($this->invoiceRows('i.period_id = ?', [$id]));
        if ($st['pending'] > 0) {
            return self::fail('Còn khoản học sinh khai báo đang chờ xác nhận (' . number_format($st['pending'], 0, ',', '.') . 'đ). Hãy xử lý hết trước khi đóng đợt.');
        }
        $this->run('UPDATE sm_fee_periods SET status = ?, closed_at = ?, closed_by = ? WHERE id = ?', ['closed', $this->ts(), $staff['name'], $id]);
        $this->log($id, 'close', 'Kết thúc đợt thu. Còn nợ ' . number_format($st['remaining'], 0, ',', '.') . 'đ ở ' . ($st['unpaid_count'] + $st['partial_count']) . ' hóa đơn', $staff['name']);
        return ['ok' => true, 'status' => 200, 'message' => 'Đã kết thúc đợt thu.'];
    }

    /** @return array<string,mixed> */
    public function reopen(int $id, array $staff): array
    {
        $per = $this->periodRow($id);
        if (!$per) {
            return self::fail('Không tìm thấy đợt thu.', 404);
        }
        if ($per['status'] !== 'closed') {
            return self::fail('Chỉ mở lại được đợt thu đã kết thúc.');
        }
        $this->run('UPDATE sm_fee_periods SET status = ?, closed_at = NULL, closed_by = NULL WHERE id = ?', ['open', $id]);
        $this->log($id, 'reopen', 'Mở lại đợt thu', $staff['name']);
        return ['ok' => true, 'status' => 200, 'message' => 'Đã mở lại đợt thu.'];
    }

    /** Hủy bản nháp, hoặc hủy đợt đã phát hành khi chưa có giao dịch nào (chỉ Ban giám hiệu). @return array<string,mixed> */
    public function cancel(int $id, string $reason, array $staff): array
    {
        $per = $this->periodRow($id);
        if (!$per) {
            return self::fail('Không tìm thấy đợt thu.', 404);
        }
        if (!in_array($per['status'], ['draft', 'open'], true)) {
            return self::fail('Chỉ hủy được bản nháp hoặc đợt đang thu.');
        }
        $reason = trim($reason);
        if (mb_strlen($reason) < 5 || mb_strlen($reason) > 200) {
            return self::fail('Vui lòng nhập lý do hủy (5 đến 200 ký tự).');
        }
        $n = 0;
        $this->pdo->beginTransaction();
        try {
            if ($per['status'] === 'open') {
                if (!in_array($staff['role'], self::CAN_CANCEL, true)) {
                    $this->pdo->rollBack();
                    return self::fail('Chỉ Ban giám hiệu hoặc quản trị mới được hủy đợt thu đã phát hành.', 403);
                }
                $pay = (int) ($this->one("SELECT COUNT(*) AS n FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id WHERE i.period_id = ? AND p.status IN ('pending', 'confirmed')", [$id])['n'] ?? 0);
                if ($pay > 0) {
                    $this->pdo->rollBack();
                    return self::fail("Đợt thu đã có $pay giao dịch thanh toán nên không thể hủy. Hãy dùng \"Đóng đợt\" hoặc hoàn trả từng khoản.");
                }
                $n = $this->run("UPDATE sm_invoices SET status = 'cancelled' WHERE period_id = ? AND status = 'issued'", [$id]);
            }
            $this->run('UPDATE sm_fee_periods SET status = ?, closed_at = ?, closed_by = ? WHERE id = ?', ['cancelled', $this->ts(), $staff['name'], $id]);
            $this->log($id, 'cancel', "Hủy đợt thu" . ($n ? " ($n hóa đơn bị hủy)" : '') . ". Lý do: $reason", $staff['name']);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
        return ['ok' => true, 'status' => 200, 'message' => $n ? "Đã hủy đợt thu và $n hóa đơn." : 'Đã hủy bản nháp.'];
    }
}
