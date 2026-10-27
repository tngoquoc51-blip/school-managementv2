<?php

namespace App\Support;

use PDO;

/**
 * Sổ phiếu thu / biên lai của Kế toán (API /api/kt/receipts/*).
 *
 *  - Sổ phiếu thu: lọc theo ngày, hình thức, người thu, năm học, đợt thu, khối, lớp, số tiền, đối soát
 *  - In phiếu (lưu nhật ký mỗi lần in để biết phiếu đã in lại mấy lần)
 *  - Đối soát chuyển khoản / POS / ví điện tử với sao kê ngân hàng
 *  - Thống kê thu theo ngày, hình thức, khối, đợt thu, người thu
 *
 * Xem chi tiết một phiếu và hủy phiếu dùng lại API của Quầy thu (/api/kt/cashier/payments/{id}).
 * Dùng PDO + SQL chuẩn nên chạy giống nhau trên MySQL/MariaDB và SQLite (kiểm thử).
 */
class FeeReceiptRepo
{
    public const PER_PAGE = 20;
    public const MAX_PRINT = 50;
    public const MAX_RECON = 200;
    public const SORTS = ['new', 'old', 'amount_desc', 'amount_asc'];

    /** Ngày ghi nhận tiền: ngày xác nhận, nếu chưa có thì ngày thanh toán. */
    private const DAY = 'substr(COALESCE(p.confirmed_at, p.paid_at), 1, 10)';
    /** Chỉ lấy phiếu thu thật: đã xác nhận hoặc đã bị hủy sau khi xác nhận. */
    private const IS_RECEIPT = "(p.status = 'confirmed' OR (p.status = 'cancelled' AND p.confirmed_at IS NOT NULL))";

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

    private function ts(): string
    {
        return date('Y-m-d H:i:s', $this->now());
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

    private static function fail(string $msg, int $status = 422, array $extra = []): array
    {
        return ['ok' => false, 'status' => $status, 'message' => $msg] + $extra;
    }

    private static function validDate(?string $d): bool
    {
        return is_string($d) && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
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

    /**
     * @param array<int,mixed> $ids
     * @return array<int,int>
     */
    private static function cleanIds(array $ids): array
    {
        return array_values(array_unique(array_filter(array_map('intval', $ids), fn ($x) => $x > 0)));
    }

    /* ================================================================== dữ liệu cho bộ lọc */

    /** @return array<string,mixed> */
    public function meta(): array
    {
        $years = array_map(fn ($y) => ['id' => (int) $y['id'], 'label' => $y['label'], 'is_current' => (int) $y['is_current'] === 1],
            $this->all('SELECT id, label, is_current FROM sm_school_years ORDER BY start_date DESC'));
        $cur = 0;
        foreach ($years as $y) {
            if ($y['is_current']) {
                $cur = $y['id'];
            }
        }
        $periods = array_map(fn ($p) => ['id' => (int) $p['id'], 'code' => $p['code'], 'name' => $p['name'], 'year_id' => (int) $p['school_year_id'], 'status' => $p['status']],
            $this->all("SELECT id, code, name, school_year_id, status FROM sm_fee_periods WHERE status <> 'draft' ORDER BY school_year_id DESC, id DESC LIMIT 60"));
        $classes = array_map(fn ($c) => ['id' => (int) $c['id'], 'name' => $c['name'], 'grade' => (int) $c['grade']],
            $this->all('SELECT id, name, grade FROM sm_classes WHERE school_year_id = ? ORDER BY grade, name', [$cur]));
        $cashiers = array_column($this->all("SELECT DISTINCT confirmed_by FROM sm_payments WHERE confirmed_by IS NOT NULL AND confirmed_by <> '' ORDER BY confirmed_by"), 'confirmed_by');
        $methods = [];
        foreach (FeeRepo::METHODS as $k => $v) {
            $methods[] = ['key' => $k, 'label' => $v, 'needs_ref' => $k !== 'cash'];
        }

        return ['years' => $years, 'periods' => $periods, 'classes' => $classes, 'cashiers' => $cashiers, 'methods' => $methods, 'grades' => [10, 11, 12], 'today' => $this->today()];
    }

    /* ================================================================== sổ phiếu thu */

    private const FROM = ' FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id JOIN sm_students s ON s.id = p.student_id
        LEFT JOIN sm_enrollments e ON e.student_id = p.student_id AND e.school_year_id = i.school_year_id LEFT JOIN sm_classes c ON c.id = e.class_id
        LEFT JOIN sm_fee_periods fp ON fp.id = i.period_id LEFT JOIN sm_payment_recon r ON r.payment_id = p.id';

    /**
     * Điều kiện lọc chung (không gồm trạng thái và đối soát để tính số liệu tổng hợp đúng).
     *
     * @param array<string,mixed> $f
     * @return array{0:array<int,string>,1:array<int,mixed>}
     */
    private function baseWhere(array $f): array
    {
        $w = [self::IS_RECEIPT];
        $p = [];
        $q = trim((string) ($f['q'] ?? ''));
        if ($q !== '') {
            $w[] = '(p.receipt_code LIKE ? OR p.reference LIKE ? OR s.code LIKE ? OR s.full_name LIKE ? OR i.code LIKE ?)';
            array_push($p, ...array_fill(0, 5, '%' . $q . '%'));
        }
        if (!empty($f['method']) && isset(FeeRepo::METHODS[$f['method']])) {
            $w[] = 'p.method = ?';
            $p[] = $f['method'];
        }
        if (!empty($f['cashier'])) {
            $w[] = 'p.confirmed_by = ?';
            $p[] = (string) $f['cashier'];
        }
        if (self::validDate($f['from'] ?? null)) {
            $w[] = self::DAY . ' >= ?';
            $p[] = $f['from'];
        }
        if (self::validDate($f['to'] ?? null)) {
            $w[] = self::DAY . ' <= ?';
            $p[] = $f['to'];
        }
        if (!empty($f['year_id'])) {
            $w[] = 'i.school_year_id = ?';
            $p[] = (int) $f['year_id'];
        }
        if (!empty($f['period_id'])) {
            $w[] = 'i.period_id = ?';
            $p[] = (int) $f['period_id'];
        }
        if (!empty($f['grade'])) {
            $w[] = 'c.grade = ?';
            $p[] = (int) $f['grade'];
        }
        if (!empty($f['class_id'])) {
            $w[] = 'c.id = ?';
            $p[] = (int) $f['class_id'];
        }
        if (isset($f['min']) && is_numeric($f['min']) && (int) $f['min'] > 0) {
            $w[] = 'p.amount >= ?';
            $p[] = (int) $f['min'];
        }
        if (isset($f['max']) && is_numeric($f['max']) && (int) $f['max'] > 0) {
            $w[] = 'p.amount <= ?';
            $p[] = (int) $f['max'];
        }
        return [$w, $p];
    }

    /**
     * @param array<string,mixed> $f q, status (valid|voided), method, cashier, from, to, year_id, period_id, grade, class_id, min, max, recon (todo|done), sort, page, per_page
     * @param array<string,mixed> $staff
     * @return array<string,mixed>
     */
    public function index(array $f, array $staff): array
    {
        [$w, $p] = $this->baseWhere($f);
        $base = self::FROM . ' WHERE ' . implode(' AND ', $w);

        // Số liệu tổng hợp cho bộ lọc hiện tại (không phụ thuộc trạng thái / đối soát đang chọn)
        $sum = ['valid' => ['count' => 0, 'amount' => 0], 'voided' => ['count' => 0, 'amount' => 0]];
        $recon = ['todo' => ['count' => 0, 'amount' => 0], 'done' => ['count' => 0, 'amount' => 0]];
        $byMethod = [];
        foreach ($this->all("SELECT p.status, p.method, (CASE WHEN r.payment_id IS NULL THEN 0 ELSE 1 END) AS rc, COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt $base GROUP BY p.status, p.method, (CASE WHEN r.payment_id IS NULL THEN 0 ELSE 1 END)", $p) as $r) {
            $k = $r['status'] === 'confirmed' ? 'valid' : 'voided';
            $sum[$k]['count'] += (int) $r['n'];
            $sum[$k]['amount'] += (int) $r['amt'];
            if ($k === 'valid') {
                $byMethod[$r['method']] ??= ['method' => $r['method'], 'label' => FeeRepo::METHODS[$r['method']] ?? $r['method'], 'count' => 0, 'amount' => 0];
                $byMethod[$r['method']]['count'] += (int) $r['n'];
                $byMethod[$r['method']]['amount'] += (int) $r['amt'];
                if ($r['method'] !== 'cash') {
                    $rk = (int) $r['rc'] === 1 ? 'done' : 'todo';
                    $recon[$rk]['count'] += (int) $r['n'];
                    $recon[$rk]['amount'] += (int) $r['amt'];
                }
            }
        }

        // Lọc theo trạng thái / đối soát cho danh sách
        $w2 = $w;
        $p2 = $p;
        $st = (string) ($f['status'] ?? 'valid');
        if ($st === 'voided') {
            $w2[] = "p.status = 'cancelled'";
        } elseif ($st !== 'all') {
            $w2[] = "p.status = 'confirmed'";
        }
        $rc = (string) ($f['recon'] ?? '');
        if ($rc === 'todo') {
            $w2[] = "p.status = 'confirmed' AND p.method <> 'cash' AND r.payment_id IS NULL";
        } elseif ($rc === 'done') {
            $w2[] = "p.status = 'confirmed' AND p.method <> 'cash' AND r.payment_id IS NOT NULL";
        } elseif ($rc === 'noncash') {
            $w2[] = "p.method <> 'cash'";
        }
        $where = ' WHERE ' . implode(' AND ', $w2);
        $per = min(500, max(1, (int) ($f['per_page'] ?? self::PER_PAGE)));
        $page = max(1, (int) ($f['page'] ?? 1));
        $sort = in_array($f['sort'] ?? '', self::SORTS, true) ? $f['sort'] : 'new';
        $order = match ($sort) {
            'old' => 'COALESCE(p.confirmed_at, p.paid_at) ASC, p.id ASC',
            'amount_desc' => 'p.amount DESC, p.id DESC',
            'amount_asc' => 'p.amount ASC, p.id ASC',
            default => 'COALESCE(p.confirmed_at, p.paid_at) DESC, p.id DESC',
        };
        $total = (int) $this->one('SELECT COUNT(*) AS n' . self::FROM . $where, $p2)['n'];
        $filteredAmount = (int) $this->one('SELECT COALESCE(SUM(p.amount), 0) AS n' . self::FROM . $where, $p2)['n'];
        $rows = $this->all("SELECT p.id, p.receipt_code, p.amount, p.method, p.reference, p.payer_note, p.status, p.paid_at, p.confirmed_by, p.confirmed_at, p.reject_reason,
                   s.id AS student_id, s.code AS student_code, s.full_name AS student_name, c.name AS class_name, c.grade AS grade,
                   i.id AS invoice_id, i.code AS invoice_code, i.title AS invoice_title, fp.id AS period_id, fp.code AS period_code, fp.name AS period_name,
                   r.reconciled_by, r.reconciled_at, r.note AS recon_note,
                   (SELECT COUNT(*) FROM sm_payment_log l WHERE l.payment_id = p.id AND l.action = 'print') AS prints"
            . self::FROM . $where . " ORDER BY $order LIMIT $per OFFSET " . (($page - 1) * $per), $p2);

        $today = $this->today();
        $items = array_map(function ($r) use ($staff, $today) {
            $voided = $r['status'] === 'cancelled';
            $isCash = $r['method'] === 'cash';
            return [
                'id' => (int) $r['id'], 'receipt_code' => $r['receipt_code'], 'amount' => (int) $r['amount'],
                'method' => $r['method'], 'method_label' => FeeRepo::METHODS[$r['method']] ?? $r['method'], 'reference' => $r['reference'], 'note' => $r['payer_note'],
                'status' => $voided ? 'voided' : 'valid', 'reason' => $voided ? $r['reject_reason'] : null,
                'paid_at' => $this->dt($r['paid_at']), 'confirmed_at' => $this->dt($r['confirmed_at']), 'day' => substr((string) ($r['confirmed_at'] ?? $r['paid_at']), 0, 10), 'cashier' => $r['confirmed_by'],
                'student' => ['id' => (int) $r['student_id'], 'code' => $r['student_code'], 'name' => $r['student_name'], 'class' => $r['class_name'], 'grade' => $r['grade'] !== null ? (int) $r['grade'] : null],
                'invoice' => ['id' => (int) $r['invoice_id'], 'code' => $r['invoice_code'], 'title' => $r['invoice_title']],
                'period' => $r['period_id'] ? ['id' => (int) $r['period_id'], 'code' => $r['period_code'], 'name' => $r['period_name']] : null,
                'prints' => (int) $r['prints'],
                'recon' => $r['reconciled_at'] ? ['by' => $r['reconciled_by'], 'at' => $this->dt($r['reconciled_at']), 'note' => $r['recon_note']] : null,
                'needs_recon' => !$isCash && !$voided,
                'can_void' => !$voided && (in_array($staff['role'], FeeCashierRepo::CAN_VOID_ANY, true) || substr((string) ($r['confirmed_at'] ?? $r['paid_at']), 0, 10) === $today),
            ];
        }, $rows);

        return [
            'items' => $items, 'total' => $total, 'page' => $page, 'pages' => max(1, (int) ceil($total / $per)), 'per_page' => $per, 'filtered_amount' => $filteredAmount,
            'summary' => ['valid' => $sum['valid'], 'voided' => $sum['voided'], 'recon' => $recon, 'by_method' => array_values($byMethod)],
        ];
    }

    /* ================================================================== in phiếu (lưu nhật ký) */

    /**
     * @param array<string,mixed> $staff
     * @param array<int,mixed> $ids
     * @return array<string,mixed>
     */
    public function markPrinted(array $staff, array $ids): array
    {
        $ids = self::cleanIds($ids);
        if (!$ids) {
            return self::fail('Chưa chọn phiếu nào.');
        }
        if (count($ids) > self::MAX_PRINT) {
            return self::fail('Mỗi lần in tối đa ' . self::MAX_PRINT . ' phiếu.');
        }
        $rows = $this->all('SELECT id, receipt_code FROM sm_payments WHERE id IN (' . implode(',', $ids) . ") AND status = 'confirmed'");
        $counts = [];
        foreach ($rows as $r) {
            $n = (int) $this->one("SELECT COUNT(*) AS n FROM sm_payment_log WHERE payment_id = ? AND action = 'print'", [$r['id']])['n'];
            $this->log((int) $r['id'], 'print', $n === 0 ? 'In phiếu lần đầu' : 'In lại lần ' . ($n + 1), $staff['name']);
            $counts[(int) $r['id']] = $n + 1;
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã ghi nhận lần in của ' . count($counts) . ' phiếu.', 'prints' => $counts];
    }

    /* ================================================================== đối soát với sao kê */

    /**
     * @param array<string,mixed> $staff
     * @param array<int,mixed> $ids
     * @return array<string,mixed>
     */
    public function reconcile(array $staff, array $ids, string $note): array
    {
        $ids = self::cleanIds($ids);
        if (!$ids) {
            return self::fail('Chưa chọn phiếu nào để đối soát.');
        }
        if (count($ids) > self::MAX_RECON) {
            return self::fail('Mỗi lần đối soát tối đa ' . self::MAX_RECON . ' phiếu.');
        }
        $note = trim(preg_replace('/\s+/u', ' ', $note));
        if (mb_strlen($note) > 200) {
            return self::fail('Ghi chú đối soát tối đa 200 ký tự.');
        }
        $rows = $this->all("SELECT p.id, p.method, p.status, p.amount, (SELECT COUNT(*) FROM sm_payment_recon r WHERE r.payment_id = p.id) AS done FROM sm_payments p WHERE p.id IN (" . implode(',', $ids) . ')');
        $ok = 0;
        $skip = [];
        $amount = 0;
        $this->pdo->beginTransaction();
        try {
            foreach ($rows as $r) {
                if ($r['status'] !== 'confirmed' || $r['method'] === 'cash') {
                    $skip[] = (int) $r['id'];
                    continue;
                }
                if ((int) $r['done'] > 0) {
                    continue;
                }
                $this->run('INSERT INTO sm_payment_recon (payment_id, reconciled_by, reconciled_at, note) VALUES (?, ?, ?, ?)', [(int) $r['id'], $staff['name'], $this->ts(), $note !== '' ? $note : null]);
                $this->log((int) $r['id'], 'recon', 'Đã đối soát với sao kê' . ($note !== '' ? ': ' . $note : ''), $staff['name']);
                $ok++;
                $amount += (int) $r['amount'];
            }
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
        if ($ok === 0 && $skip) {
            return self::fail('Chỉ đối soát được phiếu chuyển khoản, POS hoặc ví điện tử còn hiệu lực. Tiền mặt đối chiếu ở Tổng kết ngày.');
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã đối soát ' . $ok . ' phiếu' . ($ok ? ', tổng ' . number_format($amount, 0, ',', '.') . 'đ.' : '.'), 'reconciled' => $ok, 'amount' => $amount, 'skipped' => $skip];
    }

    /**
     * @param array<string,mixed> $staff
     * @param array<int,mixed> $ids
     * @return array<string,mixed>
     */
    public function unreconcile(array $staff, array $ids): array
    {
        $ids = self::cleanIds($ids);
        if (!$ids) {
            return self::fail('Chưa chọn phiếu nào.');
        }
        if (count($ids) > self::MAX_RECON) {
            return self::fail('Mỗi lần tối đa ' . self::MAX_RECON . ' phiếu.');
        }
        $n = 0;
        foreach ($ids as $id) {
            if ($this->run('DELETE FROM sm_payment_recon WHERE payment_id = ?', [$id])) {
                $this->log($id, 'unrecon', 'Bỏ đánh dấu đã đối soát', $staff['name']);
                $n++;
            }
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã bỏ đối soát ' . $n . ' phiếu.', 'count' => $n];
    }

    /* ================================================================== thống kê */

    /**
     * @param array<string,mixed> $f days (7|30|90|180|365), year_id
     * @return array<string,mixed>
     */
    public function stats(array $f): array
    {
        $days = in_array((int) ($f['days'] ?? 30), [7, 30, 90, 180, 365], true) ? (int) $f['days'] : 30;
        $to = $this->today();
        $from = date('Y-m-d', strtotime($to . ' -' . ($days - 1) . ' day'));
        $day = self::DAY;
        $w = "p.status = 'confirmed' AND $day >= ? AND $day <= ?";
        $par = [$from, $to];
        $from2 = self::FROM;

        $series = [];
        for ($i = 0; $i < $days; $i++) {
            $series[date('Y-m-d', strtotime($from . " +$i day"))] = ['date' => date('Y-m-d', strtotime($from . " +$i day")), 'amount' => 0, 'count' => 0];
        }
        $total = 0;
        $count = 0;
        foreach ($this->all("SELECT $day AS d, COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt FROM sm_payments p WHERE $w GROUP BY $day", $par) as $r) {
            if (isset($series[$r['d']])) {
                $series[$r['d']]['amount'] = (int) $r['amt'];
                $series[$r['d']]['count'] = (int) $r['n'];
            }
            $total += (int) $r['amt'];
            $count += (int) $r['n'];
        }
        $best = null;
        foreach ($series as $s) {
            if ($s['amount'] > 0 && (!$best || $s['amount'] > $best['amount'])) {
                $best = $s;
            }
        }

        $group = function (string $sql) use ($par): array {
            return $this->all($sql, $par);
        };
        $byMethod = array_map(fn ($r) => ['key' => $r['k'], 'label' => FeeRepo::METHODS[$r['k']] ?? $r['k'], 'count' => (int) $r['n'], 'amount' => (int) $r['amt']],
            $group("SELECT p.method AS k, COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt FROM sm_payments p WHERE $w GROUP BY p.method ORDER BY amt DESC"));
        $byGrade = array_map(fn ($r) => ['key' => $r['k'] !== null ? (string) $r['k'] : '—', 'label' => $r['k'] !== null ? 'Khối ' . $r['k'] : 'Chưa xếp lớp', 'count' => (int) $r['n'], 'amount' => (int) $r['amt']],
            $group("SELECT c.grade AS k, COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt $from2 WHERE $w GROUP BY c.grade ORDER BY c.grade"));
        $byPeriod = array_map(fn ($r) => ['key' => (string) ($r['k'] ?? 0), 'label' => $r['name'] ?? 'Hóa đơn ngoài đợt thu', 'code' => $r['code'], 'count' => (int) $r['n'], 'amount' => (int) $r['amt']],
            $group("SELECT fp.id AS k, fp.name AS name, fp.code AS code, COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt $from2 WHERE $w GROUP BY fp.id, fp.name, fp.code ORDER BY amt DESC LIMIT 8"));
        $byCashier = array_map(fn ($r) => ['key' => (string) $r['k'], 'label' => $r['k'] ?: '—', 'count' => (int) $r['n'], 'amount' => (int) $r['amt']],
            $group("SELECT p.confirmed_by AS k, COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt FROM sm_payments p WHERE $w GROUP BY p.confirmed_by ORDER BY amt DESC LIMIT 8"));

        // Tháng này (tính đến hôm nay) so với tháng trước
        $m0 = substr($to, 0, 8) . '01';
        $pm = date('Y-m-d', strtotime($m0 . ' -1 month'));
        $monthSum = fn (string $a, string $b) => $this->one("SELECT COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt FROM sm_payments p WHERE p.status = 'confirmed' AND $day >= ? AND $day <= ?", [$a, $b]);
        $thisM = $monthSum($m0, $to);
        $lastM = $monthSum($pm, date('Y-m-d', strtotime($m0 . ' -1 day')));
        // Cùng kỳ (từ đầu tháng trước đến cùng số ngày) để so sánh công bằng
        $dayN = (int) substr($to, 8, 2);
        $lastSame = $monthSum($pm, date('Y-m-d', strtotime($pm . ' +' . ($dayN - 1) . ' day')));

        $nc = $this->one("SELECT COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt, COALESCE(SUM(CASE WHEN r.payment_id IS NULL THEN 0 ELSE p.amount END), 0) AS done_amt,
                                 COALESCE(SUM(CASE WHEN r.payment_id IS NULL THEN 0 ELSE 1 END), 0) AS done_n
                            FROM sm_payments p LEFT JOIN sm_payment_recon r ON r.payment_id = p.id WHERE $w AND p.method <> 'cash'", $par);
        $voided = $this->one("SELECT COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amt FROM sm_payments p WHERE p.status = 'cancelled' AND p.confirmed_at IS NOT NULL AND $day >= ? AND $day <= ?", $par);

        return [
            'days' => $days, 'from' => $from, 'to' => $to,
            'total' => $total, 'count' => $count, 'avg_day' => (int) round($total / $days), 'best_day' => $best,
            'series' => array_values($series), 'by_method' => $byMethod, 'by_grade' => $byGrade, 'by_period' => $byPeriod, 'by_cashier' => $byCashier,
            'month' => ['this' => ['count' => (int) $thisM['n'], 'amount' => (int) $thisM['amt']], 'last' => ['count' => (int) $lastM['n'], 'amount' => (int) $lastM['amt']], 'last_same' => ['count' => (int) $lastSame['n'], 'amount' => (int) $lastSame['amt']]],
            'recon' => ['count' => (int) $nc['n'], 'amount' => (int) $nc['amt'], 'done_count' => (int) $nc['done_n'], 'done_amount' => (int) $nc['done_amt']],
            'voided' => ['count' => (int) $voided['n'], 'amount' => (int) $voided['amt']],
        ];
    }
}
