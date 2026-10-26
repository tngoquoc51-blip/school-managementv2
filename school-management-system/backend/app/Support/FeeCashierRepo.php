<?php

namespace App\Support;

use PDO;

/**
 * Quầy thu học phí của Kế toán (API /api/kt/cashier/*).
 *
 *  - Tìm học sinh, xem công nợ theo từng hóa đơn
 *  - Ghi nhận thu trực tiếp (tiền mặt / chuyển khoản / POS / ví điện tử), tự tạo phiếu thu
 *  - Duyệt hoặc từ chối khoản học sinh tự khai báo chuyển khoản (trạng thái pending)
 *  - Lịch sử phiếu thu, in phiếu, hủy phiếu (có lý do, có nhật ký)
 *  - Tổng kết thu theo ngày, trả lời phản hồi hóa đơn của học sinh
 *
 * Dùng PDO + SQL chuẩn nên chạy giống nhau trên MySQL/MariaDB và SQLite (kiểm thử).
 */
class FeeCashierRepo
{
    public const MIN_AMOUNT = 1000;
    public const MAX_TOTAL = 500000000;
    public const MAX_ITEMS = 20;
    public const PER_PAGE = 20;
    public const BACKDATE_DAYS = 30;
    /** Vai trò được hủy phiếu thu ở bất kỳ ngày nào. Kế toán chỉ hủy được phiếu thu trong ngày. */
    public const CAN_VOID_ANY = ['principal', 'vice_principal', 'super_admin'];

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

    private function lock(): string
    {
        return $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
    }

    private static function fail(string $msg, int $status = 422, array $extra = []): array
    {
        return ['ok' => false, 'status' => $status, 'message' => $msg] + $extra;
    }

    private static function validDate(?string $d): bool
    {
        return is_string($d) && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
    }

    private function d(?string $v): ?string
    {
        $t = $v ? strtotime(substr($v, 0, 10)) : false;
        return $t ? date('d/m/Y', $t) : null;
    }

    private function dt(?string $v): ?string
    {
        $t = $v ? strtotime($v) : false;
        return $t ? date('H:i d/m/Y', $t) : null;
    }

    private function log(int $paymentId, string $action, string $detail, string $actor): void
    {
        $this->run('INSERT INTO sm_payment_log (payment_id, action, detail, actor, created_at) VALUES (?, ?, ?, ?, ?)',
            [$paymentId, $action, mb_substr($detail, 0, 500), $actor, $this->ts()]);
    }

    /** @return array<string,string> */
    private function settings(): array
    {
        $o = [];
        foreach ($this->all('SELECT skey, svalue FROM sm_fee_settings') as $r) {
            $o[$r['skey']] = $r['svalue'];
        }
        return $o;
    }

    /** @return array<string,mixed> */
    private function currentYear(): array
    {
        return $this->one('SELECT id, label FROM sm_school_years WHERE is_current = 1')
            ?? $this->one('SELECT id, label FROM sm_school_years ORDER BY start_date DESC') ?? ['id' => 0, 'label' => '—'];
    }

    /** Biểu thức "ngày ghi nhận tiền": ngày xác nhận, nếu chưa có thì ngày thanh toán. */
    private const DAY = 'substr(COALESCE(p.confirmed_at, p.paid_at), 1, 10)';

    private function pages(int $total, int $per): int
    {
        return max(1, (int) ceil($total / max(1, $per)));
    }

    /**
     * Công nợ theo học sinh (mọi năm học, trừ hóa đơn đã hủy).
     *
     * @param array<int,int>|null $ids
     * @return array<int,array<string,int>>
     */
    private function balances(?array $ids = null): array
    {
        $where = "i.status <> 'cancelled'";
        if ($ids !== null) {
            if (!$ids) {
                return [];
            }
            $where .= ' AND i.student_id IN (' . implode(',', array_map('intval', $ids)) . ')';
        }
        $rows = $this->all("SELECT i.student_id, i.total, i.due_date,
                   (SELECT COALESCE(SUM(p.amount), 0) FROM sm_payments p WHERE p.invoice_id = i.id AND p.status = 'confirmed') AS paid,
                   (SELECT COALESCE(SUM(p.amount), 0) FROM sm_payments p WHERE p.invoice_id = i.id AND p.status = 'pending') AS pending
              FROM sm_invoices i WHERE $where");
        $today = strtotime($this->today());
        $out = [];
        foreach ($rows as $r) {
            $sid = (int) $r['student_id'];
            $out[$sid] ??= ['billed' => 0, 'paid' => 0, 'pending' => 0, 'balance' => 0, 'overdue' => 0, 'overdue_invoices' => 0, 'open_invoices' => 0, 'max_days' => 0];
            $bal = max(0, (int) $r['total'] - (int) $r['paid']);
            $out[$sid]['billed'] += (int) $r['total'];
            $out[$sid]['paid'] += (int) $r['paid'];
            $out[$sid]['pending'] += (int) $r['pending'];
            $out[$sid]['balance'] += $bal;
            if ($bal > 0) {
                $out[$sid]['open_invoices']++;
                $due = strtotime(substr((string) $r['due_date'], 0, 10));
                if ($due && $due < $today) {
                    $out[$sid]['overdue'] += $bal;
                    $out[$sid]['overdue_invoices']++;
                    $out[$sid]['max_days'] = max($out[$sid]['max_days'], (int) floor(($today - $due) / 86400));
                }
            }
        }
        return $out;
    }

    private static function emptyBalance(): array
    {
        return ['billed' => 0, 'paid' => 0, 'pending' => 0, 'balance' => 0, 'overdue' => 0, 'overdue_invoices' => 0, 'open_invoices' => 0, 'max_days' => 0];
    }

    /* ================================================================== dữ liệu dùng chung cho giao diện */

    /** @return array<string,mixed> */
    public function meta(): array
    {
        $cur = $this->currentYear();
        $classes = array_map(fn ($c) => ['id' => (int) $c['id'], 'name' => $c['name'], 'grade' => (int) $c['grade']],
            $this->all('SELECT id, name, grade FROM sm_classes WHERE school_year_id = ? ORDER BY grade, name', [(int) $cur['id']]));
        $cashiers = array_column($this->all("SELECT DISTINCT confirmed_by FROM sm_payments WHERE confirmed_by IS NOT NULL AND confirmed_by <> '' ORDER BY confirmed_by"), 'confirmed_by');
        $s = $this->settings();
        $methods = [];
        foreach (FeeRepo::METHODS as $k => $v) {
            $methods[] = ['key' => $k, 'label' => $v, 'needs_ref' => $k !== 'cash'];
        }

        return [
            'year' => ['id' => (int) $cur['id'], 'label' => $cur['label']],
            'classes' => $classes,
            'methods' => $methods,
            'cashiers' => $cashiers,
            'limits' => ['min_amount' => self::MIN_AMOUNT, 'max_total' => self::MAX_TOTAL, 'backdate_days' => self::BACKDATE_DAYS],
            'today' => $this->today(),
            'pay_info' => ['bank_short' => $s['bank_short'] ?? '', 'bank_bin' => $s['bank_bin'] ?? '', 'account_no' => $s['account_no'] ?? '',
                'account_name' => $s['account_name'] ?? '', 'demo_note' => $s['demo_note'] ?? null],
        ];
    }

    /* ================================================================== tổng quan */

    /** @return array<string,mixed> */
    public function overview(): array
    {
        $today = $this->today();
        $day = self::DAY;
        $by = $this->all("SELECT p.method, COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt FROM sm_payments p WHERE p.status = 'confirmed' AND $day = ? GROUP BY p.method", [$today]);
        $todayAmt = 0;
        $todayCnt = 0;
        $byMethod = [];
        foreach ($by as $r) {
            $todayAmt += (int) $r['amt'];
            $todayCnt += (int) $r['n'];
            $byMethod[] = ['method' => $r['method'], 'label' => FeeRepo::METHODS[$r['method']] ?? $r['method'], 'count' => (int) $r['n'], 'amount' => (int) $r['amt']];
        }
        $month = $this->one("SELECT COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt FROM sm_payments p WHERE p.status = 'confirmed' AND substr(COALESCE(p.confirmed_at, p.paid_at), 1, 7) = ?", [substr($today, 0, 7)]);
        $pend = $this->one("SELECT COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt, MIN(p.paid_at) AS oldest FROM sm_payments p WHERE p.status = 'pending'");
        $oldest = $pend && $pend['oldest'] ? max(0, (int) floor((strtotime($today) - strtotime(substr($pend['oldest'], 0, 10))) / 86400)) : 0;
        $disp = (int) ($this->one("SELECT COUNT(*) AS n FROM sm_invoice_disputes WHERE status = 'open'")['n'] ?? 0);

        $bal = $this->balances();
        $totBalance = 0;
        $totOverdue = 0;
        $debtors = 0;
        $overdueStudents = 0;
        foreach ($bal as $b) {
            $totBalance += $b['balance'];
            $totOverdue += $b['overdue'];
            $debtors += $b['balance'] > 0 ? 1 : 0;
            $overdueStudents += $b['overdue'] > 0 ? 1 : 0;
        }
        uasort($bal, fn ($a, $b) => [$b['overdue'], $b['balance']] <=> [$a['overdue'], $a['balance']]);
        $topIds = array_slice(array_keys(array_filter($bal, fn ($b) => $b['balance'] > 0)), 0, 8);
        $top = [];
        if ($topIds) {
            $info = $this->studentInfo($topIds);
            foreach ($topIds as $id) {
                if (isset($info[$id])) {
                    $top[] = $info[$id] + ['overdue' => $bal[$id]['overdue'], 'balance' => $bal[$id]['balance'], 'max_days' => $bal[$id]['max_days']];
                }
            }
        }
        $recent = array_map(fn ($r) => $this->payRow($r), $this->all($this->paySelect() . " WHERE p.status = 'confirmed' ORDER BY COALESCE(p.confirmed_at, p.paid_at) DESC, p.id DESC LIMIT 8"));

        return [
            'today' => ['date' => $today, 'amount' => $todayAmt, 'count' => $todayCnt, 'by_method' => $byMethod],
            'month' => ['amount' => (int) $month['amt'], 'count' => (int) $month['n']],
            'pending' => ['count' => (int) $pend['n'], 'amount' => (int) $pend['amt'], 'oldest_days' => $oldest],
            'disputes_open' => $disp,
            'debt' => ['balance' => $totBalance, 'overdue' => $totOverdue, 'students' => $debtors, 'overdue_students' => $overdueStudents],
            'top_debtors' => $top,
            'recent' => $recent,
        ];
    }

    /**
     * @param array<int,int> $ids
     * @return array<int,array<string,mixed>>
     */
    private function studentInfo(array $ids): array
    {
        $cur = (int) $this->currentYear()['id'];
        $rows = $this->all('SELECT s.id, s.code, s.full_name, c.name AS class_name, c.grade FROM sm_students s
                              LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? LEFT JOIN sm_classes c ON c.id = e.class_id
                             WHERE s.id IN (' . implode(',', array_map('intval', $ids)) . ')', [$cur]);
        $o = [];
        foreach ($rows as $r) {
            $o[(int) $r['id']] = ['id' => (int) $r['id'], 'code' => $r['code'], 'name' => $r['full_name'], 'class' => $r['class_name'], 'grade' => $r['grade'] !== null ? (int) $r['grade'] : null];
        }
        return $o;
    }

    /* ================================================================== tìm học sinh */

    /**
     * @param array<string,mixed> $f q, class_id, grade, debt (all|owing|overdue|pending), page
     * @return array<string,mixed>
     */
    public function students(array $f): array
    {
        $cur = (int) $this->currentYear()['id'];
        $w = ['1 = 1'];
        $p = [$cur];
        $q = trim((string) ($f['q'] ?? ''));
        if ($q !== '') {
            $w[] = '(s.code LIKE ? OR s.full_name LIKE ?)';
            $p[] = '%' . $q . '%';
            $p[] = '%' . $q . '%';
        }
        if (!empty($f['class_id'])) {
            $w[] = 'c.id = ?';
            $p[] = (int) $f['class_id'];
        }
        if (!empty($f['grade'])) {
            $w[] = 'c.grade = ?';
            $p[] = (int) $f['grade'];
        }
        $debt = (string) ($f['debt'] ?? 'all');
        if (!in_array($debt, ['all', 'owing', 'overdue', 'pending'], true)) {
            $debt = 'all';
        }
        $base = 'FROM sm_students s LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? LEFT JOIN sm_classes c ON c.id = e.class_id WHERE ' . implode(' AND ', $w);
        $page = max(1, (int) ($f['page'] ?? 1));

        if ($debt === 'all') {
            if ($q === '' && empty($f['class_id']) && empty($f['grade'])) {
                return ['items' => [], 'total' => 0, 'page' => 1, 'pages' => 1, 'per_page' => self::PER_PAGE, 'hint' => 'Nhập mã, họ tên hoặc chọn lớp để tìm học sinh.'];
            }
            $total = (int) $this->one("SELECT COUNT(*) AS n $base", $p)['n'];
            $rows = $this->all("SELECT s.id $base ORDER BY c.grade, c.name, s.code LIMIT " . self::PER_PAGE . ' OFFSET ' . (($page - 1) * self::PER_PAGE), $p);
            $ids = array_map(fn ($r) => (int) $r['id'], $rows);
            $bal = $this->balances($ids);
        } else {
            $rows = $this->all("SELECT s.id $base", $p);
            $ids = array_map(fn ($r) => (int) $r['id'], $rows);
            $bal = $this->balances($ids);
            $keep = array_filter($bal, fn ($b) => match ($debt) {
                'owing' => $b['balance'] > 0,
                'overdue' => $b['overdue'] > 0,
                default => $b['pending'] > 0,
            });
            uasort($keep, fn ($a, $b) => [$b['overdue'], $b['balance']] <=> [$a['overdue'], $a['balance']]);
            $all = array_keys($keep);
            $total = count($all);
            $ids = array_slice($all, ($page - 1) * self::PER_PAGE, self::PER_PAGE);
        }
        $info = $this->studentInfo($ids);
        $items = [];
        foreach ($ids as $id) {
            if (!isset($info[$id])) {
                continue;
            }
            $b = $bal[$id] ?? self::emptyBalance();
            $items[] = $info[$id] + [
                'balance' => $b['balance'], 'overdue' => $b['overdue'], 'pending' => $b['pending'], 'paid' => $b['paid'], 'billed' => $b['billed'],
                'open_invoices' => $b['open_invoices'], 'max_days' => $b['max_days'],
                'state' => $b['billed'] === 0 ? 'none' : ($b['overdue'] > 0 ? 'overdue' : ($b['balance'] > 0 ? 'owing' : 'paid')),
            ];
        }

        return ['items' => $items, 'total' => $total, 'page' => $page, 'pages' => $this->pages($total, self::PER_PAGE), 'per_page' => self::PER_PAGE];
    }

    /* ================================================================== hồ sơ thu của một học sinh */

    /** @return array<string,mixed>|null */
    public function student(int $id): ?array
    {
        $cur = $this->currentYear();
        $s = $this->one('SELECT id, code, full_name, gender, birth_date FROM sm_students WHERE id = ?', [$id]);
        if (!$s) {
            return null;
        }
        $e = $this->one('SELECT c.name, c.grade FROM sm_enrollments e JOIN sm_classes c ON c.id = e.class_id WHERE e.student_id = ? AND e.school_year_id = ?', [$id, (int) $cur['id']]);
        $rows = $this->all("SELECT i.id, i.code, i.title, i.term, i.school_year_id, i.issue_date, i.due_date, i.subtotal, i.discount, i.total, i.status, i.period_id,
                   y.label AS year_label, fp.name AS period_name, fp.status AS period_status,
                   (SELECT COALESCE(SUM(p.amount), 0) FROM sm_payments p WHERE p.invoice_id = i.id AND p.status = 'confirmed') AS paid,
                   (SELECT COALESCE(SUM(p.amount), 0) FROM sm_payments p WHERE p.invoice_id = i.id AND p.status = 'pending') AS pending
              FROM sm_invoices i JOIN sm_school_years y ON y.id = i.school_year_id LEFT JOIN sm_fee_periods fp ON fp.id = i.period_id
             WHERE i.student_id = ? AND i.status <> 'cancelled' ORDER BY y.start_date DESC, i.due_date DESC, i.id DESC", [$id]);
        $ids = array_map(fn ($r) => (int) $r['id'], $rows);
        $lines = [];
        if ($ids) {
            foreach ($this->all('SELECT l.invoice_id, l.description, l.quantity, l.unit_price, l.discount, l.amount FROM sm_invoice_lines l WHERE l.invoice_id IN (' . implode(',', $ids) . ') ORDER BY l.id') as $l) {
                $lines[(int) $l['invoice_id']][] = ['description' => $l['description'], 'quantity' => (int) $l['quantity'], 'unit_price' => (int) $l['unit_price'], 'discount' => (int) $l['discount'], 'amount' => (int) $l['amount']];
            }
        }
        $today = strtotime($this->today());
        $tot = ['billed' => 0, 'paid' => 0, 'pending' => 0, 'balance' => 0, 'overdue' => 0, 'collectable' => 0];
        $invoices = [];
        foreach ($rows as $r) {
            $total = (int) $r['total'];
            $paid = (int) $r['paid'];
            $pending = (int) $r['pending'];
            $bal = max(0, $total - $paid);
            $due = substr((string) $r['due_date'], 0, 10);
            $overdue = $bal > 0 && strtotime($due) < $today;
            $tot['billed'] += $total;
            $tot['paid'] += $paid;
            $tot['pending'] += $pending;
            $tot['balance'] += $bal;
            $tot['overdue'] += $overdue ? $bal : 0;
            $tot['collectable'] += max(0, $bal - $pending);
            $invoices[] = [
                'id' => (int) $r['id'], 'code' => $r['code'], 'title' => $r['title'], 'term' => $r['term'], 'term_label' => FeeRepo::TERMS[$r['term']] ?? $r['term'],
                'year' => $r['year_label'], 'current_year' => (int) $r['school_year_id'] === (int) $cur['id'],
                'period' => $r['period_id'] ? ['id' => (int) $r['period_id'], 'name' => $r['period_name'], 'status' => $r['period_status']] : null,
                'issue_date' => $this->d($r['issue_date']), 'due_date' => $this->d($r['due_date']), 'due_iso' => $due,
                'subtotal' => (int) $r['subtotal'], 'discount' => (int) $r['discount'], 'total' => $total, 'paid' => $paid, 'pending' => $pending,
                'balance' => $bal, 'collectable' => max(0, $bal - $pending),
                'status' => $bal === 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid'),
                'overdue' => $overdue, 'overdue_days' => $overdue ? (int) floor(($today - strtotime($due)) / 86400) : 0,
                'lines' => $lines[(int) $r['id']] ?? [],
            ];
        }
        $waivers = array_map(fn ($w) => ['id' => (int) $w['id'], 'year' => $w['year_label'], 'label' => $w['label'], 'percent' => (int) $w['percent'], 'approved_by' => $w['approved_by']],
            $this->all('SELECT w.id, w.label, w.percent, w.approved_by, y.label AS year_label FROM sm_fee_waivers w JOIN sm_school_years y ON y.id = w.school_year_id WHERE w.student_id = ? ORDER BY y.start_date DESC', [$id]));
        $recent = array_map(fn ($r) => $this->payRow($r), $this->all($this->paySelect() . ' WHERE p.student_id = ? ORDER BY p.id DESC LIMIT 10', [$id]));
        $disputes = array_map(fn ($d) => ['id' => (int) $d['id'], 'invoice_id' => (int) $d['invoice_id'], 'invoice_code' => $d['code'], 'message' => $d['message'], 'status' => $d['status'], 'reply' => $d['reply'],
            'replied_by' => $d['replied_by'], 'created_at' => $this->dt($d['created_at']), 'replied_at' => $this->dt($d['replied_at'])],
            $this->all('SELECT d.id, d.invoice_id, i.code, d.message, d.status, d.reply, d.replied_by, d.created_at, d.replied_at FROM sm_invoice_disputes d JOIN sm_invoices i ON i.id = d.invoice_id WHERE d.student_id = ? ORDER BY d.id DESC LIMIT 5', [$id]));

        return [
            'student' => ['id' => (int) $s['id'], 'code' => $s['code'], 'name' => $s['full_name'], 'gender' => $s['gender'], 'birth_date' => $this->d($s['birth_date']),
                'class' => $e['name'] ?? null, 'grade' => isset($e['grade']) ? (int) $e['grade'] : null, 'year' => $cur['label']],
            'totals' => $tot, 'invoices' => $invoices, 'waivers' => $waivers, 'recent_payments' => $recent, 'disputes' => $disputes,
        ];
    }

    /* ================================================================== truy vấn phiếu thu */

    private function paySelect(): string
    {
        return "SELECT p.id, p.receipt_code, p.amount, p.method, p.reference, p.payer_note, p.status, p.paid_at, p.created_at, p.confirmed_by, p.confirmed_at, p.reject_reason,
                   p.student_id, s.code AS student_code, s.full_name AS student_name, c.name AS class_name,
                   i.id AS invoice_id, i.code AS invoice_code, i.title AS invoice_title, i.total AS invoice_total
              FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id JOIN sm_students s ON s.id = p.student_id
              LEFT JOIN sm_enrollments e ON e.student_id = p.student_id AND e.school_year_id = i.school_year_id LEFT JOIN sm_classes c ON c.id = e.class_id";
    }

    /** @param array<string,mixed> $r @return array<string,mixed> */
    private function payRow(array $r, ?array $staff = null): array
    {
        $voided = $r['status'] === 'cancelled' && !empty($r['confirmed_at']) && str_starts_with((string) $r['reject_reason'], 'Hủy phiếu');
        $canVoid = false;
        if ($staff && $r['status'] === 'confirmed') {
            $canVoid = in_array($staff['role'], self::CAN_VOID_ANY, true) || substr((string) ($r['confirmed_at'] ?? $r['paid_at']), 0, 10) === $this->today();
        }
        $wait = 0;
        if ($r['status'] === 'pending') {
            $wait = max(0, (int) floor((strtotime($this->today()) - strtotime(substr((string) $r['paid_at'], 0, 10))) / 86400));
        }

        return [
            'id' => (int) $r['id'], 'receipt_code' => $r['receipt_code'], 'amount' => (int) $r['amount'],
            'method' => $r['method'], 'method_label' => FeeRepo::METHODS[$r['method']] ?? $r['method'], 'reference' => $r['reference'], 'note' => $r['payer_note'],
            'status' => $voided ? 'voided' : $r['status'], 'paid_at' => $this->dt($r['paid_at']), 'paid_iso' => $r['paid_at'],
            'confirmed_by' => $r['confirmed_by'], 'confirmed_at' => $this->dt($r['confirmed_at'] ?? null), 'reason' => $r['reject_reason'],
            'wait_days' => $wait, 'can_void' => $canVoid,
            'student' => ['id' => (int) $r['student_id'], 'code' => $r['student_code'], 'name' => $r['student_name'], 'class' => $r['class_name']],
            'invoice' => ['id' => (int) $r['invoice_id'], 'code' => $r['invoice_code'], 'title' => $r['invoice_title']],
        ];
    }

    /* ================================================================== ghi nhận thu tại quầy */

    /**
     * @param array<string,mixed> $staff
     * @param array<string,mixed> $in student_id, method, reference, note, paid_at, items[{invoice_id, amount}]
     * @return array<string,mixed>
     */
    public function collect(array $staff, array $in): array
    {
        $sid = (int) ($in['student_id'] ?? 0);
        if (!$this->one('SELECT id FROM sm_students WHERE id = ?', [$sid])) {
            return self::fail('Không tìm thấy học sinh.', 404);
        }
        $method = (string) ($in['method'] ?? '');
        if (!isset(FeeRepo::METHODS[$method])) {
            return self::fail('Hình thức thanh toán không hợp lệ.');
        }
        $reference = trim((string) ($in['reference'] ?? ''));
        if ($method === 'cash') {
            $reference = '';
        } elseif (mb_strlen($reference) < 4 || mb_strlen($reference) > 60) {
            return self::fail('Vui lòng nhập mã giao dịch / số tham chiếu (4 đến 60 ký tự) để đối soát.', 422, ['errors' => ['reference' => 'Cần 4 đến 60 ký tự']]);
        }
        $note = trim((string) ($in['note'] ?? ''));
        if (mb_strlen($note) > 255) {
            return self::fail('Ghi chú tối đa 255 ký tự.');
        }
        $items = $in['items'] ?? [];
        if (!is_array($items) || !$items) {
            return self::fail('Hãy chọn ít nhất một hóa đơn và nhập số tiền thu.');
        }
        if (count($items) > self::MAX_ITEMS) {
            return self::fail('Mỗi lần chỉ thu tối đa ' . self::MAX_ITEMS . ' hóa đơn.');
        }
        $paidAt = $this->now();
        if (!empty($in['paid_at'])) {
            $paidAt = strtotime((string) $in['paid_at']) ?: 0;
            if (!$paidAt || $paidAt > $this->now() + 300 || $paidAt < $this->now() - self::BACKDATE_DAYS * 86400) {
                return self::fail('Thời điểm thu không hợp lệ (không ở tương lai, trong vòng ' . self::BACKDATE_DAYS . ' ngày).');
            }
        }
        $seen = [];
        $clean = [];
        $total = 0;
        foreach ($items as $it) {
            $iid = (int) ($it['invoice_id'] ?? 0);
            $amt = $it['amount'] ?? 0;
            if ($iid <= 0 || isset($seen[$iid])) {
                return self::fail('Danh sách hóa đơn không hợp lệ (trùng hoặc thiếu mã).');
            }
            if (!is_numeric($amt) || (float) $amt != floor((float) $amt) || (int) $amt <= 0) {
                return self::fail('Số tiền phải là số nguyên dương.');
            }
            $seen[$iid] = true;
            $clean[] = ['invoice_id' => $iid, 'amount' => (int) $amt];
            $total += (int) $amt;
        }
        if ($total > self::MAX_TOTAL) {
            return self::fail('Tổng số tiền một lần thu không được vượt quá ' . number_format(self::MAX_TOTAL, 0, ',', '.') . 'đ.');
        }
        if ($reference !== '' && $this->one("SELECT id FROM sm_payments WHERE reference = ? AND status IN ('pending', 'confirmed')", [$reference])) {
            return self::fail('Mã giao dịch này đã được ghi nhận trước đó. Vui lòng kiểm tra lại để tránh thu trùng.', 422, ['errors' => ['reference' => 'Mã giao dịch đã tồn tại']]);
        }

        $now = $this->ts();
        $this->pdo->beginTransaction();
        try {
            $made = [];
            foreach ($clean as $c) {
                $inv = $this->one("SELECT i.id, i.code, i.total, i.status, i.student_id FROM sm_invoices i WHERE i.id = ?" . $this->lock(), [$c['invoice_id']]);
                if (!$inv || (int) $inv['student_id'] !== $sid) {
                    throw new \DomainException('Hóa đơn không thuộc học sinh này.');
                }
                if ($inv['status'] === 'cancelled') {
                    throw new \DomainException('Hóa đơn ' . $inv['code'] . ' đã bị hủy, không thể thu.');
                }
                $paid = (int) $this->one("SELECT COALESCE(SUM(amount), 0) AS n FROM sm_payments WHERE invoice_id = ? AND status = 'confirmed'", [$inv['id']])['n'];
                $pend = (int) $this->one("SELECT COALESCE(SUM(amount), 0) AS n FROM sm_payments WHERE invoice_id = ? AND status = 'pending'", [$inv['id']])['n'];
                $bal = max(0, (int) $inv['total'] - $paid);
                if ($bal <= 0) {
                    throw new \DomainException('Hóa đơn ' . $inv['code'] . ' đã đóng đủ.');
                }
                $can = $bal - $pend;
                if ($c['amount'] > $can) {
                    throw new \DomainException($pend > 0 && $can <= 0
                        ? 'Hóa đơn ' . $inv['code'] . ' đang có khoản học sinh khai báo chờ xác nhận. Hãy xác nhận hoặc từ chối khoản đó trước.'
                        : 'Số tiền thu của hóa đơn ' . $inv['code'] . ' vượt quá số còn phải thu (' . number_format($can, 0, ',', '.') . 'đ' . ($pend > 0 ? ', chưa tính ' . number_format($pend, 0, ',', '.') . 'đ đang chờ xác nhận' : '') . ').');
                }
                if ($c['amount'] < self::MIN_AMOUNT && $c['amount'] !== $can) {
                    throw new \DomainException('Số tiền tối thiểu mỗi hóa đơn là ' . number_format(self::MIN_AMOUNT, 0, ',', '.') . 'đ (trừ khi thu hết số còn lại).');
                }
                $this->run('INSERT INTO sm_payments (receipt_code, invoice_id, student_id, amount, method, reference, payer_note, status, paid_at, created_at, confirmed_by, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    ['TMP' . bin2hex(random_bytes(6)), $inv['id'], $sid, $c['amount'], $method, $reference !== '' ? $reference : null, $note !== '' ? $note : null, 'confirmed', $this->ts($paidAt), $now, $staff['name'], $now]);
                $pid = (int) $this->pdo->lastInsertId();
                $code = 'PT' . date('ymd', $this->now()) . str_pad((string) $pid, 6, '0', STR_PAD_LEFT);
                $this->run('UPDATE sm_payments SET receipt_code = ? WHERE id = ?', [$code, $pid]);
                $this->log($pid, 'collect', 'Thu ' . FeeRepo::METHODS[$method] . ' ' . number_format($c['amount'], 0, ',', '.') . 'đ cho hóa đơn ' . $inv['code'], $staff['name']);
                $made[] = ['id' => $pid, 'receipt_code' => $code, 'invoice_id' => (int) $inv['id'], 'invoice_code' => $inv['code'], 'amount' => $c['amount'], 'balance_after' => $bal - $c['amount']];
            }
            $this->pdo->commit();
        } catch (\DomainException $e) {
            $this->pdo->rollBack();
            return self::fail($e->getMessage());
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã ghi nhận ' . number_format($total, 0, ',', '.') . 'đ, tạo ' . count($made) . ' phiếu thu.', 'total' => $total, 'payments' => $made,
            'student_balance' => ($this->balances([$sid])[$sid] ?? self::emptyBalance())['balance']];
    }

    /* ================================================================== khoản học sinh khai báo – chờ duyệt */

    /**
     * @param array<string,mixed> $f q, method, page
     * @return array<string,mixed>
     */
    public function pending(array $f): array
    {
        $w = ["p.status = 'pending'"];
        $p = [];
        if (!empty($f['q'])) {
            $w[] = '(s.code LIKE ? OR s.full_name LIKE ? OR p.reference LIKE ? OR i.code LIKE ?)';
            $k = '%' . trim((string) $f['q']) . '%';
            array_push($p, $k, $k, $k, $k);
        }
        if (!empty($f['method']) && isset(FeeRepo::METHODS[$f['method']])) {
            $w[] = 'p.method = ?';
            $p[] = $f['method'];
        }
        $where = implode(' AND ', $w);
        $page = max(1, (int) ($f['page'] ?? 1));
        $sum = $this->one("SELECT COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id JOIN sm_students s ON s.id = p.student_id WHERE $where", $p);
        $rows = $this->all($this->paySelect() . " WHERE $where ORDER BY p.paid_at ASC, p.id ASC LIMIT " . self::PER_PAGE . ' OFFSET ' . (($page - 1) * self::PER_PAGE), $p);
        $items = [];
        foreach ($rows as $r) {
            $row = $this->payRow($r);
            $inv = $this->one("SELECT i.total, (SELECT COALESCE(SUM(x.amount), 0) FROM sm_payments x WHERE x.invoice_id = i.id AND x.status = 'confirmed') AS paid FROM sm_invoices i WHERE i.id = ?", [$r['invoice_id']]);
            $row['invoice']['total'] = (int) $inv['total'];
            $row['invoice']['balance'] = max(0, (int) $inv['total'] - (int) $inv['paid']);
            $items[] = $row;
        }

        return ['items' => $items, 'total' => (int) $sum['n'], 'amount' => (int) $sum['amt'], 'page' => $page, 'pages' => $this->pages((int) $sum['n'], self::PER_PAGE)];
    }

    /** @param array<string,mixed> $staff @return array<string,mixed> */
    public function confirm(array $staff, int $id): array
    {
        $this->pdo->beginTransaction();
        try {
            $p = $this->one('SELECT id, invoice_id, amount, status, receipt_code FROM sm_payments WHERE id = ?' . $this->lock(), [$id]);
            if (!$p) {
                $this->pdo->rollBack();
                return self::fail('Không tìm thấy khoản thanh toán.', 404);
            }
            if ($p['status'] !== 'pending') {
                $this->pdo->rollBack();
                return self::fail('Khoản này đã được xử lý trước đó (trạng thái hiện tại không còn là chờ xác nhận).', 409);
            }
            $inv = $this->one('SELECT id, code, total, status FROM sm_invoices WHERE id = ?', [$p['invoice_id']]);
            if (!$inv || $inv['status'] === 'cancelled') {
                $this->pdo->rollBack();
                return self::fail('Hóa đơn đã bị hủy nên không thể xác nhận khoản này. Hãy từ chối khoản và ghi rõ lý do.');
            }
            $paid = (int) $this->one("SELECT COALESCE(SUM(amount), 0) AS n FROM sm_payments WHERE invoice_id = ? AND status = 'confirmed'", [$inv['id']])['n'];
            $bal = max(0, (int) $inv['total'] - $paid);
            if ((int) $p['amount'] > $bal) {
                $this->pdo->rollBack();
                return self::fail('Số tiền khai báo (' . number_format((int) $p['amount'], 0, ',', '.') . 'đ) vượt quá số còn phải thu của hóa đơn (' . number_format($bal, 0, ',', '.') . 'đ). Hãy từ chối khoản này và ghi rõ lý do.');
            }
            $now = $this->ts();
            $this->run("UPDATE sm_payments SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?, reject_reason = NULL WHERE id = ? AND status = 'pending'", [$staff['name'], $now, $id]);
            $this->log($id, 'confirm', 'Xác nhận ' . number_format((int) $p['amount'], 0, ',', '.') . 'đ cho hóa đơn ' . $inv['code'], $staff['name']);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã xác nhận phiếu ' . $p['receipt_code'] . '.', 'payment_id' => $id];
    }

    /** @param array<string,mixed> $staff @return array<string,mixed> */
    public function reject(array $staff, int $id, string $reason): array
    {
        $reason = trim(preg_replace('/\s+/u', ' ', $reason));
        if (mb_strlen($reason) < 5 || mb_strlen($reason) > 200) {
            return self::fail('Lý do từ chối cần từ 5 đến 200 ký tự để học sinh biết cần làm gì.', 422, ['errors' => ['reason' => 'Cần 5 đến 200 ký tự']]);
        }
        $p = $this->one('SELECT id, status, receipt_code, amount FROM sm_payments WHERE id = ?', [$id]);
        if (!$p) {
            return self::fail('Không tìm thấy khoản thanh toán.', 404);
        }
        $n = $this->run("UPDATE sm_payments SET status = 'rejected', confirmed_by = ?, confirmed_at = ?, reject_reason = ? WHERE id = ? AND status = 'pending'", [$staff['name'], $this->ts(), $reason, $id]);
        if (!$n) {
            return self::fail('Khoản này đã được xử lý trước đó.', 409);
        }
        $this->log($id, 'reject', 'Từ chối: ' . $reason, $staff['name']);

        return ['ok' => true, 'status' => 200, 'message' => 'Đã từ chối phiếu ' . $p['receipt_code'] . '. Học sinh sẽ thấy lý do trong cổng học phí.', 'payment_id' => $id];
    }

    /**
     * @param array<string,mixed> $staff
     * @param array<int,mixed> $ids
     * @return array<string,mixed>
     */
    public function bulkConfirm(array $staff, array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), fn ($x) => $x > 0)));
        if (!$ids) {
            return self::fail('Chưa chọn khoản nào.');
        }
        if (count($ids) > 50) {
            return self::fail('Mỗi lần chỉ xác nhận tối đa 50 khoản.');
        }
        $ok = [];
        $bad = [];
        foreach ($ids as $id) {
            $r = $this->confirm($staff, $id);
            if ($r['ok']) {
                $ok[] = $id;
            } else {
                $bad[] = ['id' => $id, 'message' => $r['message']];
            }
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã xác nhận ' . count($ok) . ' khoản' . ($bad ? ', ' . count($bad) . ' khoản không xác nhận được.' : '.'), 'confirmed' => $ok, 'failed' => $bad];
    }

    /* ================================================================== lịch sử phiếu thu */

    /**
     * @param array<string,mixed> $f q, status, method, from, to, cashier, page, per_page
     * @param array<string,mixed> $staff
     * @return array<string,mixed>
     */
    public function payments(array $f, array $staff): array
    {
        $w = ['1 = 1'];
        $p = [];
        if (!empty($f['q'])) {
            $w[] = '(p.receipt_code LIKE ? OR p.reference LIKE ? OR s.code LIKE ? OR s.full_name LIKE ? OR i.code LIKE ?)';
            $k = '%' . trim((string) $f['q']) . '%';
            array_push($p, $k, $k, $k, $k, $k);
        }
        if (!empty($f['method']) && isset(FeeRepo::METHODS[$f['method']])) {
            $w[] = 'p.method = ?';
            $p[] = $f['method'];
        }
        if (!empty($f['cashier'])) {
            $w[] = 'p.confirmed_by = ?';
            $p[] = (string) $f['cashier'];
        }
        $day = self::DAY;
        if (self::validDate($f['from'] ?? null)) {
            $w[] = "$day >= ?";
            $p[] = $f['from'];
        }
        if (self::validDate($f['to'] ?? null)) {
            $w[] = "$day <= ?";
            $p[] = $f['to'];
        }
        $base = ' FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id JOIN sm_students s ON s.id = p.student_id WHERE ' . implode(' AND ', $w);
        $counts = ['confirmed' => 0, 'pending' => 0, 'rejected' => 0, 'voided' => 0];
        $amounts = ['confirmed' => 0, 'pending' => 0, 'rejected' => 0, 'voided' => 0];
        foreach ($this->all("SELECT p.status, (CASE WHEN p.status = 'cancelled' AND p.confirmed_at IS NOT NULL THEN 1 ELSE 0 END) AS v, COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt $base GROUP BY p.status, (CASE WHEN p.status = 'cancelled' AND p.confirmed_at IS NOT NULL THEN 1 ELSE 0 END)", $p) as $r) {
            $k = $r['status'] === 'cancelled' ? ((int) $r['v'] === 1 ? 'voided' : null) : $r['status'];
            if ($k) {
                $counts[$k] += (int) $r['n'];
                $amounts[$k] += (int) $r['amt'];
            }
        }
        $st = (string) ($f['status'] ?? '');
        $sw = '';
        if ($st === 'voided') {
            $sw = " AND p.status = 'cancelled' AND p.confirmed_at IS NOT NULL";
        } elseif (in_array($st, ['confirmed', 'pending', 'rejected'], true)) {
            $sw = ' AND p.status = ?';
            $p[] = $st;
        }
        $per = min(500, max(1, (int) ($f['per_page'] ?? self::PER_PAGE)));
        $page = max(1, (int) ($f['page'] ?? 1));
        $total = (int) $this->one('SELECT COUNT(*) AS n' . $base . $sw, $p)['n'];
        $rows = $this->all($this->paySelect() . ' WHERE ' . implode(' AND ', $w) . $sw . " ORDER BY COALESCE(p.confirmed_at, p.paid_at) DESC, p.id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $p);

        return [
            'items' => array_map(fn ($r) => $this->payRow($r, $staff), $rows), 'total' => $total, 'page' => $page, 'pages' => $this->pages($total, $per), 'per_page' => $per,
            'counts' => $counts, 'amounts' => $amounts,
        ];
    }

    /* ================================================================== phiếu thu để in */

    /** @return array<string,mixed>|null */
    public function receipt(int $id): ?array
    {
        $p = $this->one('SELECT p.id, p.receipt_code, p.amount, p.method, p.reference, p.payer_note, p.status, p.paid_at, p.confirmed_by, p.confirmed_at, p.reject_reason, p.invoice_id, p.student_id
                           FROM sm_payments p WHERE p.id = ?', [$id]);
        if (!$p) {
            return null;
        }
        $inv = $this->one('SELECT i.id, i.code, i.title, i.total, i.school_year_id, y.label AS year_label FROM sm_invoices i JOIN sm_school_years y ON y.id = i.school_year_id WHERE i.id = ?', [$p['invoice_id']]);
        $stu = $this->one('SELECT s.code, s.full_name, s.birth_date, c.name AS class_name FROM sm_students s
                             LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? LEFT JOIN sm_classes c ON c.id = e.class_id WHERE s.id = ?', [$inv['school_year_id'], $p['student_id']]);
        $lines = $this->all('SELECT description, quantity, unit_price, discount, amount FROM sm_invoice_lines WHERE invoice_id = ? ORDER BY id', [$inv['id']]);
        $before = $this->one("SELECT COALESCE(SUM(amount), 0) AS n FROM sm_payments WHERE invoice_id = ? AND status = 'confirmed' AND (paid_at < ? OR (paid_at = ? AND id <= ?))", [$p['invoice_id'], $p['paid_at'], $p['paid_at'], $p['id']]);
        $s = $this->settings();
        $voided = $p['status'] === 'cancelled' && !empty($p['confirmed_at']);

        return [
            'id' => (int) $p['id'], 'receipt_code' => $p['receipt_code'], 'status' => $voided ? 'voided' : $p['status'], 'reason' => $p['reject_reason'],
            'amount' => (int) $p['amount'], 'amount_words' => FeeRepo::words((int) $p['amount']), 'method_label' => FeeRepo::METHODS[$p['method']] ?? $p['method'],
            'reference' => $p['reference'], 'note' => $p['payer_note'], 'paid_at' => $this->dt($p['paid_at']), 'cashier' => $p['confirmed_by'],
            'remaining_after' => max(0, (int) $inv['total'] - (int) $before['n']),
            'school' => ['name' => $s['school_name'] ?? '', 'address' => $s['school_address'] ?? '', 'hotline' => $s['hotline'] ?? '',
                'footer' => $s['receipt_footer'] ?? '', 'treasurer' => $s['receipt_treasurer'] ?? 'Thủ quỹ', 'accountant' => $s['receipt_accountant'] ?? 'Kế toán thu'],
            'student' => ['code' => $stu['code'], 'name' => $stu['full_name'], 'birth_date' => $this->d($stu['birth_date']), 'class' => $stu['class_name']],
            'invoice' => ['id' => (int) $inv['id'], 'code' => $inv['code'], 'title' => $inv['title'], 'year' => $inv['year_label'], 'total' => (int) $inv['total'],
                'lines' => array_map(fn ($l) => ['description' => $l['description'], 'quantity' => (int) $l['quantity'], 'unit_price' => (int) $l['unit_price'], 'discount' => (int) $l['discount'], 'amount' => (int) $l['amount']], $lines)],
        ];
    }

    /** @param array<string,mixed> $staff @return array<string,mixed> */
    public function void(array $staff, int $id, string $reason): array
    {
        $reason = trim(preg_replace('/\s+/u', ' ', $reason));
        if (mb_strlen($reason) < 5 || mb_strlen($reason) > 180) {
            return self::fail('Lý do hủy phiếu cần từ 5 đến 180 ký tự.', 422, ['errors' => ['reason' => 'Cần 5 đến 180 ký tự']]);
        }
        $p = $this->one('SELECT id, receipt_code, status, amount, confirmed_at, paid_at FROM sm_payments WHERE id = ?', [$id]);
        if (!$p) {
            return self::fail('Không tìm thấy phiếu thu.', 404);
        }
        if ($p['status'] !== 'confirmed') {
            return self::fail('Chỉ hủy được phiếu thu đã xác nhận.', 409);
        }
        $sameDay = substr((string) ($p['confirmed_at'] ?? $p['paid_at']), 0, 10) === $this->today();
        if (!$sameDay && !in_array($staff['role'], self::CAN_VOID_ANY, true)) {
            return self::fail('Kế toán chỉ được hủy phiếu thu trong ngày. Phiếu của ngày trước cần Hiệu trưởng hoặc Phó hiệu trưởng hủy.', 403);
        }
        $n = $this->run("UPDATE sm_payments SET status = 'cancelled', reject_reason = ? WHERE id = ? AND status = 'confirmed'", ['Hủy phiếu: ' . $reason, $id]);
        if (!$n) {
            return self::fail('Phiếu này vừa được xử lý ở nơi khác.', 409);
        }
        $this->log($id, 'void', 'Hủy phiếu ' . number_format((int) $p['amount'], 0, ',', '.') . 'đ. Lý do: ' . $reason, $staff['name']);

        return ['ok' => true, 'status' => 200, 'message' => 'Đã hủy phiếu ' . $p['receipt_code'] . '. Công nợ của hóa đơn được tính lại.'];
    }

    /** @return array<int,array<string,mixed>> */
    public function paymentLog(int $id): array
    {
        return array_map(fn ($l) => ['action' => $l['action'], 'detail' => $l['detail'], 'actor' => $l['actor'], 'at' => $this->dt($l['created_at'])],
            $this->all('SELECT action, detail, actor, created_at FROM sm_payment_log WHERE payment_id = ? ORDER BY id', [$id]));
    }

    /* ================================================================== tổng kết ngày */

    /** @return array<string,mixed> */
    public function daily(?string $date, array $staff): array
    {
        $date = self::validDate($date) ? $date : $this->today();
        $day = self::DAY;
        $rows = $this->all($this->paySelect() . " WHERE p.status = 'confirmed' AND $day = ? ORDER BY COALESCE(p.confirmed_at, p.paid_at), p.id", [$date]);
        $byMethod = [];
        $byCashier = [];
        $total = 0;
        foreach ($rows as $r) {
            $a = (int) $r['amount'];
            $total += $a;
            $byMethod[$r['method']] ??= ['method' => $r['method'], 'label' => FeeRepo::METHODS[$r['method']] ?? $r['method'], 'count' => 0, 'amount' => 0];
            $byMethod[$r['method']]['count']++;
            $byMethod[$r['method']]['amount'] += $a;
            $c = $r['confirmed_by'] ?: '—';
            $byCashier[$c] ??= ['name' => $c, 'count' => 0, 'amount' => 0, 'cash' => 0];
            $byCashier[$c]['count']++;
            $byCashier[$c]['amount'] += $a;
            $byCashier[$c]['cash'] += $r['method'] === 'cash' ? $a : 0;
        }
        $void = $this->one("SELECT COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt FROM sm_payments p WHERE p.status = 'cancelled' AND p.confirmed_at IS NOT NULL AND $day = ?", [$date]);
        $rej = $this->one("SELECT COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt FROM sm_payments p WHERE p.status = 'rejected' AND $day = ?", [$date]);
        $prev = date('Y-m-d', strtotime($date . ' -1 day'));
        $prevAmt = (int) $this->one("SELECT COALESCE(SUM(p.amount), 0) AS n FROM sm_payments p WHERE p.status = 'confirmed' AND $day = ?", [$prev])['n'];
        $cash = $byMethod['cash']['amount'] ?? 0;

        return [
            'date' => $date, 'total' => $total, 'count' => count($rows), 'cash_total' => $cash, 'non_cash_total' => $total - $cash, 'prev_total' => $prevAmt,
            'by_method' => array_values($byMethod), 'by_cashier' => array_values($byCashier),
            'voided' => ['count' => (int) $void['n'], 'amount' => (int) $void['amt']], 'rejected' => ['count' => (int) $rej['n'], 'amount' => (int) $rej['amt']],
            'items' => array_map(fn ($r) => $this->payRow($r, $staff), $rows),
            'school' => ['name' => $this->settings()['school_name'] ?? ''],
        ];
    }

    /* ================================================================== phản hồi hóa đơn của học sinh */

    /**
     * @param array<string,mixed> $f status (open|answered|all)
     * @return array<string,mixed>
     */
    public function disputes(array $f): array
    {
        $st = (string) ($f['status'] ?? 'open');
        $w = in_array($st, ['open', 'answered'], true) ? 'WHERE d.status = ?' : '';
        $rows = $this->all("SELECT d.id, d.invoice_id, i.code AS invoice_code, d.student_id, s.code AS student_code, s.full_name, d.message, d.status, d.reply, d.replied_by, d.created_at, d.replied_at
                              FROM sm_invoice_disputes d JOIN sm_invoices i ON i.id = d.invoice_id JOIN sm_students s ON s.id = d.student_id $w
                             ORDER BY (CASE WHEN d.status = 'open' THEN 0 ELSE 1 END), d.id DESC LIMIT 100", $w ? [$st] : []);
        $cnt = ['open' => 0, 'answered' => 0];
        foreach ($this->all('SELECT status, COUNT(*) AS n FROM sm_invoice_disputes GROUP BY status') as $r) {
            $cnt[$r['status']] = (int) $r['n'];
        }

        return ['items' => array_map(fn ($d) => ['id' => (int) $d['id'], 'invoice_id' => (int) $d['invoice_id'], 'invoice_code' => $d['invoice_code'],
            'student' => ['id' => (int) $d['student_id'], 'code' => $d['student_code'], 'name' => $d['full_name']], 'message' => $d['message'], 'status' => $d['status'],
            'reply' => $d['reply'], 'replied_by' => $d['replied_by'], 'created_at' => $this->dt($d['created_at']), 'replied_at' => $this->dt($d['replied_at'])], $rows), 'counts' => $cnt];
    }

    /** @param array<string,mixed> $staff @return array<string,mixed> */
    public function replyDispute(array $staff, int $id, string $reply): array
    {
        $reply = trim(preg_replace('/\s+/u', ' ', $reply));
        if (mb_strlen($reply) < 5 || mb_strlen($reply) > 1000) {
            return self::fail('Nội dung trả lời cần từ 5 đến 1000 ký tự.', 422, ['errors' => ['reply' => 'Cần 5 đến 1000 ký tự']]);
        }
        if (!$this->one('SELECT id FROM sm_invoice_disputes WHERE id = ?', [$id])) {
            return self::fail('Không tìm thấy phản hồi.', 404);
        }
        $this->run("UPDATE sm_invoice_disputes SET status = 'answered', reply = ?, replied_by = ?, replied_at = ? WHERE id = ?", [$reply, $staff['name'], $this->ts(), $id]);

        return ['ok' => true, 'status' => 200, 'message' => 'Đã gửi trả lời. Học sinh sẽ thấy ở cổng học phí.'];
    }
}
