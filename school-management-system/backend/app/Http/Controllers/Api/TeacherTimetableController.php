<?php

namespace App\Http\Controllers\Api;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Cổng giáo viên – THỜI KHÓA BIỂU (đi sau middleware StaffToken, prefix teacher/tt).
 * Đường dẫn thật: /api/gv/teacher/tt/...
 *
 * Dữ liệu gốc: sm_timetable (+ sm_class_subjects, sm_periods, sm_classes, sm_subjects) có sẵn.
 * Bảng mới: sm_tt_notes (ghi chú/giáo án/phòng học), sm_tt_requests (đổi tiết, dạy bù, xin nghỉ, đổi phòng).
 * Liên kết: trạng thái điểm danh từng tiết lấy từ sm_att_lessons / sm_att_submissions.
 */
class TeacherTimetableController extends LessonAttendanceStaffController
{
    private const TZ = 'Asia/Ho_Chi_Minh';
    private const ADMIN = ['academic', 'principal', 'vice_principal', 'super_admin'];
    private const KINDS = ['swap', 'makeup', 'absent', 'room'];

    /* ---------- tiện ích ---------- */
    private function now(): Carbon { return Carbon::now(self::TZ); }
    private function today(): string { return $this->now()->toDateString(); }
    private function utc(): string { return now()->format('Y-m-d H:i:s'); }
    private function wd(string $d): int { return (int) date('N', strtotime($d)) + 1; }
    private function okDate($s): bool { return is_string($s) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $s) && date('Y-m-d', strtotime($s)) === $s; }
    private function yearId(): int { return (int) (DB::table('sm_school_years')->where('is_current', 1)->value('id') ?: DB::table('sm_school_years')->max('id')); }
    private function hm($t): ?string { return $t ? substr((string) $t, 0, 5) : null; }
    private function monday(string $d): string { return Carbon::parse($d)->startOfWeek(Carbon::MONDAY)->toDateString(); }

    /** [$staff, $teacherId, $isAdmin] – tài khoản có teacher_id thì xem lịch của chính mình; BGH/giáo vụ chưa gắn giáo viên có thể truyền teacher_id */
    private function scope(Request $r): array
    {
        $st = $this->staff($r);
        $admin = in_array($st->role, self::ADMIN, true);
        $own = (int) ($st->teacher_id ?? 0);
        if (in_array($st->role, ['teacher', 'homeroom_teacher'], true)) $tid = $own;
        else $tid = (int) $r->query('teacher_id', 0) ?: $own;
        abort_unless($tid > 0 || $admin, 403, 'Tài khoản này chưa được liên kết với giáo viên nào.');
        abort_unless($tid > 0, 422, 'Tài khoản quản trị này chưa gắn với giáo viên nào (cột teacher_id trong sm_staff_accounts đang trống). Hãy đăng nhập bằng tài khoản giáo viên.');
        return [$st, $tid, $admin];
    }

    private function periods(): array
    {
        $rows = DB::select('SELECT id, start_time, end_time FROM sm_periods ORDER BY id');
        if (!$rows) { $out = []; for ($i = 1; $i <= 5; $i++) $out[] = ['id' => $i, 'start' => null, 'end' => null]; return $out; }
        return array_map(fn ($p) => ['id' => (int) $p->id, 'start' => $this->hm($p->start_time), 'end' => $this->hm($p->end_time)], $rows);
    }

    /** Toàn bộ tiết dạy trong năm học hiện tại của giáo viên (không phân biệt tuần) */
    private function slots(int $tid): array
    {
        return array_map(fn ($x) => [
            'weekday' => (int) $x->weekday, 'period' => (int) $x->period,
            'cs' => (int) $x->cs_id, 'class_id' => (int) $x->class_id, 'class_name' => $x->class_name, 'grade' => (int) $x->grade,
            'subject_id' => (int) $x->subject_id, 'subject' => $x->subject, 'code' => $x->code, 'total' => (int) $x->total,
        ], DB::select("SELECT t.weekday, t.period, cs.id cs_id, c.id class_id, c.name class_name, c.grade, s.id subject_id, s.name subject, s.code,
              (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id AND e.school_year_id = c.school_year_id) total
            FROM sm_timetable t JOIN sm_class_subjects cs ON cs.id = t.class_subject_id JOIN sm_classes c ON c.id = cs.class_id
            JOIN sm_subjects s ON s.id = cs.subject_id
            WHERE cs.teacher_id = ? AND c.school_year_id = ? ORDER BY t.weekday, t.period", [$tid, $this->yearId()]));
    }

    private function phase(string $date, array $p, string $today, string $hm): string
    {
        if ($date < $today) return 'ended';
        if ($date > $today) return 'upcoming';
        if (!$p['start']) return 'ongoing';
        return $hm < $p['start'] ? 'upcoming' : ($hm <= $p['end'] ? 'ongoing' : 'ended');
    }

    /** Trạng thái điểm danh của các tiết trong khoảng ngày: key "cs|date|period" */
    private function attState(int $tid, string $from, string $to): array
    {
        $out = [];
        $marked = DB::select('SELECT l.class_subject_id cs, l.att_date d, l.period p, COUNT(*) n FROM sm_att_lessons l JOIN sm_class_subjects c ON c.id = l.class_subject_id
            WHERE c.teacher_id = ? AND l.att_date BETWEEN ? AND ? GROUP BY l.class_subject_id, l.att_date, l.period', [$tid, $from, $to]);
        foreach ($marked as $m) $out["{$m->cs}|{$m->d}|{$m->p}"] = ['marked' => (int) $m->n, 'locked' => false];
        try {
            $subs = DB::select('SELECT s.class_subject_id cs, s.att_date d, s.period p, s.status FROM sm_att_submissions s WHERE s.teacher_id = ? AND s.att_date BETWEEN ? AND ?', [$tid, $from, $to]);
            foreach ($subs as $s) { $k = "{$s->cs}|{$s->d}|{$s->p}"; $out[$k] = ['marked' => $out[$k]['marked'] ?? 0, 'locked' => $s->status === 'submitted']; }
        } catch (\Throwable $e) { /* chưa cài module điểm danh giáo viên */ }
        return $out;
    }

    /** Dựng các tiết của 1 khoảng ngày (thứ 2 → thứ 7) */
    private function build(int $tid, string $from, string $to, array $slots, array $periods): array
    {
        $today = $this->today(); $hm = $this->now()->format('H:i');
        $pmap = []; foreach ($periods as $p) $pmap[$p['id']] = $p;
        $att = $this->attState($tid, $from, $to);
        $notes = DB::table('sm_tt_notes')->where('teacher_id', $tid)->where(fn ($q) => $q->whereNull('att_date')->orWhereBetween('att_date', [$from, $to]))->get();
        $reqs = DB::table('sm_tt_requests')->where('teacher_id', $tid)->whereIn('status', ['pending', 'approved'])
            ->where(fn ($q) => $q->whereBetween('att_date', [$from, $to])->orWhereBetween('to_date', [$from, $to]))->get();
        $out = [];
        for ($d = Carbon::parse($from); $d->toDateString() <= $to; $d->addDay()) {
            $date = $d->toDateString(); $w = $this->wd($date);
            if ($w > 7) continue;
            foreach ($slots as $s) {
                if ($s['weekday'] !== $w) continue;
                $p = $pmap[$s['period']] ?? ['id' => $s['period'], 'start' => null, 'end' => null];
                $room = null; $nn = [];
                foreach ($notes as $n) {
                    if ((int) $n->class_subject_id !== $s['cs'] || (int) $n->weekday !== $w || (int) $n->period !== $s['period']) continue;
                    if ($n->kind === 'room') { if ($n->att_date === $date || ($n->att_date === null && $room === null)) $room = $n->room; continue; }
                    if ($n->att_date === null || $n->att_date === $date) $nn[] = ['id' => (int) $n->id, 'kind' => $n->kind, 'title' => $n->title, 'content' => $n->content, 'color' => $n->color, 'pinned' => (bool) $n->pinned, 'date' => $n->att_date];
                }
                $rq = null;
                foreach ($reqs as $q) if ((int) $q->class_subject_id === $s['cs'] && $q->att_date === $date && (int) $q->period === $s['period']) { $rq = ['id' => (int) $q->id, 'kind' => $q->kind, 'status' => $q->status, 'to_date' => $q->to_date, 'to_period' => $q->to_period ? (int) $q->to_period : null]; break; }
                $a = $att["{$s['cs']}|{$date}|{$s['period']}"] ?? ['marked' => 0, 'locked' => false];
                $out[] = $s + ['date' => $date, 'start' => $p['start'], 'end' => $p['end'], 'room' => $room, 'phase' => $this->phase($date, $p, $today, $hm),
                    'att' => $a + ['state' => $a['locked'] ? 'locked' : ($a['marked'] >= $s['total'] && $s['total'] > 0 ? 'ready' : ($a['marked'] > 0 ? 'draft' : 'todo'))],
                    'notes' => $nn, 'request' => $rq, 'moved' => $rq && $rq['status'] === 'approved' && in_array($rq['kind'], ['swap', 'makeup', 'absent'], true)];
            }
            // tiết dạy bù/đổi đã được duyệt rơi vào ngày này
            foreach ($reqs as $q) {
                if ($q->status !== 'approved' || !in_array($q->kind, ['swap', 'makeup'], true) || $q->to_date !== $date || !$q->to_period) continue;
                $src = null; foreach ($slots as $s) if ($s['cs'] === (int) $q->class_subject_id) { $src = $s; break; }
                if (!$src) continue;
                $p = $pmap[(int) $q->to_period] ?? ['id' => (int) $q->to_period, 'start' => null, 'end' => null];
                $out[] = ['weekday' => $this->wd($date), 'period' => (int) $q->to_period] + array_diff_key($src, ['weekday' => 1, 'period' => 1]) + [
                    'date' => $date, 'start' => $p['start'], 'end' => $p['end'], 'room' => $q->to_room, 'phase' => $this->phase($date, $p, $today, $hm),
                    'att' => ['marked' => 0, 'locked' => false, 'state' => 'todo'], 'notes' => [], 'request' => ['id' => (int) $q->id, 'kind' => $q->kind, 'status' => 'approved', 'to_date' => null, 'to_period' => null], 'moved' => false, 'extra' => true];
            }
        }
        usort($out, fn ($a, $b) => [$a['date'], $a['period']] <=> [$b['date'], $b['period']]);
        return $out;
    }

    private function teacherInfo(int $tid): array
    {
        $t = DB::table('sm_teachers')->where('id', $tid)->first();
        $home = DB::table('sm_classes')->where('homeroom_teacher_id', $tid)->where('school_year_id', $this->yearId())->first(['id', 'name', 'grade']);
        return ['id' => $tid, 'name' => $t->full_name ?? '', 'homeroom' => $home];
    }

    /* ---------- 1. Tổng quan ---------- */
    public function overview(Request $r)
    {
        [, $tid] = $this->scope($r);
        $slots = $this->slots($tid); $periods = $this->periods();
        $today = $this->today();
        $from = $this->monday($today); $to = Carbon::parse($from)->addDays(5)->toDateString();
        $week = $this->build($tid, $from, $to, $slots, $periods);
        $todayL = array_values(array_filter($week, fn ($x) => $x['date'] === $today));
        // tiết kế tiếp: tìm trong 14 ngày tới
        $next = null; $hm = $this->now()->format('H:i');
        $look = $this->build($tid, $today, Carbon::parse($today)->addDays(14)->toDateString(), $slots, $periods);
        foreach ($look as $x) { if ($x['phase'] === 'upcoming' || $x['phase'] === 'ongoing') { $next = $x; break; } }
        $byDay = array_fill(2, 6, 0); foreach ($slots as $s) $byDay[$s['weekday']] = ($byDay[$s['weekday']] ?? 0) + 1;
        $done = count(array_filter($week, fn ($x) => $x['phase'] === 'ended'));
        $needAtt = count(array_filter($week, fn ($x) => $x['phase'] !== 'upcoming' && !$x['att']['locked'] && !isset($x['extra'])));
        $pending = (int) DB::table('sm_tt_requests')->where('teacher_id', $tid)->where('status', 'pending')->count();
        return response()->json([
            'teacher' => $this->teacherInfo($tid), 'today' => $today, 'now' => $this->now()->format('H:i'), 'periods' => $periods,
            'week' => ['from' => $from, 'to' => $to, 'lessons' => count($slots), 'done' => $done, 'need_att' => $needAtt,
                'classes' => count(array_unique(array_column($slots, 'class_id'))), 'subjects' => count(array_unique(array_column($slots, 'subject_id'))), 'by_day' => array_values($byDay)],
            'today_lessons' => $todayL, 'next' => $next, 'pending_requests' => $pending,
        ]);
    }

    /* ---------- 2. Tuần ---------- */
    public function week(Request $r)
    {
        [, $tid] = $this->scope($r);
        $date = $this->okDate($r->query('date')) ? $r->query('date') : $this->today();
        $from = $this->monday($date); $to = Carbon::parse($from)->addDays(5)->toDateString();
        $periods = $this->periods();
        return response()->json(['teacher' => $this->teacherInfo($tid), 'today' => $this->today(), 'from' => $from, 'to' => $to, 'periods' => $periods,
            'data' => $this->build($tid, $from, $to, $this->slots($tid), $periods)]);
    }

    /* ---------- 3. Lớp đang dạy ---------- */
    public function classes(Request $r)
    {
        [, $tid] = $this->scope($r);
        $yid = $this->yearId();
        $rows = DB::select("SELECT c.id class_id, c.name class_name, c.grade, s.id subject_id, s.name subject, cs.id cs,
              (SELECT COUNT(*) FROM sm_timetable t WHERE t.class_subject_id = cs.id) per_week,
              (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id AND e.school_year_id = c.school_year_id) total,
              (c.homeroom_teacher_id = ?) is_home
            FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id JOIN sm_subjects s ON s.id = cs.subject_id
            WHERE cs.teacher_id = ? AND c.school_year_id = ? ORDER BY c.grade, c.name, s.name", [$tid, $tid, $yid]);
        // lớp chủ nhiệm mà không dạy môn nào vẫn được xem
        $home = DB::table('sm_classes')->where('homeroom_teacher_id', $tid)->where('school_year_id', $yid)->first(['id', 'name', 'grade']);
        $data = array_map(fn ($x) => ['class_id' => (int) $x->class_id, 'class_name' => $x->class_name, 'grade' => (int) $x->grade, 'subject_id' => (int) $x->subject_id, 'subject' => $x->subject,
            'cs' => (int) $x->cs, 'per_week' => (int) $x->per_week, 'total' => (int) $x->total, 'is_home' => (bool) $x->is_home], $rows);
        return response()->json(['data' => $data, 'homeroom' => $home]);
    }

    /** Thời khóa biểu cả lớp (mọi môn, mọi giáo viên) – giáo viên dạy lớp đó hoặc chủ nhiệm mới xem được */
    public function classTable(Request $r, int $id)
    {
        [$st, $tid, $admin] = $this->scope($r);
        $yid = $this->yearId();
        $c = DB::table('sm_classes')->where('id', $id)->first(['id', 'name', 'grade', 'homeroom_teacher_id', 'school_year_id']);
        abort_unless($c, 404, 'Không tìm thấy lớp.');
        $ok = $admin || (int) $c->homeroom_teacher_id === $tid || DB::table('sm_class_subjects')->where('class_id', $id)->where('teacher_id', $tid)->exists();
        abort_unless($ok, 403, 'Bạn không dạy và không chủ nhiệm lớp này.');
        $rows = DB::select("SELECT t.weekday, t.period, s.name subject, s.code, tc.id teacher_id, tc.full_name teacher, cs.id cs
            FROM sm_timetable t JOIN sm_class_subjects cs ON cs.id = t.class_subject_id JOIN sm_subjects s ON s.id = cs.subject_id LEFT JOIN sm_teachers tc ON tc.id = cs.teacher_id
            WHERE t.class_id = ? ORDER BY t.weekday, t.period", [$id]);
        $home = $c->homeroom_teacher_id ? DB::table('sm_teachers')->where('id', $c->homeroom_teacher_id)->value('full_name') : null;
        return response()->json(['class' => ['id' => (int) $c->id, 'name' => $c->name, 'grade' => (int) $c->grade, 'homeroom' => $home, 'total' => (int) DB::table('sm_enrollments')->where('class_id', $id)->where('school_year_id', $c->school_year_id)->count()],
            'periods' => $this->periods(), 'mine' => $tid,
            'data' => array_map(fn ($x) => ['weekday' => (int) $x->weekday, 'period' => (int) $x->period, 'subject' => $x->subject, 'code' => $x->code, 'teacher_id' => (int) $x->teacher_id, 'teacher' => $x->teacher, 'cs' => (int) $x->cs], $rows)]);
    }

    /* ---------- 4. Khối lượng & tiết trống ---------- */
    public function load(Request $r)
    {
        [, $tid] = $this->scope($r);
        $slots = $this->slots($tid); $periods = $this->periods();
        $grid = []; foreach ($slots as $s) $grid[$s['weekday']][$s['period']] = $s;
        $byDay = []; $gaps = 0; $free = [];
        for ($w = 2; $w <= 7; $w++) {
            $ps = array_keys($grid[$w] ?? []); sort($ps);
            $byDay[] = count($ps);
            if (count($ps) > 1) $gaps += max($ps) - min($ps) + 1 - count($ps);   // tiết trống nằm giữa các tiết dạy
            foreach ($periods as $p) if (!isset($grid[$w][$p['id']])) $free[] = ['weekday' => $w, 'period' => $p['id']];
        }
        $byPeriod = []; foreach ($periods as $p) { $n = 0; for ($w = 2; $w <= 7; $w++) if (isset($grid[$w][$p['id']])) $n++; $byPeriod[] = $n; }
        $cls = []; foreach ($slots as $s) { $k = $s['class_id'] . '|' . $s['subject_id']; $cls[$k] = ($cls[$k] ?? ['class_name' => $s['class_name'], 'subject' => $s['subject'], 'n' => 0]); $cls[$k]['n']++; }
        $sub = []; foreach ($slots as $s) { $sub[$s['subject']] = ($sub[$s['subject']] ?? 0) + 1; }
        $busiest = 0; foreach ($byDay as $i => $n) if ($n > $byDay[$busiest]) $busiest = $i;
        return response()->json(['periods' => $periods, 'total' => count($slots), 'by_day' => $byDay, 'by_period' => $byPeriod, 'gaps' => $gaps,
            'busiest_weekday' => $busiest + 2, 'free' => $free, 'classes' => array_values($cls), 'subjects' => $sub,
            'busy' => array_map(fn ($s) => ['weekday' => $s['weekday'], 'period' => $s['period'], 'class_name' => $s['class_name'], 'subject' => $s['subject']], $slots)]);
    }

    /* ---------- 5. Gợi ý tiết trống để đổi / dạy bù ---------- */
    public function suggest(Request $r)
    {
        [, $tid] = $this->scope($r);
        $d = $r->validate(['class_subject_id' => 'required|integer', 'from' => 'nullable|date']);
        $cs = DB::table('sm_class_subjects')->find($d['class_subject_id']);
        abort_unless($cs && (int) $cs->teacher_id === $tid, 403, 'Bạn không dạy lớp môn này.');
        $from = $this->okDate($d['from'] ?? null) ? $d['from'] : Carbon::parse($this->today())->addDay()->toDateString();
        $mine = $this->slots($tid); $busyT = []; foreach ($mine as $s) $busyT[$s['weekday']][$s['period']] = true;
        $busyC = []; foreach (DB::select('SELECT weekday, period FROM sm_timetable WHERE class_id = ?', [$cs->class_id]) as $x) $busyC[(int) $x->weekday][(int) $x->period] = true;
        $taken = DB::table('sm_tt_requests')->whereIn('status', ['pending', 'approved'])->whereNotNull('to_date')->where('to_date', '>=', $from)
            ->where(fn ($q) => $q->where('teacher_id', $tid)->orWhere('class_id', $cs->class_id))->get(['to_date', 'to_period']);
        $tk = []; foreach ($taken as $x) $tk[$x->to_date . '|' . $x->to_period] = true;
        $periods = $this->periods(); $out = [];
        for ($i = 0; $i < 21 && count($out) < 18; $i++) {
            $date = Carbon::parse($from)->addDays($i)->toDateString(); $w = $this->wd($date);
            if ($w > 7) continue;
            foreach ($periods as $p) {
                if (isset($busyT[$w][$p['id']]) || isset($busyC[$w][$p['id']]) || isset($tk["$date|{$p['id']}"])) continue;
                $out[] = ['date' => $date, 'weekday' => $w, 'period' => $p['id'], 'start' => $p['start'], 'end' => $p['end']];
            }
        }
        return response()->json(['data' => $out]);
    }

    /* ---------- 6. Ghi chú / giáo án / phòng ---------- */
    public function notes(Request $r)
    {
        [, $tid] = $this->scope($r);
        $rows = DB::select("SELECT n.*, c.name class_name, s.name subject FROM sm_tt_notes n
            JOIN sm_class_subjects cs ON cs.id = n.class_subject_id JOIN sm_classes c ON c.id = cs.class_id JOIN sm_subjects s ON s.id = cs.subject_id
            WHERE n.teacher_id = ? AND n.kind <> 'room' ORDER BY n.pinned DESC, n.updated_at DESC LIMIT 300", [$tid]);
        return response()->json(['data' => array_map(fn ($n) => ['id' => (int) $n->id, 'kind' => $n->kind, 'cs' => (int) $n->class_subject_id, 'weekday' => (int) $n->weekday, 'period' => (int) $n->period,
            'date' => $n->att_date, 'title' => $n->title, 'content' => $n->content, 'color' => $n->color, 'pinned' => (bool) $n->pinned, 'class_name' => $n->class_name, 'subject' => $n->subject, 'updated_at' => $n->updated_at], $rows)]);
    }

    public function noteSave(Request $r)
    {
        [, $tid] = $this->scope($r);
        $d = $r->validate([
            'id' => 'nullable|integer', 'class_subject_id' => 'required|integer', 'weekday' => 'required|integer|between:2,7', 'period' => 'required|integer|between:1,12',
            'date' => 'nullable|date', 'kind' => 'required|in:note,plan,room', 'room' => 'nullable|string|max:40', 'title' => 'nullable|string|max:160',
            'content' => 'nullable|string|max:5000', 'color' => 'nullable|string|max:12', 'pinned' => 'nullable|boolean',
        ]);
        $ok = DB::table('sm_timetable')->where('class_subject_id', $d['class_subject_id'])->where('weekday', $d['weekday'])->where('period', $d['period'])->exists()
            && DB::table('sm_class_subjects')->where('id', $d['class_subject_id'])->where('teacher_id', $tid)->exists();
        abort_unless($ok, 422, 'Tiết này không có trong thời khóa biểu của bạn.');
        if ($d['kind'] === 'room') abort_unless(trim((string) ($d['room'] ?? '')) !== '', 422, 'Hãy nhập tên phòng học.');
        else abort_unless(trim((string) ($d['title'] ?? '') . (string) ($d['content'] ?? '')) !== '', 422, 'Hãy nhập tiêu đề hoặc nội dung ghi chú.');
        $row = ['class_subject_id' => $d['class_subject_id'], 'weekday' => $d['weekday'], 'period' => $d['period'], 'att_date' => $d['date'] ?? null, 'kind' => $d['kind'],
            'room' => $d['kind'] === 'room' ? trim($d['room']) : null, 'title' => $d['title'] ?? null, 'content' => $d['content'] ?? null, 'color' => $d['color'] ?? 'sky', 'pinned' => (int) ($d['pinned'] ?? 0), 'updated_at' => $this->utc()];
        if ($d['kind'] === 'room') {   // mỗi tiết chỉ có 1 phòng (cố định hoặc theo ngày)
            $ex = DB::table('sm_tt_notes')->where('teacher_id', $tid)->where('kind', 'room')->where('class_subject_id', $d['class_subject_id'])->where('weekday', $d['weekday'])->where('period', $d['period'])
                ->where(fn ($q) => $d['date'] ?? null ? $q->where('att_date', $d['date']) : $q->whereNull('att_date'))->value('id');
            if ($ex) $d['id'] = $ex;
        }
        if (!empty($d['id'])) {
            abort_unless(DB::table('sm_tt_notes')->where('id', $d['id'])->where('teacher_id', $tid)->exists(), 404, 'Không tìm thấy ghi chú.');
            DB::table('sm_tt_notes')->where('id', $d['id'])->where('teacher_id', $tid)->update($row);
            return response()->json(['message' => 'Đã cập nhật.', 'id' => (int) $d['id']]);
        }
        $id = DB::table('sm_tt_notes')->insertGetId($row + ['teacher_id' => $tid, 'created_at' => $this->utc()]);
        return response()->json(['message' => 'Đã lưu.', 'id' => $id]);
    }

    public function noteDelete(Request $r, int $id)
    {
        [, $tid] = $this->scope($r);
        $n = DB::table('sm_tt_notes')->where('id', $id)->where('teacher_id', $tid)->delete();
        abort_unless($n, 404, 'Không tìm thấy ghi chú.');
        return response()->json(['message' => 'Đã xóa.']);
    }

    /* ---------- 7. Yêu cầu thay đổi tiết ---------- */
    public function requests(Request $r)
    {
        [, $tid, $admin] = $this->scope($r);
        $all = $admin && $r->query('all') && !in_array($this->staff($r)->role, ['teacher', 'homeroom_teacher'], true);
        $q = DB::table('sm_tt_requests as q')->join('sm_class_subjects as cs', 'cs.id', '=', 'q.class_subject_id')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')->leftJoin('sm_teachers as t', 't.id', '=', 'q.teacher_id');
        if (!$all) $q->where('q.teacher_id', $tid);
        if (in_array($r->query('status'), ['pending', 'approved', 'rejected', 'cancelled'], true)) $q->where('q.status', $r->query('status'));
        $rows = $q->orderByRaw("q.status = 'pending' DESC")->orderByDesc('q.id')->limit(200)->get(['q.*', 'c.name as class_name', 's.name as subject', 't.full_name as teacher']);
        $counts = DB::table('sm_tt_requests')->when(!$all, fn ($x) => $x->where('teacher_id', $tid))->selectRaw('status, COUNT(*) n')->groupBy('status')->pluck('n', 'status');
        return response()->json(['counts' => $counts, 'data' => $rows->map(fn ($x) => [
            'id' => (int) $x->id, 'kind' => $x->kind, 'cs' => (int) $x->class_subject_id, 'class_name' => $x->class_name, 'subject' => $x->subject, 'teacher' => $x->teacher,
            'date' => $x->att_date, 'period' => (int) $x->period, 'to_date' => $x->to_date, 'to_period' => $x->to_period ? (int) $x->to_period : null, 'to_room' => $x->to_room,
            'reason' => $x->reason, 'status' => $x->status, 'review_note' => $x->review_note, 'reviewed_at' => $x->reviewed_at, 'created_at' => $x->created_at])->values()]);
    }

    public function requestCreate(Request $r)
    {
        [, $tid] = $this->scope($r);
        $d = $r->validate([
            'kind' => 'required|in:' . implode(',', self::KINDS), 'class_subject_id' => 'required|integer', 'date' => 'required|date', 'period' => 'required|integer|between:1,12',
            'to_date' => 'nullable|date', 'to_period' => 'nullable|integer|between:1,12', 'to_room' => 'nullable|string|max:40', 'reason' => 'required|string|min:5|max:500',
        ]);
        $cs = DB::table('sm_class_subjects')->find($d['class_subject_id']);
        abort_unless($cs && (int) $cs->teacher_id === $tid, 403, 'Bạn không dạy lớp môn này.');
        abort_unless(DB::table('sm_timetable')->where('class_subject_id', $cs->id)->where('period', $d['period'])->where('weekday', $this->wd($d['date']))->exists(), 422, 'Tiết này không có trong thời khóa biểu của ngày đã chọn.');
        abort_unless($d['date'] >= $this->today(), 422, 'Chỉ được gửi yêu cầu cho tiết từ hôm nay trở đi.');
        abort_if(DB::table('sm_tt_requests')->where('class_subject_id', $cs->id)->where('att_date', $d['date'])->where('period', $d['period'])->where('status', 'pending')->exists(), 422, 'Tiết này đã có yêu cầu đang chờ duyệt.');
        if (in_array($d['kind'], ['swap', 'makeup'], true)) {
            abort_unless(!empty($d['to_date']) && !empty($d['to_period']), 422, 'Hãy chọn ngày và tiết mới.');
            abort_unless($d['to_date'] >= $this->today(), 422, 'Ngày mới không được ở quá khứ.');
            $w = $this->wd($d['to_date']); abort_unless($w <= 7, 422, 'Ngày mới phải từ thứ 2 đến thứ 7.');
            abort_if(DB::table('sm_timetable as t')->join('sm_class_subjects as c', 'c.id', '=', 't.class_subject_id')->where('t.weekday', $w)->where('t.period', $d['to_period'])
                ->where(fn ($q) => $q->where('c.teacher_id', $tid)->orWhere('t.class_id', $cs->class_id))->exists(), 422, 'Tiết mới đã trùng lịch của bạn hoặc của lớp.');
            abort_if(DB::table('sm_tt_requests')->whereIn('status', ['pending', 'approved'])->where('to_date', $d['to_date'])->where('to_period', $d['to_period'])
                ->where(fn ($q) => $q->where('teacher_id', $tid)->orWhere('class_id', $cs->class_id))->exists(), 422, 'Tiết mới đã được dùng cho một yêu cầu khác.');
        }
        if ($d['kind'] === 'room') abort_unless(trim((string) ($d['to_room'] ?? '')) !== '', 422, 'Hãy nhập phòng học mới.');
        $id = DB::table('sm_tt_requests')->insertGetId(['teacher_id' => $tid, 'kind' => $d['kind'], 'class_subject_id' => $cs->id, 'class_id' => $cs->class_id, 'att_date' => $d['date'], 'period' => $d['period'],
            'to_date' => in_array($d['kind'], ['swap', 'makeup'], true) ? $d['to_date'] : null, 'to_period' => in_array($d['kind'], ['swap', 'makeup'], true) ? $d['to_period'] : null,
            'to_room' => $d['kind'] === 'room' ? trim($d['to_room']) : null, 'reason' => trim($d['reason']), 'status' => 'pending', 'created_at' => $this->utc(), 'updated_at' => $this->utc()]);
        return response()->json(['message' => 'Đã gửi yêu cầu đến nhà trường.', 'id' => $id]);
    }

    public function requestCancel(Request $r, int $id)
    {
        [, $tid] = $this->scope($r);
        $n = DB::table('sm_tt_requests')->where('id', $id)->where('teacher_id', $tid)->where('status', 'pending')->update(['status' => 'cancelled', 'updated_at' => $this->utc()]);
        abort_unless($n, 422, 'Chỉ hủy được yêu cầu đang chờ duyệt.');
        return response()->json(['message' => 'Đã hủy yêu cầu.']);
    }

    /** Dành cho Ban giám hiệu / giáo vụ: duyệt hoặc từ chối */
    public function requestReview(Request $r, int $id)
    {
        $st = $this->staff($r);
        abort_unless(in_array($st->role, self::ADMIN, true), 403, 'Chỉ Ban giám hiệu hoặc giáo vụ mới được duyệt.');
        $d = $r->validate(['action' => 'required|in:approve,reject', 'note' => 'nullable|string|max:500']);
        abort_if($d['action'] === 'reject' && trim((string) ($d['note'] ?? '')) === '', 422, 'Hãy nhập lý do từ chối.');
        $n = DB::table('sm_tt_requests')->where('id', $id)->where('status', 'pending')->update(['status' => $d['action'] === 'approve' ? 'approved' : 'rejected', 'reviewed_by' => $st->id,
            'reviewed_at' => $this->utc(), 'review_note' => $d['note'] ?? null, 'updated_at' => $this->utc()]);
        abort_unless($n, 422, 'Yêu cầu đã được xử lý hoặc không tồn tại.');
        return response()->json(['message' => $d['action'] === 'approve' ? 'Đã duyệt yêu cầu.' : 'Đã từ chối yêu cầu.']);
    }
}
