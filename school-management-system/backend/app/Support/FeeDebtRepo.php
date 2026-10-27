<?php

namespace App\Support;

use PDO;

/**
 * Công nợ học phí cho Kế toán (/api/kt/debts/*).
 * Công nợ = tổng hóa đơn (trừ hóa đơn đã hủy) − tiền đã xác nhận. Quá hạn khi hạn nộp đã qua.
 * Ghi chú liên hệ và hẹn trả lưu ở sm_debt_notes (them-cong-no.sql).
 */
class FeeDebtRepo
{
    public const PER_PAGE = 20;
    public const MAX_PER = 500;
    public const BUCKETS = [
        'notdue' => 'Chưa đến hạn', 'd1_30' => 'Quá hạn 1–30 ngày', 'd31_60' => 'Quá hạn 31–60 ngày',
        'd61_90' => 'Quá hạn 61–90 ngày', 'd90p' => 'Quá hạn trên 90 ngày',
    ];
    public const CHANNELS = ['phone' => 'Gọi điện', 'zalo' => 'Zalo', 'sms' => 'Tin nhắn', 'direct' => 'Gặp trực tiếp', 'email' => 'Email', 'other' => 'Khác'];
    public const SORTS = ['balance_desc', 'overdue_desc', 'days_desc', 'name', 'class'];

    /** @var callable */
    private $clock;

    public function __construct(private PDO $pdo, ?callable $clock = null)
    {
        $this->clock = $clock ?? fn () => time();
    }

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

    private function currentYearId(): int
    {
        $r = $this->one('SELECT id FROM sm_school_years WHERE is_current = 1') ?? $this->one('SELECT id FROM sm_school_years ORDER BY start_date DESC');
        return (int) ($r['id'] ?? 0);
    }

    private static function bucket(int $days): string
    {
        return $days <= 0 ? 'notdue' : ($days <= 30 ? 'd1_30' : ($days <= 60 ? 'd31_60' : ($days <= 90 ? 'd61_90' : 'd90p')));
    }

    /* ================================================================== dữ liệu cho bộ lọc */

    /** @return array<string,mixed> */
    public function meta(): array
    {
        $years = array_map(fn ($y) => ['id' => (int) $y['id'], 'label' => $y['label'], 'is_current' => (int) $y['is_current'] === 1],
            $this->all('SELECT id, label, is_current FROM sm_school_years ORDER BY start_date DESC'));
        $periods = array_map(fn ($p) => ['id' => (int) $p['id'], 'code' => $p['code'], 'name' => $p['name'], 'year_id' => (int) $p['school_year_id']],
            $this->all("SELECT id, code, name, school_year_id FROM sm_fee_periods WHERE status <> 'draft' ORDER BY school_year_id DESC, id DESC LIMIT 60"));
        $classes = array_map(fn ($c) => ['id' => (int) $c['id'], 'name' => $c['name'], 'grade' => (int) $c['grade']],
            $this->all('SELECT c.id, c.name, c.grade FROM sm_classes c WHERE c.school_year_id = ? ORDER BY c.grade, c.name', [$this->currentYearId()]));
        $b = [];
        foreach (self::BUCKETS as $k => $l) {
            $b[] = ['key' => $k, 'label' => $l];
        }
        $ch = [];
        foreach (self::CHANNELS as $k => $l) {
            $ch[] = ['key' => $k, 'label' => $l];
        }

        return ['years' => $years, 'periods' => $periods, 'classes' => $classes, 'grades' => [10, 11, 12], 'buckets' => $b, 'channels' => $ch, 'today' => $this->today()];
    }

    /* ================================================================== tính công nợ */

    /**
     * Hóa đơn (không gồm đã hủy) kèm tiền đã thu, theo bộ lọc nền (năm học, đợt thu, khối, lớp, từ khóa).
     *
     * @param array<string,mixed> $f
     * @return array<int,array<string,mixed>>
     */
    private function invoices(array $f, ?int $studentId = null): array
    {
        $w = ["i.status <> 'cancelled'"];
        $p = [$this->currentYearId()];
        if ($studentId !== null) {
            $w[] = 'i.student_id = ?';
            $p[] = $studentId;
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
        $q = trim((string) ($f['q'] ?? ''));
        if ($q !== '') {
            $w[] = '(s.code LIKE ? OR s.full_name LIKE ?)';
            $p[] = '%' . $q . '%';
            $p[] = '%' . $q . '%';
        }
        $rows = $this->all("SELECT i.id, i.code, i.title, i.student_id, i.school_year_id, i.due_date, i.total, i.period_id,
                   s.code AS scode, s.full_name AS sname, c.id AS cid, c.name AS cname, c.grade, fp.name AS pname, y.label AS ylabel,
                   COALESCE(pp.paid, 0) AS paid, COALESCE(pp.pend, 0) AS pending
              FROM sm_invoices i JOIN sm_students s ON s.id = i.student_id
              LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ?
              LEFT JOIN sm_classes c ON c.id = e.class_id
              LEFT JOIN sm_fee_periods fp ON fp.id = i.period_id
              LEFT JOIN sm_school_years y ON y.id = i.school_year_id
              LEFT JOIN (SELECT invoice_id, SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END) AS paid, SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pend
                           FROM sm_payments WHERE status IN ('confirmed', 'pending') GROUP BY invoice_id) pp ON pp.invoice_id = i.id
             WHERE " . implode(' AND ', $w) . ' ORDER BY i.due_date, i.id', $p);
        $today = strtotime($this->today());
        foreach ($rows as &$r) {
            $r['total'] = (int) $r['total'];
            $r['paid'] = (int) $r['paid'];
            $r['pending'] = (int) $r['pending'];
            $r['balance'] = max(0, $r['total'] - $r['paid']);
            $due = strtotime(substr((string) $r['due_date'], 0, 10));
            $r['days'] = $r['balance'] > 0 && $due && $due < $today ? (int) floor(($today - $due) / 86400) : 0;
            $r['bucket'] = $r['balance'] > 0 ? self::bucket($r['days']) : null;
        }
        unset($r);

        return $rows;
    }

    /**
     * Gộp theo học sinh.
     *
     * @param array<int,array<string,mixed>> $inv
     * @return array<int,array<string,mixed>>
     */
    private function byStudent(array $inv): array
    {
        $o = [];
        foreach ($inv as $r) {
            $id = (int) $r['student_id'];
            $o[$id] ??= [
                'id' => $id, 'code' => $r['scode'], 'name' => $r['sname'], 'class' => $r['cname'], 'class_id' => $r['cid'] !== null ? (int) $r['cid'] : null,
                'grade' => $r['grade'] !== null ? (int) $r['grade'] : null,
                'billed' => 0, 'paid' => 0, 'pending' => 0, 'balance' => 0, 'overdue' => 0, 'max_days' => 0, 'open_invoices' => 0, 'overdue_invoices' => 0, 'oldest_due' => null,
            ];
            $s = &$o[$id];
            $s['billed'] += $r['total'];
            $s['paid'] += $r['paid'];
            $s['pending'] += $r['pending'];
            $s['balance'] += $r['balance'];
            if ($r['balance'] > 0) {
                $s['open_invoices']++;
                $d = substr((string) $r['due_date'], 0, 10);
                if ($s['oldest_due'] === null || $d < $s['oldest_due']) {
                    $s['oldest_due'] = $d;
                }
                if ($r['days'] > 0) {
                    $s['overdue'] += $r['balance'];
                    $s['overdue_invoices']++;
                    $s['max_days'] = max($s['max_days'], $r['days']);
                }
            }
            unset($s);
        }
        foreach ($o as &$s) {
            $s['bucket'] = $s['balance'] > 0 ? self::bucket($s['max_days']) : null;
            $s['state'] = $s['balance'] <= 0 ? 'paid' : ($s['paid'] <= 0 ? 'unpaid' : 'partial');
            $s['paid_pct'] = $s['billed'] > 0 ? (int) round($s['paid'] * 100 / $s['billed']) : 100;
        }
        unset($s);

        return $o;
    }

    /**
     * Ghi chú và hẹn trả gần nhất của từng học sinh.
     *
     * @return array<int,array<string,mixed>>
     */
    private function notesIndex(): array
    {
        $today = $this->today();
        $o = [];
        foreach ($this->all('SELECT * FROM sm_debt_notes ORDER BY id DESC LIMIT 20000') as $n) {
            $sid = (int) $n['student_id'];
            $o[$sid] ??= ['notes' => 0, 'last' => null, 'promise' => null];
            $o[$sid]['notes']++;
            if ($o[$sid]['last'] === null) {
                $o[$sid]['last'] = ['kind' => $n['kind'], 'text' => $n['note'], 'at' => $this->dt($n['created_at']), 'by' => $n['created_by']];
            }
            if ($n['kind'] === 'promise' && $n['status'] === 'open') {
                $pr = ['id' => (int) $n['id'], 'date' => $n['promise_date'], 'amount' => (int) $n['promise_amount'], 'late' => $n['promise_date'] < $today];
                if ($o[$sid]['promise'] === null || $pr['date'] < $o[$sid]['promise']['date']) {
                    $o[$sid]['promise'] = $pr;
                }
            }
        }

        return $o;
    }

    /* ================================================================== danh sách học sinh còn nợ */

    /**
     * @param array<string,mixed> $f q, year_id, period_id, grade, class_id (lọc nền) · state, bucket, promise, min, sort, page, per_page
     * @return array<string,mixed>
     */
    public function index(array $f): array
    {
        $inv = $this->invoices($f);
        $all = $this->byStudent($inv);
        $notes = $this->notesIndex();
        $debtors = array_filter($all, fn ($s) => $s['balance'] > 0);

        // Số liệu tổng hợp theo bộ lọc nền (không phụ thuộc chip trạng thái)
        $aging = [];
        foreach (self::BUCKETS as $k => $l) {
            $aging[$k] = ['key' => $k, 'label' => $l, 'count' => 0, 'amount' => 0];
        }
        $sum = ['students' => count($debtors), 'balance' => 0, 'overdue' => 0, 'overdue_students' => 0, 'unpaid' => 0, 'partial' => 0, 'pending' => 0, 'billed' => 0, 'paid' => 0, 'promise_open' => 0, 'promise_late' => 0];
        foreach ($all as $s) {
            $sum['billed'] += $s['billed'];
            $sum['paid'] += $s['paid'];
        }
        foreach ($debtors as $id => $s) {
            $sum['balance'] += $s['balance'];
            $sum['overdue'] += $s['overdue'];
            $sum['pending'] += $s['pending'];
            $sum['overdue_students'] += $s['overdue'] > 0 ? 1 : 0;
            $sum[$s['state']]++;
            $aging[$s['bucket']]['count']++;
            $aging[$s['bucket']]['amount'] += $s['balance'];
            $pr = $notes[$id]['promise'] ?? null;
            if ($pr) {
                $sum[$pr['late'] ? 'promise_late' : 'promise_open']++;
            }
        }
        $sum['collect_pct'] = $sum['billed'] > 0 ? round($sum['paid'] * 100 / $sum['billed'], 1) : 100.0;

        // Lọc theo chip
        $state = (string) ($f['state'] ?? 'all');
        $bucket = (string) ($f['bucket'] ?? '');
        $promise = (string) ($f['promise'] ?? '');
        $min = max(0, (int) ($f['min'] ?? 0));
        $list = array_filter($debtors, function ($s) use ($state, $bucket, $promise, $min, $notes) {
            if ($state === 'overdue' && $s['overdue'] <= 0) {
                return false;
            }
            if (in_array($state, ['unpaid', 'partial'], true) && $s['state'] !== $state) {
                return false;
            }
            if ($state === 'notdue' && $s['overdue'] > 0) {
                return false;
            }
            if ($bucket !== '' && isset(self::BUCKETS[$bucket]) && $s['bucket'] !== $bucket) {
                return false;
            }
            $pr = $notes[$s['id']]['promise'] ?? null;
            if ($promise === 'none' && $pr) {
                return false;
            }
            if ($promise === 'open' && (!$pr || $pr['late'])) {
                return false;
            }
            if ($promise === 'late' && (!$pr || !$pr['late'])) {
                return false;
            }
            return $s['balance'] >= $min;
        });
        $counts = ['all' => count($debtors), 'overdue' => 0, 'notdue' => 0, 'unpaid' => 0, 'partial' => 0];
        foreach ($debtors as $s) {
            $counts[$s['overdue'] > 0 ? 'overdue' : 'notdue']++;
            $counts[$s['state']]++;
        }

        $sort = in_array($f['sort'] ?? '', self::SORTS, true) ? $f['sort'] : 'overdue_desc';
        usort($list, fn ($a, $b) => match ($sort) {
            'balance_desc' => [$b['balance'], $a['code']] <=> [$a['balance'], $b['code']],
            'days_desc' => [$b['max_days'], $b['balance']] <=> [$a['max_days'], $a['balance']],
            'name' => strcmp((string) $a['name'], (string) $b['name']),
            'class' => [(string) $a['class'], $a['code']] <=> [(string) $b['class'], $b['code']],
            default => [$b['overdue'], $b['balance']] <=> [$a['overdue'], $a['balance']],
        });
        $total = count($list);
        $per = min(self::MAX_PER, max(1, (int) ($f['per_page'] ?? self::PER_PAGE)));
        $pages = max(1, (int) ceil($total / $per));
        $page = min($pages, max(1, (int) ($f['page'] ?? 1)));
        $items = array_map(function ($s) use ($notes) {
            $n = $notes[$s['id']] ?? ['notes' => 0, 'last' => null, 'promise' => null];
            return $s + ['promise' => $n['promise'], 'last_note' => $n['last'], 'notes' => $n['notes']];
        }, array_slice($list, ($page - 1) * $per, $per));

        return [
            'items' => $items, 'total' => $total, 'page' => $page, 'pages' => $pages, 'per_page' => $per,
            'filtered_balance' => array_sum(array_column($list, 'balance')),
            'counts' => $counts, 'summary' => $sum, 'aging' => array_values($aging),
        ];
    }

    /* ================================================================== tổng quan */

    /**
     * @param array<string,mixed> $f year_id, period_id
     * @return array<string,mixed>
     */
    public function overview(array $f): array
    {
        $inv = $this->invoices(['year_id' => $f['year_id'] ?? null, 'period_id' => $f['period_id'] ?? null]);
        $stu = $this->byStudent($inv);
        $debtors = array_filter($stu, fn ($s) => $s['balance'] > 0);

        $group = function (array $rows, callable $key, callable $label) {
            $g = [];
            foreach ($rows as $s) {
                $k = (string) $key($s);
                $g[$k] ??= ['key' => $k, 'label' => $label($s), 'students' => 0, 'debtors' => 0, 'billed' => 0, 'paid' => 0, 'balance' => 0, 'overdue' => 0];
                $g[$k]['students']++;
                $g[$k]['debtors'] += $s['balance'] > 0 ? 1 : 0;
                $g[$k]['billed'] += $s['billed'];
                $g[$k]['paid'] += $s['paid'];
                $g[$k]['balance'] += $s['balance'];
                $g[$k]['overdue'] += $s['overdue'];
            }
            foreach ($g as &$x) {
                $x['paid_pct'] = $x['billed'] > 0 ? (int) round($x['paid'] * 100 / $x['billed']) : 100;
            }
            unset($x);

            return array_values($g);
        };
        $enr = array_filter($stu, fn ($s) => $s['grade'] !== null);
        $byGrade = $group($enr, fn ($s) => $s['grade'], fn ($s) => 'Khối ' . $s['grade']);
        usort($byGrade, fn ($a, $b) => (int) $a['key'] <=> (int) $b['key']);
        $byClass = $group($enr, fn ($s) => $s['class_id'], fn ($s) => $s['class']);
        usort($byClass, fn ($a, $b) => [$b['balance'], $a['label']] <=> [$a['balance'], $b['label']]);

        // Theo đợt thu
        $per = [];
        foreach ($inv as $r) {
            $k = (string) ($r['period_id'] ?? 0);
            $per[$k] ??= ['key' => $k, 'label' => $r['pname'] ?? 'Hóa đơn lẻ', 'year' => $r['ylabel'], 'invoices' => 0, 'billed' => 0, 'paid' => 0, 'balance' => 0, 'overdue' => 0, 'debtors' => []];
            $per[$k]['invoices']++;
            $per[$k]['billed'] += $r['total'];
            $per[$k]['paid'] += min($r['paid'], $r['total']);
            $per[$k]['balance'] += $r['balance'];
            $per[$k]['overdue'] += $r['days'] > 0 ? $r['balance'] : 0;
            if ($r['balance'] > 0) {
                $per[$k]['debtors'][$r['student_id']] = 1;
            }
        }
        foreach ($per as &$x) {
            $x['debtors'] = count($x['debtors']);
            $x['paid_pct'] = $x['billed'] > 0 ? (int) round($x['paid'] * 100 / $x['billed']) : 100;
        }
        unset($x);
        $byPeriod = array_values($per);
        usort($byPeriod, fn ($a, $b) => $b['balance'] <=> $a['balance']);

        // Tuổi nợ theo hóa đơn
        $aging = [];
        foreach (self::BUCKETS as $k => $l) {
            $aging[$k] = ['key' => $k, 'label' => $l, 'invoices' => 0, 'amount' => 0];
        }
        foreach ($inv as $r) {
            if ($r['balance'] > 0) {
                $aging[$r['bucket']]['invoices']++;
                $aging[$r['bucket']]['amount'] += $r['balance'];
            }
        }

        $top = array_values($debtors);
        usort($top, fn ($a, $b) => [$b['overdue'], $b['balance']] <=> [$a['overdue'], $a['balance']]);
        $top = array_map(fn ($s) => array_intersect_key($s, array_flip(['id', 'code', 'name', 'class', 'balance', 'overdue', 'max_days', 'bucket'])), array_slice($top, 0, 10));

        $billed = array_sum(array_column($stu, 'billed'));
        $paid = array_sum(array_column($stu, 'paid'));
        $notes = $this->notesIndex();
        $pOpen = 0;
        $pLate = 0;
        foreach ($notes as $sid => $n) {
            if ($n['promise'] && isset($debtors[$sid])) {
                $n['promise']['late'] ? $pLate++ : $pOpen++;
            }
        }

        return [
            'total' => [
                'billed' => $billed, 'paid' => $paid, 'balance' => array_sum(array_column($stu, 'balance')),
                'overdue' => array_sum(array_column($stu, 'overdue')), 'pending' => array_sum(array_column($stu, 'pending')),
                'debtors' => count($debtors), 'students' => count($stu), 'overdue_students' => count(array_filter($stu, fn ($s) => $s['overdue'] > 0)),
                'collect_pct' => $billed > 0 ? round($paid * 100 / $billed, 1) : 100.0,
            ],
            'aging' => array_values($aging), 'by_grade' => $byGrade, 'by_class' => $byClass, 'by_period' => $byPeriod, 'top' => $top,
            'promises' => ['open' => $pOpen, 'late' => $pLate],
        ];
    }

    /* ================================================================== chi tiết một học sinh */

    /** @return array<string,mixed>|null */
    public function student(int $id): ?array
    {
        $s = $this->one('SELECT s.id, s.code, s.full_name, s.gender, s.birth_date, c.name AS cname, c.grade FROM sm_students s
                           LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? LEFT JOIN sm_classes c ON c.id = e.class_id WHERE s.id = ?',
            [$this->currentYearId(), $id]);
        if (!$s) {
            return null;
        }
        $inv = $this->invoices([], $id);
        $agg = $this->byStudent($inv)[$id] ?? ['billed' => 0, 'paid' => 0, 'pending' => 0, 'balance' => 0, 'overdue' => 0, 'max_days' => 0, 'open_invoices' => 0, 'state' => 'paid', 'bucket' => null, 'paid_pct' => 100];
        $invoices = array_map(fn ($r) => [
            'id' => (int) $r['id'], 'code' => $r['code'], 'title' => $r['title'], 'year' => $r['ylabel'], 'period' => $r['pname'],
            'due_date' => substr((string) $r['due_date'], 0, 10), 'total' => $r['total'], 'paid' => $r['paid'], 'pending' => $r['pending'], 'balance' => $r['balance'],
            'days' => $r['days'], 'bucket' => $r['bucket'],
            'state' => $r['balance'] <= 0 ? 'paid' : ($r['days'] > 0 ? 'overdue' : ($r['paid'] > 0 ? 'partial' : 'unpaid')),
        ], array_reverse($inv));
        $pay = array_map(fn ($p) => [
            'id' => (int) $p['id'], 'receipt_code' => $p['receipt_code'], 'amount' => (int) $p['amount'], 'method' => FeeRepo::METHODS[$p['method']] ?? $p['method'],
            'at' => $this->dt($p['confirmed_at'] ?: $p['paid_at']), 'invoice' => $p['icode'],
        ], $this->all("SELECT p.id, p.receipt_code, p.amount, p.method, p.confirmed_at, p.paid_at, i.code AS icode FROM sm_payments p JOIN sm_invoices i ON i.id = p.invoice_id
                        WHERE p.student_id = ? AND p.status = 'confirmed' ORDER BY COALESCE(p.confirmed_at, p.paid_at) DESC, p.id DESC LIMIT 15", [$id]));

        return [
            'student' => ['id' => (int) $s['id'], 'code' => $s['code'], 'name' => $s['full_name'], 'gender' => $s['gender'], 'birth_date' => $s['birth_date'], 'class' => $s['cname'], 'grade' => $s['grade'] !== null ? (int) $s['grade'] : null],
            'summary' => array_intersect_key($agg, array_flip(['billed', 'paid', 'pending', 'balance', 'overdue', 'max_days', 'open_invoices', 'state', 'bucket', 'paid_pct'])),
            'invoices' => $invoices, 'payments' => $pay, 'notes' => $this->notesOf($id),
        ];
    }

    /** @return array<int,array<string,mixed>> */
    private function notesOf(int $id): array
    {
        $today = $this->today();
        return array_map(fn ($n) => [
            'id' => (int) $n['id'], 'kind' => $n['kind'], 'channel' => $n['channel'], 'channel_label' => self::CHANNELS[$n['channel']] ?? null, 'note' => $n['note'],
            'promise_date' => $n['promise_date'], 'promise_amount' => $n['promise_amount'] !== null ? (int) $n['promise_amount'] : null,
            'status' => $n['kind'] === 'promise' && $n['status'] === 'open' && $n['promise_date'] < $today ? 'late' : $n['status'],
            'by' => $n['created_by'], 'at' => $this->dt($n['created_at']), 'resolved_by' => $n['resolved_by'], 'resolved_at' => $this->dt($n['resolved_at']),
        ], $this->all('SELECT * FROM sm_debt_notes WHERE student_id = ? ORDER BY id DESC LIMIT 100', [$id]));
    }

    /* ================================================================== ghi chú và hẹn trả */

    /**
     * @param array<string,mixed> $staff
     * @param array<string,mixed> $d student_id, kind (note|contact|promise), channel, note, promise_date, promise_amount
     * @return array<string,mixed>
     */
    public function addNote(array $staff, array $d): array
    {
        $sid = (int) ($d['student_id'] ?? 0);
        $kind = (string) ($d['kind'] ?? 'note');
        $note = trim((string) ($d['note'] ?? ''));
        $errors = [];
        if (!$this->one('SELECT id FROM sm_students WHERE id = ?', [$sid])) {
            return self::fail('Không tìm thấy học sinh.', 404);
        }
        if (!in_array($kind, ['note', 'contact', 'promise'], true)) {
            return self::fail('Loại ghi chú không hợp lệ.');
        }
        $len = mb_strlen($note);
        if ($len < 3 || $len > 500) {
            $errors['note'] = 'Nội dung từ 3 đến 500 ký tự.';
        }
        $channel = null;
        if ($kind !== 'note') {
            $channel = (string) ($d['channel'] ?? '');
            if (!isset(self::CHANNELS[$channel])) {
                $errors['channel'] = 'Chọn hình thức liên hệ.';
            }
        }
        $pdate = null;
        $pamt = null;
        if ($kind === 'promise') {
            $pdate = (string) ($d['promise_date'] ?? '');
            $pamt = (int) ($d['promise_amount'] ?? 0);
            $balance = (int) ($this->student($sid)['summary']['balance'] ?? 0);
            if ($balance <= 0) {
                return self::fail('Học sinh này không còn nợ, không cần hẹn trả.');
            }
            if (!self::validDate($pdate) || $pdate < $this->today()) {
                $errors['promise_date'] = 'Ngày hẹn phải từ hôm nay trở đi.';
            } elseif ($pdate > date('Y-m-d', $this->now() + 180 * 86400)) {
                $errors['promise_date'] = 'Ngày hẹn không quá 180 ngày.';
            }
            if ($pamt < 1000 || $pamt > $balance) {
                $errors['promise_amount'] = 'Số tiền hẹn từ 1.000đ đến số còn nợ (' . number_format($balance, 0, ',', '.') . 'đ).';
            }
            if ($this->one("SELECT id FROM sm_debt_notes WHERE student_id = ? AND kind = 'promise' AND status = 'open'", [$sid])) {
                return self::fail('Học sinh đang có một lời hẹn chưa xử lý. Hãy đánh dấu kết quả lời hẹn đó trước.', 409);
            }
        }
        if ($errors) {
            return self::fail('Vui lòng kiểm tra lại thông tin.', 422, ['errors' => $errors]);
        }
        $this->run('INSERT INTO sm_debt_notes (student_id, kind, channel, note, promise_date, promise_amount, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$sid, $kind, $channel, $note, $pdate, $kind === 'promise' ? $pamt : null, $kind === 'promise' ? 'open' : 'done', $staff['name'], $this->ts()]);
        $msg = $kind === 'promise' ? 'Đã ghi lời hẹn trả.' : ($kind === 'contact' ? 'Đã ghi nhận lần liên hệ.' : 'Đã lưu ghi chú.');

        return ['ok' => true, 'status' => 200, 'message' => $msg, 'notes' => $this->notesOf($sid)];
    }

    /**
     * @param array<string,mixed> $staff
     * @return array<string,mixed>
     */
    public function resolve(array $staff, int $id, string $result): array
    {
        if (!in_array($result, ['kept', 'broken', 'cancelled'], true)) {
            return self::fail('Kết quả không hợp lệ.');
        }
        $n = $this->one('SELECT * FROM sm_debt_notes WHERE id = ?', [$id]);
        if (!$n || $n['kind'] !== 'promise') {
            return self::fail('Không tìm thấy lời hẹn.', 404);
        }
        if ($n['status'] !== 'open') {
            return self::fail('Lời hẹn này đã được xử lý trước đó.', 409);
        }
        $this->run('UPDATE sm_debt_notes SET status = ?, resolved_by = ?, resolved_at = ? WHERE id = ?', [$result, $staff['name'], $this->ts(), $id]);

        return ['ok' => true, 'status' => 200, 'message' => ['kept' => 'Đã ghi nhận phụ huynh giữ lời hẹn.', 'broken' => 'Đã ghi nhận phụ huynh không giữ lời hẹn.', 'cancelled' => 'Đã hủy lời hẹn.'][$result], 'notes' => $this->notesOf((int) $n['student_id'])];
    }

    /**
     * Danh sách lời hẹn trả của toàn trường.
     *
     * @param array<string,mixed> $f status (open|late|kept|broken|cancelled|all), q, page
     * @return array<string,mixed>
     */
    public function promises(array $f): array
    {
        $today = $this->today();
        $status = (string) ($f['status'] ?? 'open');
        $w = ["n.kind = 'promise'"];
        $p = [$this->currentYearId()];
        if ($status === 'open') {
            $w[] = "n.status = 'open' AND n.promise_date >= '$today'";
        } elseif ($status === 'late') {
            $w[] = "n.status = 'open' AND n.promise_date < '$today'";
        } elseif (in_array($status, ['kept', 'broken', 'cancelled'], true)) {
            $w[] = 'n.status = ?';
            $p[] = $status;
        }
        $q = trim((string) ($f['q'] ?? ''));
        if ($q !== '') {
            $w[] = '(s.code LIKE ? OR s.full_name LIKE ?)';
            $p[] = '%' . $q . '%';
            $p[] = '%' . $q . '%';
        }
        $base = 'FROM sm_debt_notes n JOIN sm_students s ON s.id = n.student_id LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? LEFT JOIN sm_classes c ON c.id = e.class_id WHERE ' . implode(' AND ', $w);
        $total = (int) $this->one("SELECT COUNT(*) AS n $base", $p)['n'];
        $per = min(self::MAX_PER, max(1, (int) ($f['per_page'] ?? self::PER_PAGE)));
        $pages = max(1, (int) ceil($total / $per));
        $page = min($pages, max(1, (int) ($f['page'] ?? 1)));
        $rows = $this->all("SELECT n.*, s.code AS scode, s.full_name AS sname, c.name AS cname $base ORDER BY (n.status = 'open') DESC, n.promise_date, n.id LIMIT $per OFFSET " . (($page - 1) * $per), $p);
        $ids = array_values(array_unique(array_map(fn ($r) => (int) $r['student_id'], $rows)));
        $bal = [];
        if ($ids) {
            $inv = $this->invoices([]);
            foreach ($this->byStudent(array_filter($inv, fn ($r) => in_array((int) $r['student_id'], $ids, true))) as $sid => $s) {
                $bal[$sid] = $s['balance'];
            }
        }
        $items = array_map(function ($r) use ($today, $bal) {
            $balance = $bal[(int) $r['student_id']] ?? 0;
            $st = $r['status'] === 'open' ? ($balance <= 0 ? 'paid' : ($r['promise_date'] < $today ? 'late' : 'open')) : $r['status'];
            return [
                'id' => (int) $r['id'], 'student' => ['id' => (int) $r['student_id'], 'code' => $r['scode'], 'name' => $r['sname'], 'class' => $r['cname']],
                'date' => $r['promise_date'], 'amount' => (int) $r['promise_amount'], 'status' => $st, 'raw_status' => $r['status'], 'balance' => $balance,
                'channel_label' => self::CHANNELS[$r['channel']] ?? null, 'note' => $r['note'], 'by' => $r['created_by'], 'at' => $this->dt($r['created_at']),
                'days_left' => (int) floor((strtotime($r['promise_date']) - strtotime($today)) / 86400),
            ];
        }, $rows);
        $cnt = ['open' => 0, 'late' => 0];
        foreach ($this->all("SELECT promise_date FROM sm_debt_notes WHERE kind = 'promise' AND status = 'open'") as $r) {
            $cnt[$r['promise_date'] < $today ? 'late' : 'open']++;
        }

        return ['items' => $items, 'total' => $total, 'page' => $page, 'pages' => $pages, 'per_page' => $per, 'counts' => $cnt];
    }
}
