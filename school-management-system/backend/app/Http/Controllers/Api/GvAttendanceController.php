<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Module "Chuyên cần" của Ban Giám hiệu: /api/gv/ca/*
 * DÙNG CHUNG dữ liệu có sẵn của hệ thống để giáo viên, học sinh, phụ huynh và Ban Giám hiệu cùng thấy một số liệu:
 *   sm_att_records (điểm danh theo ngày), sm_att_leaves (đơn xin nghỉ), sm_att_lessons (điểm danh theo tiết, chỉ cập nhật khi duyệt đơn),
 *   sm_students, sm_classes, sm_enrollments, sm_school_years, sm_staff_accounts.
 * Bảng riêng của module: sm_ca_cases (hồ sơ theo dõi), sm_ca_history (nhật ký), sm_ca_settings (cài đặt).
 * Quyền (middleware NoticeAccess): Hiệu trưởng, Phó hiệu trưởng, Quản trị.
 *  - Phó hiệu trưởng chỉ sửa chuyên cần trong "lock_days" ngày gần nhất; Hiệu trưởng và Quản trị sửa mọi ngày.
 *  - Đổi cài đặt: Hiệu trưởng và Quản trị.
 * Ngày điểm danh (att_date) là ngày theo giờ Việt Nam; created_at/updated_at lưu UTC.
 */
class GvAttendanceController extends Controller
{
    private const APPROVERS = ['super_admin', 'principal'];
    private const STATUSES = ['present' => 'Có mặt', 'late' => 'Đi muộn', 'excused' => 'Vắng có phép', 'unexcused' => 'Vắng không phép'];
    private const KINDS = ['sick' => 'Ốm đau', 'family' => 'Việc gia đình', 'other' => 'Lý do khác'];
    /** Nối bảng điểm danh với lớp học của học sinh trong cùng năm học (cột class_id của sm_att_records có thể rỗng) */
    private const ENR = 'JOIN sm_enrollments e ON e.student_id = r.student_id AND e.school_year_id = r.school_year_id';
    private const TZ = 'Asia/Ho_Chi_Minh';
    private const SUMS = "COUNT(r.id) n_total, COALESCE(SUM(r.status = 'present'), 0) n_present, COALESCE(SUM(r.status = 'late'), 0) n_late,
                          COALESCE(SUM(r.status = 'excused'), 0) n_excused, COALESCE(SUM(r.status = 'unexcused'), 0) n_unexcused";

    private ?array $st = null;

    private function db() { return DB::connection(); }
    private function nowUtc(): string { return now()->format('Y-m-d H:i:s'); }
    private function today(): string { return Carbon::now(self::TZ)->toDateString(); }

    private function fail(string $msg, int $code = 422, array $errors = [])
    {
        $b = ['message' => $msg];
        if ($errors) $b['errors'] = $errors;
        return response()->json($b, $code);
    }

    private function me(Request $r): array
    {
        $s = (array) $r->attributes->get('sm_staff');
        return ['id' => (int) ($s['id'] ?? 0), 'u' => mb_substr((string) ($s['username'] ?? 'staff'), 0, 40), 'n' => mb_substr((string) ($s['name'] ?? 'Ban Giám hiệu'), 0, 80), 'role' => (string) ($s['role'] ?? '')];
    }

    /** Tên nhân viên theo id (dùng cho "ai điểm danh", "ai duyệt đơn"); bỏ qua nếu không tra được */
    private function staffNames(array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if (!$ids) return [];
        try { $rows = $this->db()->select('SELECT * FROM sm_staff_accounts WHERE id IN (' . $this->ph(count($ids)) . ')', $ids); } catch (\Throwable $e) { return []; }
        $out = [];
        foreach ($rows as $x) { $o = (array) $x; $out[(int) $o['id']] = (string) ($o['full_name'] ?? $o['name'] ?? $o['username'] ?? ''); }
        return $out;
    }
    private function isApprover(array $me): bool { return in_array($me['role'], self::APPROVERS, true); }

    private function validDate($s): ?string
    {
        if (!is_string($s) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) return null;
        try { $d = Carbon::createFromFormat('Y-m-d', $s, self::TZ); } catch (\Throwable $e) { return null; }
        return ($d && $d->format('Y-m-d') === $s) ? $s : null;
    }

    /** Khoảng ngày xem số liệu: mặc định từ đầu tháng đến hôm nay, tối đa 366 ngày */
    private function range(Request $r): array
    {
        $to = $this->validDate($r->query('to')) ?? $this->today();
        $from = $this->validDate($r->query('from')) ?? Carbon::parse($to)->startOfMonth()->toDateString();
        if ($from > $to) [$from, $to] = [$to, $from];
        if (abs(Carbon::parse($from)->diffInDays(Carbon::parse($to))) > 366) $from = Carbon::parse($to)->subDays(366)->toDateString();
        return [$from, $to];
    }

    private function ph(int $n): string { return implode(',', array_fill(0, max(1, $n), '?')); }

    private function yearId(): int
    {
        $row = $this->db()->selectOne('SELECT id FROM sm_school_years WHERE is_current = 1 ORDER BY id DESC LIMIT 1')
            ?: $this->db()->selectOne('SELECT id FROM sm_school_years ORDER BY id DESC LIMIT 1');
        return (int) ($row->id ?? 0);
    }

    // ---------- Cài đặt ----------
    private function settings(): array
    {
        if ($this->st !== null) return $this->st;
        $d = ['alert_absent' => '3', 'alert_streak' => '2', 'alert_late' => '5', 'good_rate' => '95', 'warn_rate' => '85', 'lock_days' => '7', 'late_counts_present' => '1'];
        foreach ($this->db()->select('SELECT k, v FROM sm_ca_settings') as $row) $d[$row->k] = $row->v;
        return $this->st = $d;
    }

    public function settingsGet() { return response()->json(['data' => $this->settings()]); }

    public function settingsUpdate(Request $r)
    {
        $me = $this->me($r);
        if (!$this->isApprover($me)) return $this->fail('Chỉ Hiệu trưởng hoặc Quản trị mới được đổi cài đặt.', 403);
        $int = fn (string $k, int $def, int $min, int $max) => (string) max($min, min($max, (int) $r->input($k, $def)));
        $good = (int) $int('good_rate', 95, 50, 100);
        $warn = min((int) $int('warn_rate', 85, 0, 100), $good);
        $in = [
            'alert_absent' => $int('alert_absent', 3, 1, 60), 'alert_streak' => $int('alert_streak', 2, 1, 30), 'alert_late' => $int('alert_late', 5, 1, 60),
            'good_rate' => (string) $good, 'warn_rate' => (string) $warn, 'lock_days' => $int('lock_days', 7, 0, 365),
            'late_counts_present' => $r->boolean('late_counts_present') ? '1' : '0',
        ];
        foreach ($in as $k => $v) $this->db()->statement('INSERT INTO sm_ca_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [$k, $v]);
        $this->st = null;
        $this->log('setting', null, null, null, 'Đổi cài đặt chuyên cần', $me);
        return response()->json(['data' => $this->settings(), 'message' => 'Đã lưu cài đặt.']);
    }

    // ---------- Tiện ích ----------
    private function log(string $kind, ?int $classId, ?int $studentId, ?string $date, string $summary, array $me): void
    {
        $this->db()->insert('INSERT INTO sm_ca_history (kind, class_id, student_id, att_date, summary, actor, actor_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$kind, $classId, $studentId, $date, mb_substr($summary, 0, 255), $me['u'], $me['n'], $this->nowUtc()]);
    }

    /** Tỉ lệ chuyên cần (%) = (có mặt [+ đi muộn]) / tổng số lượt điểm danh */
    private function rate(int $total, int $present, int $late): float
    {
        if ($total <= 0) return 0.0;
        $ok = $present + ($this->settings()['late_counts_present'] === '1' ? $late : 0);
        return round($ok * 100 / $total, 1);
    }

    private function pack(object $x): array
    {
        $t = (int) $x->n_total; $p = (int) $x->n_present; $l = (int) $x->n_late; $e = (int) $x->n_excused; $u = (int) $x->n_unexcused;
        return ['total' => $t, 'present' => $p, 'late' => $l, 'excused' => $e, 'unexcused' => $u, 'absent' => $e + $u, 'rate' => $this->rate($t, $p, $l)];
    }

    private function classes(int $y): array
    {
        return $this->db()->select('SELECT c.id, c.grade, c.name, (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id AND e.school_year_id = c.school_year_id) AS students
                                    FROM sm_classes c WHERE c.school_year_id = ? ORDER BY c.grade, c.name', [$y]);
    }

    private function canEdit(array $me, string $date): bool
    {
        if ($this->isApprover($me)) return true;
        $lock = (int) $this->settings()['lock_days'];
        if ($lock <= 0) return true;
        return (int) abs(Carbon::parse($date)->diffInDays(Carbon::parse($this->today()))) <= $lock || $date > $this->today();
    }

    /** Đơn nghỉ được duyệt: các buổi "vắng không phép" trong khoảng ngày đó chuyển thành "vắng có phép" (giống cách giáo viên chủ nhiệm duyệt) */
    private function applyLeave(int $studentId, string $from, string $to): int
    {
        $n = 0;
        foreach (['sm_att_records', 'sm_att_lessons'] as $tb) {
            $k = $this->db()->update("UPDATE $tb SET status = 'excused', updated_at = ? WHERE student_id = ? AND att_date BETWEEN ? AND ? AND status = 'unexcused'", [$this->nowUtc(), $studentId, $from, $to]);
            if ($tb === 'sm_att_records') $n = $k;
        }
        return $n;
    }

    // ---------- Dữ liệu dùng chung cho giao diện ----------
    public function meta()
    {
        $y = $this->yearId();
        $year = $this->db()->selectOne('SELECT * FROM sm_school_years WHERE id = ?', [$y]);
        return response()->json(['data' => [
            'year_id' => $y, 'year_name' => (string) ($year->label ?? ($year->name ?? '')), 'today' => $this->today(),
            'classes' => array_map(fn ($c) => ['id' => (int) $c->id, 'grade' => (int) $c->grade, 'name' => $c->name, 'students' => (int) $c->students], $this->classes($y)),
            'settings' => $this->settings(), 'statuses' => self::STATUSES, 'kinds' => self::KINDS,
        ]]);
    }

    // ---------- Tổng quan ----------
    public function overview(Request $r)
    {
        $d = $this->db(); $y = $this->yearId(); $st = $this->settings();
        $date = $this->validDate($r->query('date')) ?? $this->today();
        $classes = $this->classes($y);
        $total = (int) ($d->selectOne('SELECT COUNT(*) c FROM sm_enrollments WHERE school_year_id = ?', [$y])->c ?? 0);

        $day = $this->pack($d->selectOne('SELECT ' . self::SUMS . ' FROM sm_att_records r WHERE r.att_date = ?', [$date]));
        $marked = array_map('intval', array_column($d->select('SELECT DISTINCT e.class_id FROM sm_att_records r ' . self::ENR . ' WHERE r.att_date = ?', [$date]), 'class_id'));
        $unmarked = [];
        foreach ($classes as $c) if (!in_array((int) $c->id, $marked, true)) $unmarked[] = ['id' => (int) $c->id, 'grade' => (int) $c->grade, 'name' => $c->name, 'students' => (int) $c->students];

        // 14 ngày gần nhất
        $from14 = Carbon::parse($date)->subDays(13)->toDateString();
        $map = [];
        foreach ($d->select('SELECT r.att_date AS d, ' . self::SUMS . ' FROM sm_att_records r WHERE r.att_date BETWEEN ? AND ? GROUP BY r.att_date', [$from14, $date]) as $row) $map[substr((string) $row->d, 0, 10)] = $this->pack($row);
        $series = [];
        for ($i = 0; $i < 14; $i++) {
            $k = Carbon::parse($from14)->addDays($i)->toDateString();
            $x = $map[$k] ?? null;
            $series[] = ['d' => $k, 'total' => $x['total'] ?? 0, 'present' => $x['present'] ?? 0, 'late' => $x['late'] ?? 0, 'absent' => $x['absent'] ?? 0, 'rate' => $x['rate'] ?? null];
        }

        // 30 ngày: theo khối + lớp thấp nhất
        $from30 = Carbon::parse($date)->subDays(29)->toDateString();
        $byGrade = array_map(fn ($row) => ['grade' => (int) $row->grade] + $this->pack($row),
            $d->select('SELECT c.grade, ' . self::SUMS . ' FROM sm_att_records r ' . self::ENR . ' JOIN sm_classes c ON c.id = e.class_id WHERE r.att_date BETWEEN ? AND ? GROUP BY c.grade ORDER BY c.grade', [$from30, $date]));
        $worst = array_values(array_filter($this->classRows($y, $from30, $date), fn ($c) => $c['total'] > 0));
        usort($worst, fn ($a, $b) => $a['rate'] <=> $b['rate']);
        $month = $this->pack($d->selectOne('SELECT ' . self::SUMS . ' FROM sm_att_records r WHERE r.att_date BETWEEN ? AND ?', [$from30, $date]));

        $absentToday = array_map(fn ($x) => ['student_id' => (int) $x->sid, 'code' => $x->code, 'name' => $x->full_name, 'class_name' => $x->cname, 'status' => $x->status, 'note' => $x->note],
            $d->select("SELECT r.status, r.note, s.id sid, s.code, s.full_name, c.name cname FROM sm_att_records r JOIN sm_students s ON s.id = r.student_id " . self::ENR . " JOIN sm_classes c ON c.id = e.class_id
                        WHERE r.att_date = ? AND r.status <> 'present' ORDER BY FIELD(r.status, 'unexcused', 'excused', 'late'), c.grade, c.name, s.full_name LIMIT 12", [$date]));

        $alerts = $this->computeAlerts($from30, $date);
        $pendingLeaves = (int) ($d->selectOne("SELECT COUNT(*) c FROM sm_att_leaves WHERE status = 'pending'")->c ?? 0);
        $openCases = (int) ($d->selectOne("SELECT COUNT(*) c FROM sm_ca_cases WHERE status <> 'resolved'")->c ?? 0);
        $leavesToday = (int) ($d->selectOne("SELECT COUNT(*) c FROM sm_att_leaves WHERE status = 'approved' AND ? BETWEEN from_date AND to_date", [$date])->c ?? 0);

        return response()->json(['data' => [
            'date' => $date, 'is_weekend' => Carbon::parse($date)->isWeekend(), 'students' => $total, 'classes_total' => count($classes),
            'classes_marked' => count($marked), 'unmarked' => $unmarked, 'day' => $day, 'month' => $month, 'series' => $series, 'by_grade' => $byGrade,
            'worst' => array_slice($worst, 0, 6), 'absent_today' => $absentToday, 'alerts_count' => count($alerts), 'alerts_high' => count(array_filter($alerts, fn ($a) => $a['level'] === 'high')),
            'pending_leaves' => $pendingLeaves, 'open_cases' => $openCases, 'leaves_today' => $leavesToday,
            'good_rate' => (int) $st['good_rate'], 'warn_rate' => (int) $st['warn_rate'],
        ]]);
    }

    // ---------- Điểm danh theo lớp / ngày ----------
    public function day(Request $r)
    {
        $d = $this->db(); $me = $this->me($r);
        $classId = (int) $r->query('class_id');
        $date = $this->validDate($r->query('date')) ?? $this->today();
        $c = $d->selectOne('SELECT id, grade, name, school_year_id FROM sm_classes WHERE id = ?', [$classId]);
        if (!$c) return $this->fail('Không tìm thấy lớp.', 404);

        $stu = $d->select('SELECT s.id, s.code, s.full_name FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id WHERE e.class_id = ? AND e.school_year_id = ?
                           ORDER BY SUBSTRING_INDEX(s.full_name, \' \', -1), s.full_name', [$classId, $c->school_year_id]);
        $ids = array_map(fn ($s) => (int) $s->id, $stu);
        $rec = []; $leave = [];
        if ($ids) {
            $in = $this->ph(count($ids));
            foreach ($d->select("SELECT student_id, status, note, recorded_by, updated_at FROM sm_att_records WHERE school_year_id = ? AND att_date = ? AND student_id IN ($in) ORDER BY id", array_merge([$c->school_year_id, $date], $ids)) as $x) $rec[(int) $x->student_id] = $x;
            foreach ($d->select("SELECT id, student_id, reason FROM sm_att_leaves WHERE status = 'approved' AND ? BETWEEN from_date AND to_date AND student_id IN ($in)", array_merge([$date], $ids)) as $x) $leave[(int) $x->student_id] = $x;
        }
        $names = $this->staffNames(array_map(fn ($x) => (int) $x->recorded_by, $rec));
        $rows = []; $sum = ['present' => 0, 'late' => 0, 'excused' => 0, 'unexcused' => 0, 'unmarked' => 0]; $by = null; $at = null;
        foreach ($stu as $s) {
            $x = $rec[(int) $s->id] ?? null; $lv = $leave[(int) $s->id] ?? null;
            if ($x) { $sum[$x->status] = ($sum[$x->status] ?? 0) + 1; $by = ($names[(int) $x->recorded_by] ?? '') ?: $by; $at = $x->updated_at; } else $sum['unmarked']++;
            $rows[] = ['id' => (int) $s->id, 'code' => $s->code, 'name' => $s->full_name, 'status' => $x->status ?? null, 'note' => $x->note ?? '',
                       'leave' => $lv ? ['id' => (int) $lv->id, 'reason' => $lv->reason] : null];
        }
        return response()->json(['data' => [
            'class' => ['id' => (int) $c->id, 'grade' => (int) $c->grade, 'name' => $c->name], 'date' => $date, 'students' => $rows, 'summary' => $sum,
            'marked' => count($rec) > 0, 'marked_by' => $by, 'marked_at' => $at, 'locked' => !$this->canEdit($me, $date), 'future' => $date > $this->today(),
            'lock_days' => (int) $this->settings()['lock_days'],
        ]]);
    }

    public function mark(Request $r)
    {
        $d = $this->db(); $me = $this->me($r);
        $classId = (int) $r->input('class_id');
        $date = $this->validDate((string) $r->input('date'));
        $items = $r->input('items');
        if (!$date) return $this->fail('Ngày không hợp lệ.');
        if ($date > $this->today()) return $this->fail('Không thể điểm danh cho ngày trong tương lai.');
        if (!is_array($items) || !$items) return $this->fail('Chưa có học sinh nào để lưu.');
        if (count($items) > 120) return $this->fail('Một lớp tối đa 120 học sinh mỗi lần lưu.');
        $c = $d->selectOne('SELECT id, grade, name, school_year_id FROM sm_classes WHERE id = ?', [$classId]);
        if (!$c) return $this->fail('Không tìm thấy lớp.', 404);
        if (!$this->canEdit($me, $date)) return $this->fail('Ngày này đã khóa chỉnh sửa (quá ' . $this->settings()['lock_days'] . ' ngày). Chỉ Hiệu trưởng hoặc Quản trị được sửa.', 403);

        $ok = array_map('intval', array_column($d->select('SELECT student_id FROM sm_enrollments WHERE class_id = ? AND school_year_id = ?', [$classId, $c->school_year_id]), 'student_id'));
        $rows = []; $cnt = ['present' => 0, 'late' => 0, 'excused' => 0, 'unexcused' => 0]; $seen = [];
        foreach ($items as $it) {
            $sid = (int) ($it['student_id'] ?? 0); $stt = (string) ($it['status'] ?? '');
            if (!in_array($sid, $ok, true) || isset($seen[$sid])) return $this->fail('Danh sách có học sinh không thuộc lớp này.');
            if (!isset(self::STATUSES[$stt])) return $this->fail('Trạng thái điểm danh không hợp lệ.');
            $seen[$sid] = 1; $cnt[$stt]++;
            $note = mb_substr(trim((string) ($it['note'] ?? '')), 0, 255);
            $rows[$sid] = [$stt, $note !== '' ? $note : null];
        }
        $now = $this->nowUtc(); $by = $me['id'] > 0 ? $me['id'] : null; $year = (int) $c->school_year_id;
        $d->transaction(function () use ($d, $rows, $c, $date, $by, $now, $year) {
            $have = [];
            foreach ($d->select('SELECT id, student_id FROM sm_att_records WHERE school_year_id = ? AND att_date = ? AND student_id IN (' . $this->ph(count($rows)) . ') ORDER BY id', array_merge([$year, $date], array_keys($rows))) as $x) $have[(int) $x->student_id][] = (int) $x->id;
            $ins = []; $b = [];
            foreach ($rows as $sid => [$stt, $note]) {
                if (!empty($have[$sid])) {
                    $d->update('UPDATE sm_att_records SET status = ?, note = ?, class_id = ?, recorded_by = ?, updated_at = ? WHERE id = ?', [$stt, $note, $c->id, $by, $now, $have[$sid][0]]);
                    foreach (array_slice($have[$sid], 1) as $dup) $d->delete('DELETE FROM sm_att_records WHERE id = ?', [$dup]);   // gộp bản ghi trùng (nếu có)
                } else { $ins[] = '(?, ?, ?, ?, ?, ?, ?, ?, ?)'; array_push($b, $sid, $c->id, $year, $date, $stt, $note, $by, $now, $now); }
            }
            if ($ins) $d->statement('INSERT INTO sm_att_records (student_id, class_id, school_year_id, att_date, status, note, recorded_by, created_at, updated_at) VALUES ' . implode(',', $ins), $b);
        });
        $this->log('mark', (int) $c->id, null, $date, sprintf('Điểm danh lớp %s ngày %s: %d có mặt, %d muộn, %d vắng có phép, %d vắng không phép', $c->name, Carbon::parse($date)->format('d/m/Y'), $cnt['present'], $cnt['late'], $cnt['excused'], $cnt['unexcused']), $me);
        return response()->json(['message' => 'Đã lưu điểm danh lớp ' . $c->name . '.', 'data' => ['counts' => $cnt]]);
    }

    public function dayClear(Request $r)
    {
        $d = $this->db(); $me = $this->me($r);
        $classId = (int) $r->input('class_id'); $date = $this->validDate((string) $r->input('date'));
        $c = $d->selectOne('SELECT id, name, school_year_id FROM sm_classes WHERE id = ?', [$classId]);
        if (!$c || !$date) return $this->fail('Thiếu lớp hoặc ngày.');
        if (!$this->canEdit($me, $date)) return $this->fail('Ngày này đã khóa chỉnh sửa.', 403);
        $n = $d->delete('DELETE r FROM sm_att_records r JOIN sm_enrollments e ON e.student_id = r.student_id AND e.school_year_id = r.school_year_id WHERE e.class_id = ? AND e.school_year_id = ? AND r.att_date = ?', [$classId, $c->school_year_id, $date]);
        $this->log('mark', $classId, null, $date, sprintf('Xóa điểm danh lớp %s ngày %s (%d dòng)', $c->name, Carbon::parse($date)->format('d/m/Y'), $n), $me);
        return response()->json(['message' => 'Đã xóa điểm danh của lớp ' . $c->name . ' ngày này.']);
    }

    // ---------- Theo lớp ----------
    private function classRows(int $y, string $from, string $to): array
    {
        $rows = $this->db()->select('SELECT c.id, c.grade, c.name, (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id AND e.school_year_id = c.school_year_id) AS students,
                COUNT(DISTINCT r.att_date) AS days, ' . self::SUMS . '
            FROM sm_classes c
            LEFT JOIN sm_enrollments e ON e.class_id = c.id AND e.school_year_id = c.school_year_id
            LEFT JOIN sm_att_records r ON r.student_id = e.student_id AND r.school_year_id = e.school_year_id AND r.att_date BETWEEN ? AND ?
            WHERE c.school_year_id = ? GROUP BY c.id, c.grade, c.name, c.school_year_id ORDER BY c.grade, c.name', [$from, $to, $y]);
        return array_map(fn ($x) => ['id' => (int) $x->id, 'grade' => (int) $x->grade, 'name' => $x->name, 'students' => (int) $x->students, 'days' => (int) $x->days] + $this->pack($x), $rows);
    }

    public function classesIndex(Request $r)
    {
        [$from, $to] = $this->range($r);
        $rows = $this->classRows($this->yearId(), $from, $to);
        $tot = ['total' => 0, 'present' => 0, 'late' => 0, 'excused' => 0, 'unexcused' => 0];
        foreach ($rows as $x) foreach ($tot as $k => $_) $tot[$k] += $x[$k];
        $tot['absent'] = $tot['excused'] + $tot['unexcused']; $tot['rate'] = $this->rate($tot['total'], $tot['present'], $tot['late']);
        return response()->json(['data' => $rows, 'meta' => ['from' => $from, 'to' => $to, 'summary' => $tot, 'good_rate' => (int) $this->settings()['good_rate'], 'warn_rate' => (int) $this->settings()['warn_rate']]]);
    }

    // ---------- Học sinh ----------
    private function studentRows(string $from, string $to, string $q, int $classId, int $grade): array
    {
        $y = $this->yearId(); $b = [$from, $to, $y]; $w = '';
        if ($classId) { $w .= ' AND c.id = ?'; $b[] = $classId; }
        if ($grade) { $w .= ' AND c.grade = ?'; $b[] = $grade; }
        if ($q !== '') { $w .= ' AND (s.full_name LIKE ? OR s.code LIKE ?)'; $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%'; array_push($b, $like, $like); }
        $rows = $this->db()->select('SELECT s.id, s.code, s.full_name, c.id cid, c.name cname, c.grade, ' . self::SUMS . '
            FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id JOIN sm_classes c ON c.id = e.class_id
            LEFT JOIN sm_att_records r ON r.student_id = s.id AND r.school_year_id = e.school_year_id AND r.att_date BETWEEN ? AND ?
            WHERE e.school_year_id = ?' . $w . ' GROUP BY s.id, s.code, s.full_name, c.id, c.name, c.grade', $b);
        return array_map(fn ($x) => ['id' => (int) $x->id, 'code' => $x->code, 'name' => $x->full_name, 'class_id' => (int) $x->cid, 'class_name' => $x->cname, 'grade' => (int) $x->grade] + $this->pack($x), $rows);
    }

    public function studentsIndex(Request $r)
    {
        [$from, $to] = $this->range($r); $st = $this->settings();
        $rows = $this->studentRows($from, $to, trim((string) $r->query('q')), (int) $r->query('class_id'), (int) $r->query('grade'));
        $filter = (string) $r->query('filter', 'all');
        $counts = ['all' => count($rows), 'risk' => 0, 'perfect' => 0, 'nodata' => 0];
        foreach ($rows as $x) {
            if ($x['total'] === 0) $counts['nodata']++;
            elseif ($x['absent'] === 0 && $x['late'] === 0) $counts['perfect']++;
            if ($x['total'] > 0 && $x['rate'] < (int) $st['warn_rate']) $counts['risk']++;
        }
        if ($filter === 'risk') $rows = array_values(array_filter($rows, fn ($x) => $x['total'] > 0 && $x['rate'] < (int) $st['warn_rate']));
        elseif ($filter === 'perfect') $rows = array_values(array_filter($rows, fn ($x) => $x['total'] > 0 && $x['absent'] === 0 && $x['late'] === 0));
        elseif ($filter === 'nodata') $rows = array_values(array_filter($rows, fn ($x) => $x['total'] === 0));
        $sort = (string) $r->query('sort', 'absent');
        usort($rows, function ($a, $b) use ($sort) {
            if ($sort === 'rate') return [$a['total'] === 0, $a['rate']] <=> [$b['total'] === 0, $b['rate']];
            if ($sort === 'name') return strcmp($a['class_name'] . $a['name'], $b['class_name'] . $b['name']);
            return [$b['unexcused'], $b['absent'], $b['late']] <=> [$a['unexcused'], $a['absent'], $a['late']];
        });
        $per = max(5, min(100, (int) $r->query('per', 20))); $page = max(1, (int) $r->query('page', 1)); $total = count($rows);
        return response()->json(['data' => array_slice($rows, ($page - 1) * $per, $per), 'counts' => $counts,
            'meta' => ['total' => $total, 'page' => $page, 'per' => $per, 'pages' => max(1, (int) ceil($total / $per)), 'from' => $from, 'to' => $to]]);
    }

    public function studentLookup(Request $r)
    {
        $q = trim((string) $r->query('q'));
        if (mb_strlen($q) < 2) return response()->json(['data' => []]);
        $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
        $rows = $this->db()->select('SELECT s.id, s.code, s.full_name, c.name cname FROM sm_students s LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ?
            LEFT JOIN sm_classes c ON c.id = e.class_id WHERE s.full_name LIKE ? OR s.code LIKE ? ORDER BY s.full_name LIMIT 10', [$this->yearId(), $like, $like]);
        return response()->json(['data' => array_map(fn ($x) => ['id' => (int) $x->id, 'code' => $x->code, 'name' => $x->full_name, 'class_name' => $x->cname], $rows)]);
    }

    public function studentShow(Request $r, int $id)
    {
        $d = $this->db(); [$from, $to] = $this->range($r);
        $s = $d->selectOne('SELECT s.id, s.code, s.full_name, c.id cid, c.name cname, c.grade FROM sm_students s LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ?
            LEFT JOIN sm_classes c ON c.id = e.class_id WHERE s.id = ?', [$this->yearId(), $id]);
        if (!$s) return $this->fail('Không tìm thấy học sinh.', 404);
        $sum = $this->pack($d->selectOne('SELECT ' . self::SUMS . ' FROM sm_att_records r WHERE r.student_id = ? AND r.att_date BETWEEN ? AND ?', [$id, $from, $to]));
        $raw = $d->select('SELECT att_date, status, note, recorded_by FROM sm_att_records WHERE student_id = ? AND att_date BETWEEN ? AND ? ORDER BY att_date DESC LIMIT 400', [$id, $from, $to]);
        $names = $this->staffNames(array_map(fn ($x) => (int) $x->recorded_by, $raw));
        $records = array_map(fn ($x) => ['date' => substr((string) $x->att_date, 0, 10), 'status' => $x->status, 'note' => $x->note, 'by' => $names[(int) $x->recorded_by] ?? ''], $raw);
        $months = array_map(fn ($x) => ['m' => $x->m] + $this->pack($x),
            $d->select("SELECT DATE_FORMAT(r.att_date, '%Y-%m') m, " . self::SUMS . ' FROM sm_att_records r WHERE r.student_id = ? AND r.att_date >= ? GROUP BY m ORDER BY m',
                [$id, Carbon::parse($to)->subMonths(5)->startOfMonth()->toDateString()]));
        $leaves = $this->leaveList($d->select('SELECT l.*, ? AS code, ? AS sname, ? AS cname FROM sm_att_leaves l WHERE l.student_id = ? ORDER BY l.id DESC LIMIT 30', [$s->code, $s->full_name, $s->cname, $id]));
        $cases = array_map(fn ($x) => $this->caseOut($x), $d->select('SELECT cs.*, ? AS code, ? AS sname, ? AS cname FROM sm_ca_cases cs WHERE cs.student_id = ? ORDER BY cs.id DESC LIMIT 30', [$s->code, $s->full_name, $s->cname, $id]));
        $streak = 0;
        foreach ($d->select('SELECT status FROM sm_att_records WHERE student_id = ? ORDER BY att_date DESC LIMIT 60', [$id]) as $x) { if (in_array($x->status, ['excused', 'unexcused'], true)) $streak++; else break; }
        return response()->json(['data' => [
            'student' => ['id' => (int) $s->id, 'code' => $s->code, 'name' => $s->full_name, 'class_id' => $s->cid ? (int) $s->cid : null, 'class_name' => $s->cname, 'grade' => $s->grade ? (int) $s->grade : null],
            'summary' => $sum, 'records' => $records, 'months' => $months, 'leaves' => $leaves, 'cases' => $cases, 'streak' => $streak, 'from' => $from, 'to' => $to,
        ]]);
    }

    // ---------- Đơn nghỉ (bảng sm_att_leaves dùng chung với cổng học sinh và giáo viên chủ nhiệm) ----------
    private function leaveList(array $rows): array
    {
        $names = $this->staffNames(array_map(fn ($x) => (int) $x->reviewed_by, $rows));
        return array_map(fn ($x) => [
            'id' => (int) $x->id, 'student_id' => (int) $x->student_id, 'code' => $x->code ?? '', 'name' => $x->sname ?? '', 'class_name' => $x->cname ?? '',
            'from_date' => substr((string) $x->from_date, 0, 10), 'to_date' => substr((string) $x->to_date, 0, 10),
            'days' => (int) abs(Carbon::parse($x->from_date)->diffInDays(Carbon::parse($x->to_date))) + 1,
            'reason' => $x->reason, 'kind' => $x->leave_type, 'kind_label' => self::KINDS[$x->leave_type] ?? $x->leave_type, 'status' => $x->status,
            'reviewed_by' => $x->reviewed_by ? ($names[(int) $x->reviewed_by] ?? null) : null, 'reviewed_at' => $x->reviewed_at, 'review_note' => $x->reviewer_note, 'created_at' => $x->created_at,
        ], $rows);
    }

    public function leavesIndex(Request $r)
    {
        $d = $this->db(); $y = $this->yearId();
        $status = (string) $r->query('status', 'all'); $q = trim((string) $r->query('q'));
        $base = ' FROM sm_att_leaves l JOIN sm_students s ON s.id = l.student_id LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? LEFT JOIN sm_classes c ON c.id = e.class_id WHERE 1 = 1';
        $b = [$y]; $w = '';
        if ($q !== '') { $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%'; $w .= ' AND (s.full_name LIKE ? OR s.code LIKE ? OR l.reason LIKE ?)'; array_push($b, $like, $like, $like); }
        $counts = ['all' => 0, 'pending' => 0, 'approved' => 0, 'rejected' => 0, 'cancelled' => 0];
        foreach ($d->select('SELECT l.status, COUNT(*) n' . $base . $w . ' GROUP BY l.status', $b) as $x) { $counts[$x->status] = (int) $x->n; $counts['all'] += (int) $x->n; }
        $w2 = $w; $b2 = $b;
        if (isset($counts[$status]) && $status !== 'all') { $w2 .= ' AND l.status = ?'; $b2[] = $status; }
        $per = max(5, min(60, (int) $r->query('per', 15))); $page = max(1, (int) $r->query('page', 1));
        $total = (int) ($d->selectOne('SELECT COUNT(*) n' . $base . $w2, $b2)->n ?? 0);
        $rows = $d->select('SELECT l.*, s.code, s.full_name sname, c.name cname' . $base . $w2 . " ORDER BY FIELD(l.status, 'pending', 'approved', 'rejected', 'cancelled'), l.id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $b2);
        return response()->json(['data' => $this->leaveList($rows), 'counts' => $counts,
            'meta' => ['total' => $total, 'page' => $page, 'per' => $per, 'pages' => max(1, (int) ceil($total / $per))]]);
    }

    public function leaveStore(Request $r)
    {
        $d = $this->db(); $me = $this->me($r);
        $sid = (int) $r->input('student_id');
        $from = $this->validDate((string) $r->input('from_date')); $to = $this->validDate((string) $r->input('to_date'));
        $reason = trim((string) $r->input('reason')); $kind = (string) $r->input('kind', 'sick');
        $err = [];
        $s = $sid ? $d->selectOne('SELECT id, code, full_name FROM sm_students WHERE id = ?', [$sid]) : null;
        if (!$s) $err['student_id'] = 'Hãy chọn học sinh.';
        if (!$from) $err['from_date'] = 'Chọn ngày bắt đầu.';
        if (!$to) $err['to_date'] = 'Chọn ngày kết thúc.';
        if ($from && $to && $to < $from) $err['to_date'] = 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.';
        if ($from && $to && abs(Carbon::parse($from)->diffInDays(Carbon::parse($to))) > 60) $err['to_date'] = 'Một đơn nghỉ tối đa 60 ngày.';
        if (mb_strlen($reason) < 3) $err['reason'] = 'Nhập lý do (ít nhất 3 ký tự).';
        if (!isset(self::KINDS[$kind])) $kind = 'other';
        if ($from && $to && $s && $d->selectOne("SELECT id FROM sm_att_leaves WHERE student_id = ? AND status IN ('pending', 'approved') AND from_date <= ? AND to_date >= ? LIMIT 1", [$sid, $to, $from])) $err['from_date'] = 'Khoảng ngày này đã có đơn nghỉ khác.';
        if ($err) return $this->fail('Vui lòng kiểm tra lại thông tin.', 422, $err);
        $approved = $r->boolean('approve', true);
        $now = $this->nowUtc(); $by = $me['id'] > 0 ? $me['id'] : null;
        $id = $d->table('sm_att_leaves')->insertGetId([
            'student_id' => $sid, 'leave_type' => $kind, 'from_date' => $from, 'to_date' => $to, 'reason' => mb_substr($reason, 0, 500), 'status' => $approved ? 'approved' : 'pending',
            'reviewer_note' => $approved ? 'Ban Giám hiệu ghi nhận' : null, 'reviewed_by' => $approved ? $by : null, 'reviewed_at' => $approved ? $now : null, 'created_at' => $now, 'updated_at' => $now,
        ]);
        $fixed = $approved ? $this->applyLeave($sid, $from, $to) : 0;
        $this->log('leave', null, $sid, $from, sprintf('%s đơn nghỉ của %s (%s → %s)', $approved ? 'Ghi nhận' : 'Tạo', $s->full_name, Carbon::parse($from)->format('d/m'), Carbon::parse($to)->format('d/m')), $me);
        return response()->json(['message' => ($approved ? 'Đã ghi nhận đơn nghỉ' : 'Đã tạo đơn nghỉ chờ duyệt') . ($fixed ? " và chuyển $fixed lượt vắng thành có phép." : '.'), 'data' => ['id' => $id]], 201);
    }

    public function leaveAction(Request $r, int $id)
    {
        $d = $this->db(); $me = $this->me($r);
        $l = $d->selectOne('SELECT l.*, s.full_name FROM sm_att_leaves l JOIN sm_students s ON s.id = l.student_id WHERE l.id = ?', [$id]);
        if (!$l) return $this->fail('Không tìm thấy đơn nghỉ.', 404);
        $act = (string) $r->input('action'); $note = mb_substr(trim((string) $r->input('note')), 0, 255);
        $map = ['approve' => 'approved', 'reject' => 'rejected', 'cancel' => 'cancelled'];
        if (!isset($map[$act])) return $this->fail('Thao tác không hợp lệ.');
        if ($act === 'reject' && mb_strlen($note) < 3) return $this->fail('Vui lòng ghi lý do từ chối.', 422, ['note' => 'Nhập lý do (ít nhất 3 ký tự).']);
        if ($act !== 'cancel' && $l->status !== 'pending') return $this->fail('Đơn này đã được xử lý.');
        if ($act === 'cancel' && !in_array($l->status, ['pending', 'approved'], true)) return $this->fail('Đơn này không thể hủy.');
        $now = $this->nowUtc(); $by = $me['id'] > 0 ? $me['id'] : null;
        $d->update('UPDATE sm_att_leaves SET status = ?, reviewed_by = ?, reviewed_at = ?, reviewer_note = ?, updated_at = ? WHERE id = ?', [$map[$act], $by, $now, $note !== '' ? $note : null, $now, $id]);
        $fixed = $act === 'approve' ? $this->applyLeave((int) $l->student_id, substr((string) $l->from_date, 0, 10), substr((string) $l->to_date, 0, 10)) : 0;
        $lab = ['approve' => 'Duyệt', 'reject' => 'Từ chối', 'cancel' => 'Hủy'][$act];
        $this->log('leave', null, (int) $l->student_id, substr((string) $l->from_date, 0, 10), "$lab đơn nghỉ của {$l->full_name}", $me);
        return response()->json(['message' => "$lab đơn nghỉ thành công." . ($fixed ? " Đã chuyển $fixed lượt vắng thành có phép." : '')]);
    }

    // ---------- Cảnh báo ----------
    private function computeAlerts(string $from, string $to): array
    {
        $d = $this->db(); $st = $this->settings(); $y = $this->yearId();
        $rows = $d->select('SELECT s.id, s.code, s.full_name, c.id cid, c.name cname, c.grade, ' . self::SUMS . '
            FROM sm_att_records r JOIN sm_students s ON s.id = r.student_id
            JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = r.school_year_id AND e.school_year_id = ? JOIN sm_classes c ON c.id = e.class_id
            WHERE r.att_date BETWEEN ? AND ? GROUP BY s.id, s.code, s.full_name, c.id, c.name, c.grade
            HAVING SUM(r.status IN (\'excused\', \'unexcused\')) > 0 OR SUM(r.status = \'late\') > 0', [$y, $from, $to]);
        if (!$rows) return [];
        $ids = array_map(fn ($x) => (int) $x->id, $rows);
        $streak = []; $cur = [];
        foreach (array_chunk($ids, 400) as $chunk) {
            $run = []; $last = null;
            foreach ($d->select('SELECT student_id, status FROM sm_att_records WHERE att_date BETWEEN ? AND ? AND student_id IN (' . $this->ph(count($chunk)) . ') ORDER BY student_id, att_date', array_merge([$from, $to], $chunk)) as $x) {
                $sid = (int) $x->student_id;
                if ($last !== $sid) { $run[$sid] = 0; $streak[$sid] = 0; $last = $sid; }
                if (in_array($x->status, ['excused', 'unexcused'], true)) { $run[$sid]++; $streak[$sid] = max($streak[$sid], $run[$sid]); } else $run[$sid] = 0;
                $cur[$sid] = $run[$sid];
            }
        }
        $cases = [];
        foreach (array_chunk($ids, 400) as $chunk) foreach ($d->select('SELECT id, student_id, status FROM sm_ca_cases WHERE student_id IN (' . $this->ph(count($chunk)) . ') ORDER BY id', $chunk) as $x) $cases[(int) $x->student_id] = $x;
        $out = [];
        foreach ($rows as $x) {
            $p = $this->pack($x); $sid = (int) $x->id; $sk = $streak[$sid] ?? 0; $reasons = [];
            if ($p['absent'] >= (int) $st['alert_absent']) $reasons[] = "Nghỉ {$p['absent']} buổi";
            if ($sk >= (int) $st['alert_streak']) $reasons[] = "Nghỉ liên tiếp $sk buổi";
            if ($p['late'] >= (int) $st['alert_late']) $reasons[] = "Đi muộn {$p['late']} lần";
            if (!$reasons) continue;
            $high = $p['unexcused'] >= (int) $st['alert_absent'] || $sk >= (int) $st['alert_streak'] + 1 || ($cur[$sid] ?? 0) >= 3;
            $cs = $cases[$sid] ?? null;
            $out[] = ['student_id' => $sid, 'code' => $x->code, 'name' => $x->full_name, 'class_id' => (int) $x->cid, 'class_name' => $x->cname, 'grade' => (int) $x->grade,
                'level' => $high ? 'high' : 'mid', 'reasons' => $reasons, 'streak' => $sk, 'current_streak' => $cur[$sid] ?? 0,
                'case_id' => $cs ? (int) $cs->id : null, 'case_status' => $cs->status ?? null] + $p;
        }
        usort($out, fn ($a, $b) => [$a['level'] === 'high' ? 0 : 1, -$a['unexcused'], -$a['absent']] <=> [$b['level'] === 'high' ? 0 : 1, -$b['unexcused'], -$b['absent']]);
        return $out;
    }

    public function alerts(Request $r)
    {
        [$from, $to] = $this->range($r);
        $rows = $this->computeAlerts($from, $to);
        $f = (string) $r->query('filter', 'all');
        $counts = ['all' => count($rows), 'high' => 0, 'open' => 0];
        foreach ($rows as $x) { if ($x['level'] === 'high') $counts['high']++; if (!$x['case_status'] || $x['case_status'] !== 'resolved') $counts['open']++; }
        if ($f === 'high') $rows = array_values(array_filter($rows, fn ($x) => $x['level'] === 'high'));
        elseif ($f === 'open') $rows = array_values(array_filter($rows, fn ($x) => $x['case_status'] !== 'resolved'));
        $cid = (int) $r->query('class_id');
        if ($cid) $rows = array_values(array_filter($rows, fn ($x) => $x['class_id'] === $cid));
        return response()->json(['data' => $rows, 'counts' => $counts, 'meta' => ['from' => $from, 'to' => $to, 'rules' => array_intersect_key($this->settings(), array_flip(['alert_absent', 'alert_streak', 'alert_late']))]]);
    }

    // ---------- Hồ sơ theo dõi ----------
    private function caseOut(object $x): array
    {
        return ['id' => (int) $x->id, 'student_id' => (int) $x->student_id, 'code' => $x->code ?? '', 'name' => $x->sname ?? '', 'class_name' => $x->cname ?? '', 'title' => $x->title,
            'status' => $x->status, 'note' => $x->note ?? '', 'created_by_name' => $x->created_by_name, 'created_at' => $x->created_at, 'updated_at' => $x->updated_at];
    }

    public function casesIndex(Request $r)
    {
        $d = $this->db(); $status = (string) $r->query('status', 'all');
        $base = ' FROM sm_ca_cases cs JOIN sm_students s ON s.id = cs.student_id LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? LEFT JOIN sm_classes c ON c.id = e.class_id';
        $counts = ['all' => 0, 'open' => 0, 'contacted' => 0, 'resolved' => 0];
        foreach ($d->select('SELECT cs.status, COUNT(*) n FROM sm_ca_cases cs GROUP BY cs.status') as $x) { $counts[$x->status] = (int) $x->n; $counts['all'] += (int) $x->n; }
        $w = ''; $b = [$this->yearId()];
        if (in_array($status, ['open', 'contacted', 'resolved'], true)) { $w = ' WHERE cs.status = ?'; $b[] = $status; }
        $rows = $d->select('SELECT cs.*, s.code, s.full_name sname, c.name cname' . $base . $w . " ORDER BY FIELD(cs.status, 'open', 'contacted', 'resolved'), cs.updated_at DESC LIMIT 100", $b);
        return response()->json(['data' => array_map(fn ($x) => $this->caseOut($x), $rows), 'counts' => $counts]);
    }

    public function caseStore(Request $r)
    {
        $d = $this->db(); $me = $this->me($r);
        $sid = (int) $r->input('student_id'); $title = trim((string) $r->input('title')); $note = trim((string) $r->input('note'));
        $s = $sid ? $d->selectOne('SELECT id, full_name FROM sm_students WHERE id = ?', [$sid]) : null;
        $err = [];
        if (!$s) $err['student_id'] = 'Hãy chọn học sinh.';
        if (mb_strlen($title) < 3) $err['title'] = 'Nhập tiêu đề (ít nhất 3 ký tự).';
        if ($err) return $this->fail('Vui lòng kiểm tra lại thông tin.', 422, $err);
        $now = $this->nowUtc();
        $id = $d->table('sm_ca_cases')->insertGetId(['student_id' => $sid, 'title' => mb_substr($title, 0, 160), 'status' => 'open', 'note' => $note !== '' ? $note : null,
            'created_by' => $me['u'], 'created_by_name' => $me['n'], 'created_at' => $now, 'updated_at' => $now]);
        $this->log('case', null, $sid, null, 'Mở hồ sơ theo dõi chuyên cần: ' . $s->full_name, $me);
        return response()->json(['message' => 'Đã mở hồ sơ theo dõi.', 'data' => ['id' => $id]], 201);
    }

    public function caseUpdate(Request $r, int $id)
    {
        $d = $this->db(); $me = $this->me($r);
        $c = $d->selectOne('SELECT cs.*, s.full_name FROM sm_ca_cases cs JOIN sm_students s ON s.id = cs.student_id WHERE cs.id = ?', [$id]);
        if (!$c) return $this->fail('Không tìm thấy hồ sơ.', 404);
        $status = (string) $r->input('status', $c->status);
        if (!in_array($status, ['open', 'contacted', 'resolved'], true)) return $this->fail('Trạng thái không hợp lệ.');
        $note = $r->has('note') ? mb_substr(trim((string) $r->input('note')), 0, 4000) : (string) $c->note;
        $d->update('UPDATE sm_ca_cases SET status = ?, note = ?, updated_at = ? WHERE id = ?', [$status, $note !== '' ? $note : null, $this->nowUtc(), $id]);
        $this->log('case', null, (int) $c->student_id, null, 'Cập nhật hồ sơ chuyên cần của ' . $c->full_name . ' → ' . ['open' => 'đang theo dõi', 'contacted' => 'đã liên hệ phụ huynh', 'resolved' => 'đã xử lý'][$status], $me);
        return response()->json(['message' => 'Đã cập nhật hồ sơ.']);
    }

    // ---------- Báo cáo ----------
    private function reportData(string $from, string $to, string $group): array
    {
        $y = $this->yearId(); $d = $this->db();
        $head = ['Số buổi / lượt', 'Có mặt', 'Đi muộn', 'Vắng có phép', 'Vắng không phép', 'Tỉ lệ chuyên cần (%)'];
        $cells = fn (array $p) => [$p['total'], $p['present'], $p['late'], $p['excused'], $p['unexcused'], $p['rate']];
        if ($group === 'grade') {
            $rows = $d->select('SELECT c.grade, COUNT(DISTINCT c.id) classes, ' . self::SUMS . ' FROM sm_classes c LEFT JOIN sm_enrollments e ON e.class_id = c.id AND e.school_year_id = c.school_year_id
                LEFT JOIN sm_att_records r ON r.student_id = e.student_id AND r.school_year_id = e.school_year_id AND r.att_date BETWEEN ? AND ?
                WHERE c.school_year_id = ? GROUP BY c.grade ORDER BY c.grade', [$from, $to, $y]);
            return [array_merge(['Khối', 'Số lớp'], $head), array_map(fn ($x) => array_merge(['Khối ' . $x->grade, (int) $x->classes], $cells($this->pack($x))), $rows)];
        }
        if ($group === 'day') {
            $rows = $d->select('SELECT r.att_date AS d, COUNT(DISTINCT e.class_id) classes, ' . self::SUMS . ' FROM sm_att_records r ' . self::ENR . ' WHERE r.att_date BETWEEN ? AND ? GROUP BY r.att_date ORDER BY r.att_date DESC', [$from, $to]);
            return [array_merge(['Ngày', 'Số lớp đã điểm danh'], $head), array_map(fn ($x) => array_merge([Carbon::parse($x->d)->format('d/m/Y'), (int) $x->classes], $cells($this->pack($x))), $rows)];
        }
        if ($group === 'student') {
            $rows = array_filter($this->studentRows($from, $to, '', 0, 0), fn ($x) => $x['absent'] > 0 || $x['late'] > 0);
            usort($rows, fn ($a, $b) => [$b['unexcused'], $b['absent'], $b['late']] <=> [$a['unexcused'], $a['absent'], $a['late']]);
            return [array_merge(['Mã HS', 'Họ tên', 'Lớp'], $head), array_map(fn ($x) => array_merge([$x['code'], $x['name'], $x['class_name']], $cells($x)), array_values($rows))];
        }
        $rows = $this->classRows($y, $from, $to);
        return [array_merge(['Lớp', 'Khối', 'Sĩ số'], $head), array_map(fn ($x) => array_merge([$x['name'], $x['grade'], $x['students']], $cells($x)), $rows)];
    }

    public function report(Request $r)
    {
        [$from, $to] = $this->range($r);
        $g = in_array($r->query('group'), ['class', 'grade', 'day', 'student'], true) ? (string) $r->query('group') : 'class';
        [$cols, $rows] = $this->reportData($from, $to, $g);
        return response()->json(['data' => ['columns' => $cols, 'rows' => $rows, 'group' => $g, 'from' => $from, 'to' => $to]]);
    }

    public function export(Request $r)
    {
        [$from, $to] = $this->range($r);
        $g = in_array($r->query('group'), ['class', 'grade', 'day', 'student'], true) ? (string) $r->query('group') : 'class';
        [$cols, $rows] = $this->reportData($from, $to, $g);
        $name = "chuyen-can-$g-$from-$to.csv";
        return response()->streamDownload(function () use ($cols, $rows) {
            $o = fopen('php://output', 'w'); fwrite($o, "\xEF\xBB\xBF");
            fputcsv($o, $cols);
            foreach ($rows as $row) fputcsv($o, array_map(fn ($v) => is_string($v) && preg_match('/^[=+\-@]/', $v) ? "'" . $v : $v, $row));
            fclose($o);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    // ---------- Nhật ký ----------
    public function history(Request $r)
    {
        $d = $this->db(); $per = 20; $page = max(1, (int) $r->query('page', 1));
        $total = (int) ($d->selectOne('SELECT COUNT(*) n FROM sm_ca_history')->n ?? 0);
        $rows = $d->select("SELECT id, kind, class_id, student_id, att_date, summary, actor_name, created_at FROM sm_ca_history ORDER BY id DESC LIMIT $per OFFSET " . (($page - 1) * $per));
        return response()->json(['data' => $rows, 'meta' => ['total' => $total, 'page' => $page, 'per' => $per, 'pages' => max(1, (int) ceil($total / $per))]]);
    }
}
