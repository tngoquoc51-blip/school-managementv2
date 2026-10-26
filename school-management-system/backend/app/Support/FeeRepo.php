<?php

namespace App\Support;

use PDO;

/**
 * Học phí của học sinh (API /api/hs/fees/*): hóa đơn, thanh toán, biên lai, biểu phí, miễn giảm.
 * Dùng PDO + SQL chuẩn trên các bảng sm_invoices, sm_invoice_lines, sm_payments, sm_fee_*.
 */
class FeeRepo
{
    public const METHODS = ['cash' => 'Tiền mặt', 'bank_transfer' => 'Chuyển khoản', 'card' => 'Thẻ (POS)', 'ewallet' => 'Ví điện tử'];
    public const CATEGORIES = ['tuition' => 'Học phí', 'insurance' => 'Bảo hiểm', 'fund' => 'Quỹ', 'service' => 'Dịch vụ', 'uniform' => 'Đồng phục', 'other' => 'Hoạt động khác'];
    public const TERMS = ['YEAR' => 'Đầu năm học', 'HK1' => 'Học kỳ 1', 'HK2' => 'Học kỳ 2'];
    public const MIN_PAYMENT = 10000;
    public const MAX_PENDING_PER_INVOICE = 3;

    /** @var callable */
    private $clock;

    public function __construct(private PDO $pdo, ?callable $clock = null)
    {
        $this->clock = $clock ?? fn () => time();
    }

    /* ---------------------------------------------------------------- tiện ích */

    private function now(): int
    {
        return (int) ($this->clock)();
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

    private function d(?string $v): ?string
    {
        $t = $v ? strtotime(substr($v, 0, 10)) : false;
        return $t ? date('d/m/Y', $t) : null;
    }

    private function dt(?string $v): ?string
    {
        $t = $v ? strtotime($v) : false;
        return $t ? date('d/m/Y H:i', $t) : null;
    }

    /** Đọc số tiền bằng chữ (tiếng Việt). */
    public static function words(int $n): string
    {
        if ($n === 0) {
            return 'Không đồng';
        }
        $dig = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
        $three = function (int $x, bool $full) use ($dig): string {
            $tr = intdiv($x, 100);
            $ch = intdiv($x % 100, 10);
            $dv = $x % 10;
            $s = '';
            if ($tr > 0 || $full) {
                $s .= $dig[$tr] . ' trăm';
            }
            if ($ch > 1) {
                $s .= ' ' . $dig[$ch] . ' mươi';
                if ($dv === 1) {
                    $s .= ' mốt';
                } elseif ($dv === 5) {
                    $s .= ' lăm';
                } elseif ($dv > 0) {
                    $s .= ' ' . $dig[$dv];
                }
            } elseif ($ch === 1) {
                $s .= ' mười';
                if ($dv === 5) {
                    $s .= ' lăm';
                } elseif ($dv > 0) {
                    $s .= ' ' . $dig[$dv];
                }
            } elseif ($dv > 0) {
                $s .= ($tr > 0 || $full ? ' lẻ ' : '') . $dig[$dv];
            }
            return trim($s);
        };
        $units = ['', ' nghìn', ' triệu', ' tỷ'];
        $parts = [];
        $i = 0;
        while ($n > 0) {
            $parts[] = $n % 1000;
            $n = intdiv($n, 1000);
            $i++;
        }
        $out = [];
        for ($k = count($parts) - 1; $k >= 0; $k--) {
            if ($parts[$k] === 0) {
                continue;
            }
            $full = $k < count($parts) - 1;
            $out[] = $three($parts[$k], $full) . $units[$k];
        }
        $s = trim(implode(' ', $out));
        return mb_strtoupper(mb_substr($s, 0, 1)) . mb_substr($s, 1) . ' đồng';
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

    /** Trạng thái thanh toán của hóa đơn. @param array<string,mixed> $r */
    private function view(array $r): array
    {
        $total = (int) $r['total'];
        $paid = (int) ($r['paid'] ?? 0);
        $pending = (int) ($r['pending'] ?? 0);
        $cancelled = ($r['status'] ?? '') === 'cancelled';
        $balance = $cancelled ? 0 : max(0, $total - $paid);
        $status = $cancelled ? 'cancelled' : ($balance === 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid'));
        $due = substr((string) $r['due_date'], 0, 10);
        $overdue = $balance > 0 && $due < $this->today();
        $days = $overdue ? (int) floor((strtotime($this->today()) - strtotime($due)) / 86400) : 0;

        return [
            'id' => (int) $r['id'], 'code' => $r['code'], 'title' => $r['title'], 'term' => $r['term'], 'term_label' => self::TERMS[$r['term']] ?? $r['term'],
            'year_id' => (int) $r['school_year_id'], 'year' => $r['year_label'] ?? null,
            'issue_date' => $this->d($r['issue_date']), 'due_date' => $this->d($r['due_date']), 'due_iso' => $due,
            'subtotal' => (int) $r['subtotal'], 'discount' => (int) $r['discount'], 'total' => $total, 'paid' => $paid, 'balance' => $balance,
            'pending' => $pending, 'status' => $status, 'overdue' => $overdue, 'overdue_days' => $days,
        ];
    }

    private const INVOICE_SELECT = "SELECT i.id, i.code, i.title, i.term, i.school_year_id, i.issue_date, i.due_date, i.subtotal, i.discount, i.total, i.status, y.label AS year_label,
            (SELECT COALESCE(SUM(p.amount), 0) FROM sm_payments p WHERE p.invoice_id = i.id AND p.status = 'confirmed') AS paid,
            (SELECT COALESCE(SUM(p.amount), 0) FROM sm_payments p WHERE p.invoice_id = i.id AND p.status = 'pending') AS pending
          FROM sm_invoices i JOIN sm_school_years y ON y.id = i.school_year_id";

    /* ---------------------------------------------------------------- tổng quan */

    /** @return array<string,mixed> */
    public function summary(int $sid): array
    {
        $inv = array_map(fn ($r) => $this->view($r), $this->all(self::INVOICE_SELECT . ' WHERE i.student_id = ? AND i.status <> ? ORDER BY y.start_date DESC, i.issue_date DESC', [$sid, 'cancelled']));
        $cur = $this->currentYear();
        $yid = (int) $cur['id'];
        $sum = fn (array $list, string $k) => array_sum(array_column($list, $k));
        $curInv = array_values(array_filter($inv, fn ($v) => $v['year_id'] === $yid));
        $open = array_values(array_filter($inv, fn ($v) => $v['balance'] > 0));
        usort($open, fn ($a, $b) => strcmp($a['due_iso'], $b['due_iso']));
        $overdue = array_values(array_filter($open, fn ($v) => $v['overdue']));

        $byYear = [];
        foreach ($inv as $v) {
            $byYear[$v['year_id']] ??= ['year_id' => $v['year_id'], 'year' => $v['year'], 'total' => 0, 'paid' => 0, 'balance' => 0, 'invoices' => 0];
            $byYear[$v['year_id']]['total'] += $v['total'];
            $byYear[$v['year_id']]['paid'] += $v['paid'];
            $byYear[$v['year_id']]['balance'] += $v['balance'];
            $byYear[$v['year_id']]['invoices']++;
        }
        $cat = [];
        foreach ($this->all("SELECT COALESCE(f.category, 'other') AS category, SUM(l.amount) AS amt FROM sm_invoice_lines l JOIN sm_invoices i ON i.id = l.invoice_id
                              LEFT JOIN sm_fee_items f ON f.id = l.fee_item_id WHERE i.student_id = ? AND i.school_year_id = ? AND i.status <> 'cancelled' GROUP BY COALESCE(f.category, 'other')", [$sid, $yid]) as $r) {
            $cat[] = ['key' => $r['category'], 'label' => self::CATEGORIES[$r['category']] ?? $r['category'], 'amount' => (int) $r['amt']];
        }
        $pendingList = $this->all("SELECT p.id, p.amount, p.paid_at, i.code FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id WHERE p.student_id = ? AND p.status = 'pending' ORDER BY p.id DESC", [$sid]);
        $s = $this->settings();

        return [
            'year' => $cur['label'], 'year_id' => $yid,
            'totals' => ['billed' => $sum($inv, 'total'), 'paid' => $sum($inv, 'paid'), 'balance' => $sum($inv, 'balance'), 'discount' => $sum($inv, 'discount'),
                'overdue_amount' => $sum($overdue, 'balance'), 'overdue_count' => count($overdue), 'open_count' => count($open),
                'pending_amount' => array_sum(array_map(fn ($p) => (int) $p['amount'], $pendingList))],
            'current' => ['billed' => $sum($curInv, 'total'), 'paid' => $sum($curInv, 'paid'), 'balance' => $sum($curInv, 'balance'), 'invoices' => count($curInv),
                'percent' => $sum($curInv, 'total') ? (int) round($sum($curInv, 'paid') * 100 / $sum($curInv, 'total')) : 100],
            'next_due' => $open[0] ?? null,
            'pending_payments' => array_map(fn ($p) => ['id' => (int) $p['id'], 'amount' => (int) $p['amount'], 'invoice' => $p['code'], 'paid_at' => $this->dt($p['paid_at'])], $pendingList),
            'by_year' => array_values($byYear), 'by_category' => $cat,
            'waivers' => $this->waivers($sid),
            'contact' => ['office' => $s['office'] ?? '', 'hotline' => $s['hotline'] ?? ''],
        ];
    }

    /** @return array<int,array<string,mixed>> */
    private function waivers(int $sid): array
    {
        return array_map(fn ($w) => ['id' => (int) $w['id'], 'year' => $w['year_label'], 'label' => $w['label'], 'percent' => (int) $w['percent'], 'note' => $w['note'], 'approved_by' => $w['approved_by']],
            $this->all('SELECT w.id, w.label, w.percent, w.note, w.approved_by, y.label AS year_label FROM sm_fee_waivers w JOIN sm_school_years y ON y.id = w.school_year_id WHERE w.student_id = ? ORDER BY y.start_date DESC', [$sid]));
    }

    /* ---------------------------------------------------------------- hóa đơn */

    /** @return array<string,mixed> */
    public function invoices(int $sid, array $f): array
    {
        $where = 'i.student_id = ?';
        $p = [$sid];
        if (!empty($f['year_id'])) {
            $where .= ' AND i.school_year_id = ?';
            $p[] = (int) $f['year_id'];
        }
        $list = array_map(fn ($r) => $this->view($r), $this->all(self::INVOICE_SELECT . " WHERE $where ORDER BY y.start_date DESC, i.issue_date DESC, i.id DESC", $p));
        $counts = ['all' => count($list), 'unpaid' => 0, 'partial' => 0, 'paid' => 0, 'overdue' => 0];
        foreach ($list as $v) {
            if (isset($counts[$v['status']])) {
                $counts[$v['status']]++;
            }
            if ($v['overdue']) {
                $counts['overdue']++;
            }
        }
        $st = (string) ($f['status'] ?? '');
        if ($st === 'overdue') {
            $list = array_values(array_filter($list, fn ($v) => $v['overdue']));
        } elseif (in_array($st, ['unpaid', 'partial', 'paid'], true)) {
            $list = array_values(array_filter($list, fn ($v) => $v['status'] === $st));
        }
        if (!empty($f['q'])) {
            $q = mb_strtolower(trim((string) $f['q']));
            $list = array_values(array_filter($list, fn ($v) => str_contains(mb_strtolower($v['code'] . ' ' . $v['title']), $q)));
        }
        $years = $this->all('SELECT DISTINCT y.id, y.label, y.start_date FROM sm_invoices i JOIN sm_school_years y ON y.id = i.school_year_id WHERE i.student_id = ? ORDER BY y.start_date DESC', [$sid]);

        return ['items' => $list, 'counts' => $counts, 'years' => array_map(fn ($y) => ['id' => (int) $y['id'], 'label' => $y['label']], $years)];
    }

    /** @return array<string,mixed>|null */
    public function invoice(int $sid, int $id): ?array
    {
        $r = $this->one(self::INVOICE_SELECT . ' WHERE i.id = ? AND i.student_id = ?', [$id, $sid]);
        if (!$r) {
            return null;
        }
        $v = $this->view($r);
        $lines = $this->all('SELECT l.id, l.description, l.quantity, l.unit_price, l.discount, l.amount, f.category FROM sm_invoice_lines l LEFT JOIN sm_fee_items f ON f.id = l.fee_item_id WHERE l.invoice_id = ? ORDER BY l.id', [$id]);
        $pays = $this->all('SELECT id, receipt_code, amount, method, reference, payer_note, status, paid_at, confirmed_by, confirmed_at, reject_reason FROM sm_payments WHERE invoice_id = ? ORDER BY paid_at DESC, id DESC', [$id]);
        $disp = $this->all('SELECT id, message, status, reply, replied_by, created_at, replied_at FROM sm_invoice_disputes WHERE invoice_id = ? AND student_id = ? ORDER BY id DESC', [$id, $sid]);
        $s = $this->settings();
        $remaining = max(0, $v['balance'] - $v['pending']);
        $stu = $this->one('SELECT code, full_name FROM sm_students WHERE id = ?', [$sid]);
        $content = trim($v['code'] . ' ' . ($stu['code'] ?? ''));

        return $v + [
            'student' => ['code' => $stu['code'] ?? '', 'name' => $stu['full_name'] ?? ''],
            'lines' => array_map(fn ($l) => ['id' => (int) $l['id'], 'description' => $l['description'], 'category' => $l['category'], 'category_label' => self::CATEGORIES[$l['category'] ?? 'other'] ?? 'Khác',
                'quantity' => (int) $l['quantity'], 'unit_price' => (int) $l['unit_price'], 'discount' => (int) $l['discount'], 'amount' => (int) $l['amount']], $lines),
            'payments' => array_map(fn ($p) => $this->payView($p), $pays),
            'disputes' => array_map(fn ($d) => ['id' => (int) $d['id'], 'message' => $d['message'], 'status' => $d['status'], 'reply' => $d['reply'], 'replied_by' => $d['replied_by'],
                'created_at' => $this->dt($d['created_at']), 'replied_at' => $this->dt($d['replied_at'])], $disp),
            'remaining_payable' => $remaining,
            'can_pay' => $v['status'] !== 'cancelled' && $remaining > 0,
            'pay_info' => [
                'bank_name' => $s['bank_name'] ?? '', 'bank_short' => $s['bank_short'] ?? '', 'bank_bin' => $s['bank_bin'] ?? '', 'account_no' => $s['account_no'] ?? '',
                'account_name' => $s['account_name'] ?? '', 'content' => $content, 'hint' => $s['transfer_hint'] ?? '', 'demo_note' => $s['demo_note'] ?? null,
                'office' => $s['office'] ?? '', 'hotline' => $s['hotline'] ?? '',
            ],
        ];
    }

    /** @param array<string,mixed> $p */
    private function payView(array $p): array
    {
        return [
            'id' => (int) $p['id'], 'receipt_code' => $p['receipt_code'], 'amount' => (int) $p['amount'], 'method' => $p['method'], 'method_label' => self::METHODS[$p['method']] ?? $p['method'],
            'reference' => $p['reference'], 'note' => $p['payer_note'], 'status' => $p['status'], 'paid_at' => $this->dt($p['paid_at']), 'paid_iso' => $p['paid_at'],
            'confirmed_by' => $p['confirmed_by'], 'confirmed_at' => $this->dt($p['confirmed_at'] ?? null), 'reject_reason' => $p['reject_reason'],
        ];
    }

    /* ---------------------------------------------------------------- lịch sử thanh toán + biên lai */

    /** @return array<string,mixed> */
    public function payments(int $sid, array $f): array
    {
        $where = 'p.student_id = ?';
        $par = [$sid];
        if (!empty($f['year_id'])) {
            $where .= ' AND i.school_year_id = ?';
            $par[] = (int) $f['year_id'];
        }
        if (!empty($f['status']) && in_array($f['status'], ['confirmed', 'pending', 'rejected', 'cancelled'], true)) {
            $where .= ' AND p.status = ?';
            $par[] = $f['status'];
        }
        if (!empty($f['method']) && isset(self::METHODS[$f['method']])) {
            $where .= ' AND p.method = ?';
            $par[] = $f['method'];
        }
        $rows = $this->all("SELECT p.id, p.receipt_code, p.amount, p.method, p.reference, p.payer_note, p.status, p.paid_at, p.confirmed_by, p.confirmed_at, p.reject_reason,
                                   i.id AS invoice_id, i.code AS invoice_code, i.title, y.label AS year_label
                              FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id JOIN sm_school_years y ON y.id = i.school_year_id
                             WHERE $where ORDER BY p.paid_at DESC, p.id DESC", $par);
        $total = 0;
        $items = [];
        foreach ($rows as $r) {
            if ($r['status'] === 'confirmed') {
                $total += (int) $r['amount'];
            }
            $items[] = $this->payView($r) + ['invoice_id' => (int) $r['invoice_id'], 'invoice_code' => $r['invoice_code'], 'invoice_title' => $r['title'], 'year' => $r['year_label']];
        }
        $counts = ['confirmed' => 0, 'pending' => 0, 'rejected' => 0, 'cancelled' => 0];
        foreach ($this->all('SELECT status, COUNT(*) AS n FROM sm_payments WHERE student_id = ? GROUP BY status', [$sid]) as $r) {
            $counts[$r['status']] = (int) $r['n'];
        }
        $years = $this->all('SELECT DISTINCT y.id, y.label, y.start_date FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id JOIN sm_school_years y ON y.id = i.school_year_id WHERE p.student_id = ? ORDER BY y.start_date DESC', [$sid]);

        return ['items' => $items, 'confirmed_total' => $total, 'counts' => $counts, 'methods' => self::METHODS,
            'years' => array_map(fn ($y) => ['id' => (int) $y['id'], 'label' => $y['label']], $years)];
    }

    /** @return array<string,mixed>|null */
    public function receipt(int $sid, int $paymentId): ?array
    {
        $p = $this->one("SELECT p.id, p.receipt_code, p.amount, p.method, p.reference, p.paid_at, p.confirmed_by, p.confirmed_at, p.invoice_id FROM sm_payments p
                          WHERE p.id = ? AND p.student_id = ? AND p.status = 'confirmed'", [$paymentId, $sid]);
        if (!$p) {
            return null;
        }
        $inv = $this->invoice($sid, (int) $p['invoice_id']);
        $stu = $this->one('SELECT s.code, s.full_name, s.birth_date, c.name AS class_name FROM sm_students s
                             LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? LEFT JOIN sm_classes c ON c.id = e.class_id WHERE s.id = ?', [$inv['year_id'], $sid]);
        $s = $this->settings();
        // Số còn lại sau lần thu này
        $before = $this->one("SELECT COALESCE(SUM(amount), 0) AS n FROM sm_payments WHERE invoice_id = ? AND status = 'confirmed' AND (paid_at < ? OR (paid_at = ? AND id <= ?))",
            [$p['invoice_id'], $p['paid_at'], $p['paid_at'], $p['id']]);
        $remain = max(0, (int) $inv['total'] - (int) $before['n']);

        return [
            'receipt_code' => $p['receipt_code'], 'amount' => (int) $p['amount'], 'amount_words' => self::words((int) $p['amount']), 'method_label' => self::METHODS[$p['method']] ?? $p['method'],
            'reference' => $p['reference'], 'paid_at' => $this->dt($p['paid_at']), 'cashier' => $p['confirmed_by'], 'remaining_after' => $remain,
            'school' => ['name' => $s['school_name'] ?? '', 'address' => $s['school_address'] ?? '', 'hotline' => $s['hotline'] ?? ''],
            'student' => ['code' => $stu['code'], 'name' => $stu['full_name'], 'birth_date' => $this->d($stu['birth_date']), 'class' => $stu['class_name']],
            'invoice' => ['id' => $inv['id'], 'code' => $inv['code'], 'title' => $inv['title'], 'year' => $inv['year'], 'total' => $inv['total'], 'lines' => $inv['lines']],
        ];
    }

    /* ---------------------------------------------------------------- biểu phí */

    /** @return array<string,mixed> */
    public function catalog(int $sid): array
    {
        $cur = $this->currentYear();
        $e = $this->one('SELECT c.grade, c.name FROM sm_enrollments e JOIN sm_classes c ON c.id = e.class_id WHERE e.student_id = ? AND e.school_year_id = ?', [$sid, (int) $cur['id']]);
        $grade = (int) ($e['grade'] ?? 0);
        $items = $this->all('SELECT id, code, name, category, amount, unit, grade, is_mandatory, note FROM sm_fee_items WHERE grade IS NULL OR grade = ? ORDER BY id', [$grade]);
        $perYear = ['year' => 1, 'năm' => 1, 'học kỳ' => 2, 'lần' => 1];
        $must = 0;
        $opt = 0;
        $groups = [];
        foreach ($items as $it) {
            $times = $perYear[$it['unit']] ?? 1;
            $yearly = (int) $it['amount'] * $times;
            if ((int) $it['is_mandatory'] === 1) {
                $must += $yearly;
            } else {
                $opt += $yearly;
            }
            $groups[$it['category']]['key'] = $it['category'];
            $groups[$it['category']]['label'] = self::CATEGORIES[$it['category']] ?? $it['category'];
            $groups[$it['category']]['items'][] = ['code' => $it['code'], 'name' => $it['name'], 'amount' => (int) $it['amount'], 'unit' => $it['unit'], 'mandatory' => (int) $it['is_mandatory'] === 1, 'note' => $it['note'], 'yearly' => $yearly];
        }

        return ['year' => $cur['label'], 'class' => $e['name'] ?? null, 'grade' => $grade ?: null, 'groups' => array_values($groups), 'mandatory_total' => $must, 'optional_total' => $opt, 'waivers' => $this->waivers($sid)];
    }

    /* ---------------------------------------------------------------- hành động của học sinh */

    /** Học sinh báo đã chuyển khoản / nộp tiền, chờ kế toán xác nhận. */
    public function declare(int $sid, int $invoiceId, int $amount, string $method, ?string $reference, ?string $paidAt, ?string $note): array
    {
        $inv = $this->invoice($sid, $invoiceId);
        if (!$inv) {
            return ['ok' => false, 'status' => 404, 'message' => 'Không tìm thấy hóa đơn.'];
        }
        if (!$inv['can_pay']) {
            return ['ok' => false, 'status' => 422, 'message' => $inv['status'] === 'paid' ? 'Hóa đơn này đã thanh toán đủ.' : 'Hóa đơn không còn khoản nào cần thanh toán (đang chờ xác nhận hoặc đã hủy).'];
        }
        try {
            $ps = $this->one('SELECT p.status, p.name FROM sm_invoices i JOIN sm_fee_periods p ON p.id = i.period_id WHERE i.id = ?', [$invoiceId]);
        } catch (\Throwable $e) {
            $ps = null; // chưa chạy them-dot-thu.sql
        }
        if ($ps && $ps['status'] === 'closed') {
            return ['ok' => false, 'status' => 422, 'message' => 'Đợt thu "' . $ps['name'] . '" đã kết thúc. Vui lòng liên hệ phòng Kế toán để được hỗ trợ.'];
        }
        if (!in_array($method, ['bank_transfer', 'ewallet'], true)) {
            return ['ok' => false, 'status' => 422, 'message' => 'Hình thức thanh toán không hợp lệ.'];
        }
        if ($amount < self::MIN_PAYMENT) {
            return ['ok' => false, 'status' => 422, 'message' => 'Số tiền tối thiểu là ' . number_format(self::MIN_PAYMENT, 0, ',', '.') . 'đ.'];
        }
        if ($amount > $inv['remaining_payable']) {
            return ['ok' => false, 'status' => 422, 'message' => 'Số tiền vượt quá số còn phải đóng (' . number_format($inv['remaining_payable'], 0, ',', '.') . 'đ).'];
        }
        $reference = trim((string) $reference);
        if (strlen($reference) < 4 || mb_strlen($reference) > 60) {
            return ['ok' => false, 'status' => 422, 'message' => 'Vui lòng nhập mã giao dịch (4 đến 60 ký tự) để kế toán đối chiếu.'];
        }
        $t = $paidAt ? strtotime($paidAt) : $this->now();
        if (!$t || $t > $this->now() + 300 || $t < $this->now() - 90 * 86400) {
            return ['ok' => false, 'status' => 422, 'message' => 'Thời điểm chuyển tiền không hợp lệ (không ở tương lai, trong vòng 90 ngày).'];
        }
        $note = trim((string) $note);
        if (mb_strlen($note) > 255) {
            return ['ok' => false, 'status' => 422, 'message' => 'Ghi chú tối đa 255 ký tự.'];
        }
        $pend = (int) ($this->one("SELECT COUNT(*) AS n FROM sm_payments WHERE invoice_id = ? AND status = 'pending'", [$invoiceId])['n'] ?? 0);
        if ($pend >= self::MAX_PENDING_PER_INVOICE) {
            return ['ok' => false, 'status' => 422, 'message' => 'Hóa đơn đang có ' . self::MAX_PENDING_PER_INVOICE . ' khoản chờ xác nhận. Vui lòng đợi kế toán xử lý.'];
        }
        if ($this->one("SELECT id FROM sm_payments WHERE reference = ? AND status IN ('pending', 'confirmed')", [$reference])) {
            return ['ok' => false, 'status' => 422, 'message' => 'Mã giao dịch này đã được ghi nhận trước đó.'];
        }
        $now = date('Y-m-d H:i:s', $this->now());
        $this->pdo->beginTransaction();
        try {
            $this->run('INSERT INTO sm_payments (receipt_code, invoice_id, student_id, amount, method, reference, payer_note, status, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                ['TMP' . bin2hex(random_bytes(6)), $invoiceId, $sid, $amount, $method, $reference, $note !== '' ? $note : null, 'pending', date('Y-m-d H:i:s', $t), $now]);
            $id = (int) $this->pdo->lastInsertId();
            $this->run('UPDATE sm_payments SET receipt_code = ? WHERE id = ?', ['CH' . date('ymd', $this->now()) . str_pad((string) $id, 6, '0', STR_PAD_LEFT), $id]);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã gửi thông tin thanh toán. Kế toán sẽ xác nhận trong 1 đến 2 ngày làm việc.', 'payment_id' => $id];
    }

    public function cancelPending(int $sid, int $paymentId): array
    {
        $n = $this->run("UPDATE sm_payments SET status = 'cancelled' WHERE id = ? AND student_id = ? AND status = 'pending'", [$paymentId, $sid]);
        return $n ? ['ok' => true, 'status' => 200, 'message' => 'Đã hủy khoản thanh toán chờ xác nhận.'] : ['ok' => false, 'status' => 404, 'message' => 'Không tìm thấy khoản chờ xác nhận để hủy.'];
    }

    public function dispute(int $sid, int $invoiceId, string $message): array
    {
        if (!$this->one('SELECT id FROM sm_invoices WHERE id = ? AND student_id = ?', [$invoiceId, $sid])) {
            return ['ok' => false, 'status' => 404, 'message' => 'Không tìm thấy hóa đơn.'];
        }
        $message = trim(preg_replace('/\s+/u', ' ', $message));
        if (mb_strlen($message) < 10 || mb_strlen($message) > 1000) {
            return ['ok' => false, 'status' => 422, 'message' => 'Nội dung phản hồi cần từ 10 đến 1000 ký tự.'];
        }
        if ($this->one("SELECT id FROM sm_invoice_disputes WHERE invoice_id = ? AND student_id = ? AND status = 'open'", [$invoiceId, $sid])) {
            return ['ok' => false, 'status' => 422, 'message' => 'Bạn đã có một phản hồi đang chờ nhà trường trả lời cho hóa đơn này.'];
        }
        $this->run('INSERT INTO sm_invoice_disputes (invoice_id, student_id, message, status, created_at) VALUES (?, ?, ?, ?, ?)', [$invoiceId, $sid, $message, 'open', date('Y-m-d H:i:s', $this->now())]);

        return ['ok' => true, 'status' => 200, 'message' => 'Đã gửi phản hồi tới phòng Kế toán.'];
    }
}
