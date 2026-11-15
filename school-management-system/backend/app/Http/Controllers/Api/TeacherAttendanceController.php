<?php

namespace App\Http\Controllers\Api;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Cổng giáo viên – ĐIỂM DANH TỪNG TIẾT (đi sau middleware StaffToken, prefix teacher/att).
 *
 * Dữ liệu từng học sinh nằm trong sm_att_lessons (bảng có sẵn). Khi giáo viên bấm "Hoàn tất & gửi nhà trường":
 *   - tiết học được ghi vào sm_att_submissions với trạng thái submitted = ĐÃ KHÓA, giáo viên không sửa được nữa;
 *   - Ban Giám hiệu thấy ngay ở /bgh/attendance/tiet-hoc;
 *   - điểm danh theo NGÀY (sm_att_records) được đồng bộ như trước.
 * Muốn sửa lại: giáo viên bấm "Xin mở khóa", Ban Giám hiệu duyệt (hoặc tự mở khóa).
 * Tiết đã điểm danh đủ nhưng quên bấm gửi sẽ được hệ thống tự khóa khi sang ngày hôm sau.
 */
class TeacherAttendanceController extends LessonAttendanceStaffController
{
    private const TZ = 'Asia/Ho_Chi_Minh';
    private const ADMIN = ['academic', 'principal', 'vice_principal', 'super_admin'];
    private const SUMS = "COALESCE(SUM(l.status = 'present'),0) present, COALESCE(SUM(l.status = 'late'),0) late, COALESCE(SUM(l.status = 'excused'),0) excused, COALESCE(SUM(l.status = 'unexcused'),0) unexcused";

    /* ---------- tiện ích ---------- */
    private function today(): string { return Carbon::now(self::TZ)->toDateString(); }
    private function nowUtc(): string { return now()->format('Y-m-d H:i:s'); }
    private function ph(int $n): string { return implode(',', array_fill(0, max(1, $n), '?')); }
    private function wd(string $date): int { return (int) date('N', strtotime($date)) + 1; }   // khớp sm_timetable.weekday (thứ 2 = 2)
    private function yearId(): int { return (int) (DB::table('sm_school_years')->where('is_current', 1)->value('id') ?: DB::table('sm_school_years')->max('id')); }
    private function okDate($s): bool { return is_string($s) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $s) && date('Y-m-d', strtotime($s)) === $s; }

    private function setting(string $k, $def)
    {
        try { $v = DB::table('sm_ca_settings')->where('k', $k)->value('v'); } catch (\Throwable $e) { $v = null; }
        return $v === null ? $def : $v;
    }

    /** [$staffRow, $teacherId, $isAdmin] – giáo viên xem của mình; BGH/giáo vụ có thể truyền teacher_id */
    private function scope(Request $r): array
    {
        $st = $this->staff($r);
        $admin = in_array($st->role, self::ADMIN, true);
        if (in_array($st->role, ['teacher', 'homeroom_teacher'], true)) $tid = (int) ($st->teacher_id ?? 0);
        else $tid = (int) $r->query('teacher_id', 0);
        abort_unless($tid > 0 || $admin, 403, 'Tài khoản này chưa được liên kết với giáo viên nào.');
        abort_unless($tid > 0, 422, 'Hãy chọn giáo viên cần xem.');
        return [$st, $tid, $admin];
    }

    /** Kiểm tra quyền với 1 tiết học; trả về [$staff, $classSubject, $yearId, $admin] */
    private function ctx(Request $r, int $csId, string $date, int $period): array
    {
        $st = $this->staff($r);
        $cs = DB::table('sm_class_subjects')->find($csId);
        abort_unless($cs, 404, 'Không tìm thấy lớp môn học.');
        $admin = in_array($st->role, self::ADMIN, true);
        abort_unless($admin || (in_array($st->role, ['teacher', 'homeroom_teacher'], true) && (int) ($st->teacher_id ?? 0) === (int) $cs->teacher_id),
            403, 'Bạn chỉ được điểm danh môn học và lớp do mình giảng dạy.');
        abort_unless($this->okDate($date), 422, 'Ngày không hợp lệ.');
        $ok = DB::table('sm_timetable')->where('class_id', $cs->class_id)->where('class_subject_id', $cs->id)->where('period', $period)->where('weekday', $this->wd($date))->exists();
        abort_unless($ok, 422, 'Tiết học này không có trong thời khoá biểu của ngày đã chọn.');
        $yid = (int) DB::table('sm_classes')->where('id', $cs->class_id)->value('school_year_id');
        return [$st, $cs, $yid, $admin];
    }

    private function sub(int $csId, string $date, int $period)
    {
        return DB::table('sm_att_submissions')->where('class_subject_id', $csId)->where('att_date', $date)->where('period', $period)->first();
    }

    /** Hệ thống tự khóa các tiết đã điểm danh đủ học sinh nhưng quên bấm gửi, của những ngày đã qua */
    public function autoLock(string $from, string $to): void
    {
        $to = min($to, Carbon::parse($this->today())->subDay()->toDateString());
        if ($from > $to) return;
        $now = $this->nowUtc();
        DB::statement("INSERT INTO sm_att_submissions (class_subject_id, class_id, teacher_id, school_year_id, att_date, period, total, present, late, excused, unexcused, status, submitted_by, submitted_at, note, created_at, updated_at)
            SELECT l.class_subject_id, l.class_id, cs.teacher_id, l.school_year_id, l.att_date, l.period, COUNT(*),
                   SUM(l.status = 'present'), SUM(l.status = 'late'), SUM(l.status = 'excused'), SUM(l.status = 'unexcused'), 'submitted', NULL, ?, 'Hệ thống tự khóa sau khi hết ngày', ?, ?
            FROM sm_att_lessons l JOIN sm_class_subjects cs ON cs.id = l.class_subject_id
            WHERE l.att_date BETWEEN ? AND ?
            GROUP BY l.class_subject_id, l.class_id, cs.teacher_id, l.school_year_id, l.att_date, l.period
            HAVING COUNT(*) >= (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = l.class_id AND e.school_year_id = l.school_year_id)
            ON DUPLICATE KEY UPDATE id = id", [$now, $now, $now, $from, $to]);
    }

    /* ---------- dữ liệu tiết học trong ngày ---------- */
    private function lessonRows(int $tid, string $date): array
    {
        $today = $this->today(); $hm = Carbon::now(self::TZ)->format('H:i:s');
        $rows = DB::select("SELECT t.period, p.start_time, p.end_time, cs.id AS class_subject_id, c.id AS class_id, c.name AS class_name, c.grade, s.name AS subject,
              (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id AND e.school_year_id = c.school_year_id) AS total,
              COALESCE(m.marked, 0) AS marked, COALESCE(m.present, 0) AS present, COALESCE(m.late, 0) AS late, COALESCE(m.excused, 0) AS excused, COALESCE(m.unexcused, 0) AS unexcused,
              sb.status AS sub_status, sb.submitted_at, sb.submitted_by, sb.note AS sub_note, sb.reopen_reason, sb.reopen_requested_at, sb.reopen_note
            FROM sm_timetable t JOIN sm_class_subjects cs ON cs.id = t.class_subject_id JOIN sm_classes c ON c.id = cs.class_id
            JOIN sm_subjects s ON s.id = cs.subject_id LEFT JOIN sm_periods p ON p.id = t.period
            LEFT JOIN (SELECT l.class_subject_id, l.period, COUNT(*) marked, " . self::SUMS . " FROM sm_att_lessons l WHERE l.att_date = ? GROUP BY l.class_subject_id, l.period) m
                   ON m.class_subject_id = cs.id AND m.period = t.period
            LEFT JOIN sm_att_submissions sb ON sb.class_subject_id = cs.id AND sb.period = t.period AND sb.att_date = ?
            WHERE cs.teacher_id = ? AND t.weekday = ? AND c.school_year_id = ?
            ORDER BY t.period, c.grade, c.name", [$date, $date, $tid, $this->wd($date), $this->yearId()]);
        return array_map(function ($x) use ($date, $today, $hm) {
            $total = (int) $x->total; $marked = (int) $x->marked;
            $state = $x->sub_status === 'submitted' ? 'locked' : ($x->sub_status === 'reopened' ? 'reopened' : ($marked > 0 && $marked >= $total ? 'ready' : ($marked > 0 ? 'draft' : 'todo')));
            $phase = $date < $today ? 'ended' : ($date > $today ? 'upcoming' : (!$x->start_time ? 'ongoing' : ($hm < $x->start_time ? 'upcoming' : ($hm <= $x->end_time ? 'ongoing' : 'ended'))));
            return [
                'class_subject_id' => (int) $x->class_subject_id, 'class_id' => (int) $x->class_id, 'class_name' => $x->class_name, 'grade' => (int) $x->grade, 'subject' => $x->subject,
                'period' => (int) $x->period, 'start' => $x->start_time ? substr($x->start_time, 0, 5) : null, 'end' => $x->end_time ? substr($x->end_time, 0, 5) : null,
                'total' => $total, 'marked' => $marked, 'state' => $state, 'phase' => $phase, 'overdue' => $phase === 'ended' && $state !== 'locked',
                'counts' => ['present' => (int) $x->present, 'late' => (int) $x->late, 'excused' => (int) $x->excused, 'unexcused' => (int) $x->unexcused],
                'submitted_at' => $x->submitted_at, 'auto' => $x->sub_status === 'submitted' && !$x->submitted_by, 'sub_note' => $x->sub_note,
                'request' => $x->reopen_requested_at ? ['reason' => $x->reopen_reason, 'at' => $x->reopen_requested_at] : null, 'reopen_note' => $x->reopen_note,
            ];
        }, $rows);
    }

    private function summarize(array $lessons): array
    {
        $s = ['lessons' => count($lessons), 'locked' => 0, 'ready' => 0, 'draft' => 0, 'todo' => 0, 'reopened' => 0, 'overdue' => 0, 'students' => 0, 'absent' => 0, 'late' => 0];
        foreach ($lessons as $l) {
            $s[$l['state']]++; if ($l['overdue']) $s['overdue']++;
            $s['students'] += $l['marked']; $s['absent'] += $l['counts']['excused'] + $l['counts']['unexcused']; $s['late'] += $l['counts']['late'];
        }
        return $s;
    }

    private function settingsOut(): array
    {
        return ['lock_days' => (int) $this->setting('lock_days', 7), 'good_rate' => (int) $this->setting('good_rate', 95), 'warn_rate' => (int) $this->setting('warn_rate', 85), 'alert_absent' => (int) $this->setting('alert_absent', 3)];
    }

    /** Tổng quan trong ngày: các tiết dạy + trạng thái điểm danh / khóa */
    public function overview(Request $r)
    {
        [, $tid] = $this->scope($r);
        $date = $this->okDate($r->query('date')) ? $r->query('date') : $this->today();
        $this->autoLock($date, $date);
        $teacher = DB::table('sm_teachers')->where('id', $tid)->first(['id', 'code', 'full_name']);
        $lessons = $this->lessonRows($tid, $date);
        $home = DB::table('sm_classes')->where('homeroom_teacher_id', $tid)->where('school_year_id', $this->yearId())->first(['id', 'name', 'grade']);
        return response()->json(['date' => $date, 'today' => $this->today(), 'teacher' => $teacher, 'homeroom' => $home, 'data' => $lessons, 'summary' => $this->summarize($lessons), 'settings' => $this->settingsOut()]);
    }

    /** Tiết còn thiếu của các ngày đã qua trong 14 ngày gần nhất (nhắc giáo viên bổ sung) */
    public function missing(Request $r)
    {
        [, $tid] = $this->scope($r);
        $today = $this->today(); $from = Carbon::parse($today)->subDays(13)->toDateString(); $to = Carbon::parse($today)->subDay()->toDateString();
        $this->autoLock($from, $to);
        $out = [];
        for ($d = Carbon::parse($from); $d->toDateString() <= $to; $d = $d->addDay()) {
            if ($d->isWeekend() && $d->dayOfWeek === 0) continue;
            foreach ($this->lessonRows($tid, $d->toDateString()) as $l) if ($l['state'] !== 'locked') $out[] = $l + ['date' => $d->toDateString()];
        }
        usort($out, fn ($a, $b) => [$b['date'], $a['period']] <=> [$a['date'], $b['period']]);
        return response()->json(['data' => array_slice($out, 0, 40), 'total' => count($out)]);
    }

    /** Lịch tuần (thứ 2 → thứ 7) kèm trạng thái từng tiết */
    public function week(Request $r)
    {
        [, $tid] = $this->scope($r);
        $base = $this->okDate($r->query('date')) ? $r->query('date') : $this->today();
        $mon = Carbon::parse($base)->startOfWeek()->toDateString();
        $this->autoLock($mon, Carbon::parse($mon)->addDays(5)->toDateString());
        $days = []; $all = [];
        for ($i = 0; $i < 6; $i++) {
            $d = Carbon::parse($mon)->addDays($i)->toDateString();
            $ls = $this->lessonRows($tid, $d); $days[] = ['date' => $d, 'lessons' => $ls]; $all = array_merge($all, $ls);
        }
        $periods = DB::select('SELECT id, start_time, end_time FROM sm_periods ORDER BY id');
        return response()->json(['from' => $mon, 'to' => Carbon::parse($mon)->addDays(5)->toDateString(), 'days' => $days, 'summary' => $this->summarize($all), 'today' => $this->today(),
            'periods' => array_map(fn ($p) => ['id' => (int) $p->id, 'start' => substr((string) $p->start_time, 0, 5), 'end' => substr((string) $p->end_time, 0, 5)], $periods)]);
    }

    /** Danh sách học sinh của một tiết + thông tin hỗ trợ (đơn nghỉ đã duyệt, vắng gần đây, các tiết khác trong ngày) */
    public function roster(Request $r)
    {
        $d = $r->validate(['class_subject_id' => 'required|integer', 'date' => 'required|date', 'period' => 'required|integer|between:1,10']);
        [$st, $cs, $yid, $admin] = $this->ctx($r, (int) $d['class_subject_id'], $d['date'], (int) $d['period']);
        $date = $d['date']; $period = (int) $d['period']; $today = $this->today();
        $from30 = Carbon::parse($date)->subDays(30)->toDateString();
        $rows = DB::select("SELECT s.id, s.code, s.full_name, l.status, l.note,
              (SELECT COUNT(*) FROM sm_att_lessons x WHERE x.student_id = s.id AND x.class_subject_id = ? AND x.status IN ('excused','unexcused') AND x.att_date BETWEEN ? AND ?) AS abs30,
              (SELECT COUNT(*) FROM sm_att_lessons x WHERE x.student_id = s.id AND x.class_subject_id = ? AND x.status = 'late' AND x.att_date BETWEEN ? AND ?) AS late30,
              (SELECT lv.id FROM sm_att_leaves lv WHERE lv.student_id = s.id AND lv.status = 'approved' AND ? BETWEEN lv.from_date AND lv.to_date ORDER BY lv.id DESC LIMIT 1) AS leave_id,
              (SELECT lv.reason FROM sm_att_leaves lv WHERE lv.student_id = s.id AND lv.status = 'approved' AND ? BETWEEN lv.from_date AND lv.to_date ORDER BY lv.id DESC LIMIT 1) AS leave_reason
            FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id
            LEFT JOIN sm_att_lessons l ON l.student_id = s.id AND l.att_date = ? AND l.period = ?
            WHERE e.class_id = ? AND e.school_year_id = ?
            ORDER BY SUBSTRING_INDEX(s.full_name, ' ', -1), s.full_name",
            [$cs->id, $from30, $date, $cs->id, $from30, $date, $date, $date, $date, $period, $cs->class_id, $yid]);
        $others = [];
        foreach (DB::select('SELECT student_id, period, status FROM sm_att_lessons WHERE class_id = ? AND att_date = ? AND period <> ?', [$cs->class_id, $date, $period]) as $o) $others[(int) $o->student_id][(int) $o->period] = $o->status;
        $info = DB::selectOne('SELECT c.name class_name, c.grade, s.name subject, p.start_time, p.end_time, t.full_name teacher
              FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id JOIN sm_subjects s ON s.id = cs.subject_id LEFT JOIN sm_teachers t ON t.id = cs.teacher_id
              LEFT JOIN sm_periods p ON p.id = ? WHERE cs.id = ?', [$period, $cs->id]);
        $sub = $this->sub((int) $cs->id, $date, $period);
        $lockDays = (int) $this->setting('lock_days', 7);
        $tooOld = !$admin && $lockDays > 0 && $date < Carbon::parse($today)->subDays($lockDays)->toDateString();
        $locked = ($sub && $sub->status === 'submitted') || $tooOld || $date > $today;
        return response()->json(['lesson' => [
            'class_subject_id' => (int) $cs->id, 'class_id' => (int) $cs->class_id, 'class_name' => $info->class_name, 'grade' => (int) $info->grade, 'subject' => $info->subject, 'teacher' => $info->teacher,
            'date' => $date, 'period' => $period, 'start' => $info->start_time ? substr($info->start_time, 0, 5) : null, 'end' => $info->end_time ? substr($info->end_time, 0, 5) : null,
            'locked' => $locked, 'lock_reason' => $date > $today ? 'future' : ($sub && $sub->status === 'submitted' ? 'submitted' : ($tooOld ? 'old' : null)),
            'submitted_at' => $sub && $sub->status === 'submitted' ? $sub->submitted_at : null, 'auto' => $sub && $sub->status === 'submitted' && !$sub->submitted_by,
            'status' => $sub->status ?? null, 'request' => $sub && $sub->reopen_requested_at ? ['reason' => $sub->reopen_reason, 'at' => $sub->reopen_requested_at] : null,
            'reopen_note' => $sub->reopen_note ?? null, 'lock_days' => $lockDays,
        ], 'data' => array_map(fn ($x) => [
            'id' => (int) $x->id, 'code' => $x->code, 'name' => $x->full_name, 'status' => $x->status, 'note' => $x->note ?? '', 'abs30' => (int) $x->abs30, 'late30' => (int) $x->late30,
            'leave' => $x->leave_id ? ['id' => (int) $x->leave_id, 'reason' => $x->leave_reason] : null, 'others' => (object) ($others[(int) $x->id] ?? []),
        ], $rows)]);
    }

    /** Lưu điểm danh (nháp) hoặc lưu & gửi nhà trường (submit = true → khóa) */
    public function save(Request $r)
    {
        $d = $r->validate([
            'class_subject_id' => 'required|integer', 'date' => 'required|date', 'period' => 'required|integer|between:1,10',
            'items' => 'required|array|min:1|max:120', 'items.*.student_id' => 'required|integer',
            'items.*.status' => 'required|in:present,late,excused,unexcused', 'items.*.note' => 'nullable|string|max:255',
        ]);
        [$st, $cs, $yid, $admin] = $this->ctx($r, (int) $d['class_subject_id'], $d['date'], (int) $d['period']);
        $date = $d['date']; $period = (int) $d['period']; $today = $this->today();
        abort_if($date > $today, 422, 'Không thể điểm danh cho ngày trong tương lai.');
        $lockDays = (int) $this->setting('lock_days', 7);
        abort_if(!$admin && $lockDays > 0 && $date < Carbon::parse($today)->subDays($lockDays)->toDateString(), 403, "Đã quá $lockDays ngày, tiết này không còn sửa được. Hãy liên hệ Ban Giám hiệu.");
        $sub = $this->sub((int) $cs->id, $date, $period);
        abort_if($sub && $sub->status === 'submitted', 423, 'Tiết học này đã khóa và gửi về nhà trường. Bấm “Xin mở khóa” nếu cần chỉnh sửa.');

        $ids = array_values(array_unique(array_map('intval', array_column($d['items'], 'student_id'))));
        abort_unless(DB::table('sm_enrollments')->where('class_id', $cs->class_id)->where('school_year_id', $yid)->whereIn('student_id', $ids)->count() === count($ids), 422, 'Danh sách có học sinh không thuộc lớp này.');
        $m = (int) date('n', strtotime($date)); $now = $this->nowUtc();
        $rows = []; foreach ($d['items'] as $i) {
            $rows[(int) $i['student_id']] = ['student_id' => (int) $i['student_id'], 'class_id' => $cs->class_id, 'class_subject_id' => $cs->id, 'school_year_id' => $yid, 'semester' => ($m >= 2 && $m <= 8) ? 2 : 1,
                'att_date' => $date, 'period' => $period, 'status' => $i['status'], 'note' => isset($i['note']) && trim($i['note']) !== '' ? mb_substr(trim($i['note']), 0, 255) : null,
                'recorded_by' => $st->id, 'created_at' => $now, 'updated_at' => $now];
        }
        $submit = $r->boolean('submit');
        $result = null;
        DB::transaction(function () use ($rows, $ids, $cs, $date, $period, $yid, $submit, $st, $now, &$result) {
            DB::table('sm_att_lessons')->upsert(array_values($rows), ['student_id', 'att_date', 'period'], ['class_subject_id', 'status', 'note', 'recorded_by', 'updated_at']);
            $this->syncDay($ids, (int) $cs->class_id, $yid, $date, $now);
            if ($submit) $result = $this->doSubmit($cs, $yid, $date, $period, (int) $st->id, $now);
        });
        return response()->json(['message' => $submit ? 'Đã hoàn tất điểm danh và gửi về nhà trường. Tiết học đã được khóa.' : 'Đã lưu nháp điểm danh cho ' . count($rows) . ' học sinh.',
            'data' => ['submitted' => $submit, 'counts' => $result]]);
    }

    /** Gửi & khóa một tiết đã điểm danh trước đó (không cần gửi lại danh sách) */
    public function submit(Request $r)
    {
        $d = $r->validate(['class_subject_id' => 'required|integer', 'date' => 'required|date', 'period' => 'required|integer|between:1,10']);
        [$st, $cs, $yid, $admin] = $this->ctx($r, (int) $d['class_subject_id'], $d['date'], (int) $d['period']);
        abort_if($d['date'] > $this->today(), 422, 'Không thể gửi tiết học của ngày trong tương lai.');
        $sub = $this->sub((int) $cs->id, $d['date'], (int) $d['period']);
        abort_if($sub && $sub->status === 'submitted', 422, 'Tiết học này đã được gửi và khóa.');
        $res = null; $now = $this->nowUtc();
        DB::transaction(function () use (&$res, $cs, $yid, $d, $st, $now) { $res = $this->doSubmit($cs, $yid, $d['date'], (int) $d['period'], (int) $st->id, $now); });
        return response()->json(['message' => 'Đã gửi điểm danh về nhà trường và khóa tiết học.', 'data' => ['counts' => $res]]);
    }

    private function doSubmit($cs, int $yid, string $date, int $period, int $by, string $now): array
    {
        $total = (int) DB::table('sm_enrollments')->where('class_id', $cs->class_id)->where('school_year_id', $yid)->count();
        $c = DB::selectOne("SELECT COUNT(*) marked, COALESCE(SUM(status = 'present'),0) present, COALESCE(SUM(status = 'late'),0) late, COALESCE(SUM(status = 'excused'),0) excused, COALESCE(SUM(status = 'unexcused'),0) unexcused
              FROM sm_att_lessons WHERE class_subject_id = ? AND att_date = ? AND period = ?", [$cs->id, $date, $period]);
        if ((int) $c->marked < $total) {
            $miss = DB::select('SELECT s.full_name FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id WHERE e.class_id = ? AND e.school_year_id = ?
                 AND NOT EXISTS (SELECT 1 FROM sm_att_lessons l WHERE l.student_id = s.id AND l.att_date = ? AND l.period = ?) ORDER BY s.full_name LIMIT 5', [$cs->class_id, $yid, $date, $period]);
            abort(422, 'Còn ' . ($total - (int) $c->marked) . ' học sinh chưa được điểm danh' . ($miss ? ' (' . implode(', ', array_map(fn ($x) => $x->full_name, $miss)) . (($total - (int) $c->marked) > 5 ? '…' : '') . ')' : '') . '.');
        }
        $vals = ['total' => $total, 'present' => (int) $c->present, 'late' => (int) $c->late, 'excused' => (int) $c->excused, 'unexcused' => (int) $c->unexcused];
        $old = $this->sub((int) $cs->id, $date, $period);
        if ($old) {
            DB::table('sm_att_submissions')->where('id', $old->id)->update($vals + ['status' => 'submitted', 'teacher_id' => $cs->teacher_id, 'submitted_by' => $by, 'submitted_at' => $now, 'note' => null,
                'reopen_reason' => null, 'reopen_requested_at' => null, 'updated_at' => $now]);
        } else {
            DB::table('sm_att_submissions')->insert($vals + ['class_subject_id' => $cs->id, 'class_id' => $cs->class_id, 'teacher_id' => $cs->teacher_id, 'school_year_id' => $yid, 'att_date' => $date, 'period' => $period,
                'status' => 'submitted', 'submitted_by' => $by, 'submitted_at' => $now, 'created_at' => $now, 'updated_at' => $now]);
        }
        return $vals;
    }

    /** Đồng bộ điểm danh THEO NGÀY (sm_att_records): vắng ≥ 1/2 số tiết đã ghi nhận → vắng cả ngày; có vắng/muộn tiết khác → đi muộn */
    private function syncDay(array $ids, int $classId, int $yid, string $date, string $now): void
    {
        if (!$ids) return;
        $in = $this->ph(count($ids));
        $agg = DB::select("SELECT l.student_id,
              CASE WHEN SUM(l.status IN ('excused','unexcused')) > 0 AND SUM(l.status IN ('excused','unexcused')) * 2 >= COUNT(*)
                   THEN IF(SUM(l.status = 'unexcused') > 0, 'unexcused', 'excused')
                   WHEN SUM(l.status <> 'present') > 0 THEN 'late' ELSE 'present' END AS st
            FROM sm_att_lessons l WHERE l.att_date = ? AND l.class_id = ? AND l.school_year_id = ? AND l.student_id IN ($in) GROUP BY l.student_id", array_merge([$date, $classId, $yid], $ids));
        $have = [];
        foreach (DB::select("SELECT id, student_id FROM sm_att_records WHERE school_year_id = ? AND att_date = ? AND student_id IN ($in) ORDER BY id", array_merge([$yid, $date], $ids)) as $x) $have[(int) $x->student_id] = (int) $x->id;
        foreach ($agg as $a) {
            if (isset($have[(int) $a->student_id])) DB::table('sm_att_records')->where('id', $have[(int) $a->student_id])->update(['status' => $a->st, 'class_id' => $classId, 'updated_at' => $now]);
            else DB::table('sm_att_records')->insert(['student_id' => $a->student_id, 'class_id' => $classId, 'school_year_id' => $yid, 'att_date' => $date, 'status' => $a->st, 'created_at' => $now, 'updated_at' => $now]);
        }
    }

    /** Giáo viên xin Ban Giám hiệu mở khóa một tiết đã gửi */
    public function reopenRequest(Request $r)
    {
        $d = $r->validate(['class_subject_id' => 'required|integer', 'date' => 'required|date', 'period' => 'required|integer|between:1,10', 'reason' => 'required|string|min:5|max:255']);
        [, $cs] = $this->ctx($r, (int) $d['class_subject_id'], $d['date'], (int) $d['period']);
        $sub = $this->sub((int) $cs->id, $d['date'], (int) $d['period']);
        abort_unless($sub && $sub->status === 'submitted', 422, 'Tiết học này chưa bị khóa nên không cần xin mở khóa.');
        abort_if($sub->reopen_requested_at, 422, 'Bạn đã gửi yêu cầu mở khóa, vui lòng chờ Ban Giám hiệu xử lý.');
        DB::table('sm_att_submissions')->where('id', $sub->id)->update(['reopen_reason' => trim($d['reason']), 'reopen_requested_at' => $this->nowUtc(), 'reopen_note' => null, 'updated_at' => $this->nowUtc()]);
        return response()->json(['message' => 'Đã gửi yêu cầu mở khóa tới Ban Giám hiệu.']);
    }

    /** Lịch sử các tiết đã gửi */
    public function history(Request $r)
    {
        [, $tid] = $this->scope($r);
        $to = $this->okDate($r->query('to')) ? $r->query('to') : $this->today();
        $from = $this->okDate($r->query('from')) ? $r->query('from') : Carbon::parse($to)->subDays(29)->toDateString();
        if (abs(Carbon::parse($from)->diffInDays(Carbon::parse($to))) > 200) $from = Carbon::parse($to)->subDays(200)->toDateString();
        $this->autoLock($from, $to);
        $csId = (int) $r->query('class_subject_id', 0);
        $w = 'WHERE cs.teacher_id = ? AND sb.att_date BETWEEN ? AND ?'; $b = [$tid, $from, $to];
        if ($csId) { $w .= ' AND sb.class_subject_id = ?'; $b[] = $csId; }
        if ($r->query('status') === 'requested') $w .= ' AND sb.reopen_requested_at IS NOT NULL';
        elseif ($r->query('status') === 'reopened') $w .= " AND sb.status = 'reopened'";
        $base = ' FROM sm_att_submissions sb JOIN sm_class_subjects cs ON cs.id = sb.class_subject_id JOIN sm_classes c ON c.id = sb.class_id JOIN sm_subjects s ON s.id = cs.subject_id ' . $w;
        $per = max(5, min(60, (int) $r->query('per', 20))); $page = max(1, (int) $r->query('page', 1));
        $total = (int) (DB::selectOne('SELECT COUNT(*) n' . $base, $b)->n ?? 0);
        $rows = DB::select('SELECT sb.*, c.name class_name, s.name subject' . $base . " ORDER BY sb.att_date DESC, sb.period DESC LIMIT $per OFFSET " . (($page - 1) * $per), $b);
        $subs = DB::select("SELECT cs.id, c.name class_name, s.name subject FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id AND c.school_year_id = ? JOIN sm_subjects s ON s.id = cs.subject_id WHERE cs.teacher_id = ? ORDER BY c.grade, c.name, s.sort_order", [$this->yearId(), $tid]);
        return response()->json(['from' => $from, 'to' => $to, 'data' => array_map(fn ($x) => [
            'id' => (int) $x->id, 'class_subject_id' => (int) $x->class_subject_id, 'date' => substr((string) $x->att_date, 0, 10), 'period' => (int) $x->period, 'class_name' => $x->class_name, 'subject' => $x->subject,
            'total' => (int) $x->total, 'present' => (int) $x->present, 'late' => (int) $x->late, 'excused' => (int) $x->excused, 'unexcused' => (int) $x->unexcused,
            'status' => $x->status, 'submitted_at' => $x->submitted_at, 'auto' => !$x->submitted_by && $x->status === 'submitted', 'reopened_at' => $x->reopened_at,
            'request' => $x->reopen_requested_at ? ['reason' => $x->reopen_reason, 'at' => $x->reopen_requested_at] : null, 'reopen_note' => $x->reopen_note,
        ], $rows), 'subjects' => array_map(fn ($x) => ['id' => (int) $x->id, 'label' => $x->class_name . ' · ' . $x->subject], $subs),
            'meta' => ['total' => $total, 'page' => $page, 'per' => $per, 'pages' => max(1, (int) ceil($total / $per))]]);
    }

    /** Thống kê chuyên cần các lớp-môn giáo viên dạy + học sinh vắng nhiều */
    public function stats(Request $r)
    {
        [, $tid] = $this->scope($r);
        $to = $this->okDate($r->query('to')) ? $r->query('to') : $this->today();
        $from = $this->okDate($r->query('from')) ? $r->query('from') : Carbon::parse($to)->startOfMonth()->toDateString();
        if ($from > $to) [$from, $to] = [$to, $from];
        $yid = $this->yearId(); $set = $this->settingsOut();
        $rows = DB::select("SELECT cs.id AS class_subject_id, c.name AS class_name, c.grade, s.name AS subject, COUNT(l.id) AS total,
              COUNT(DISTINCT CONCAT(l.att_date, '-', l.period)) AS sessions, " . self::SUMS . "
            FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id AND c.school_year_id = ? JOIN sm_subjects s ON s.id = cs.subject_id
            LEFT JOIN sm_att_lessons l ON l.class_subject_id = cs.id AND l.att_date BETWEEN ? AND ?
            WHERE cs.teacher_id = ? GROUP BY cs.id, c.name, c.grade, s.name, s.sort_order ORDER BY c.grade, c.name, s.sort_order", [$yid, $from, $to, $tid]);
        $trend = DB::select("SELECT l.att_date AS d, COUNT(*) total, " . self::SUMS . " FROM sm_att_lessons l JOIN sm_class_subjects cs ON cs.id = l.class_subject_id
            WHERE cs.teacher_id = ? AND l.att_date BETWEEN ? AND ? GROUP BY l.att_date ORDER BY l.att_date", [$tid, $from, $to]);
        $risk = DB::select("SELECT s.id, s.code, s.full_name, c.name class_name, COUNT(*) total,
              COALESCE(SUM(l.status IN ('excused','unexcused')),0) absent, COALESCE(SUM(l.status = 'unexcused'),0) unexcused, COALESCE(SUM(l.status = 'late'),0) late
            FROM sm_att_lessons l JOIN sm_class_subjects cs ON cs.id = l.class_subject_id JOIN sm_students s ON s.id = l.student_id JOIN sm_classes c ON c.id = l.class_id
            WHERE cs.teacher_id = ? AND l.att_date BETWEEN ? AND ? GROUP BY s.id, s.code, s.full_name, c.name
            HAVING absent >= ? ORDER BY absent DESC, unexcused DESC LIMIT 30", [$tid, $from, $to, max(1, $set['alert_absent'])]);
        $rate = fn ($x) => (int) $x->total > 0 ? round(100 * ((int) $x->present + (int) $x->late) / (int) $x->total, 1) : null;
        return response()->json(['from' => $from, 'to' => $to, 'settings' => $set, 'data' => array_map(fn ($x) => [
            'class_subject_id' => (int) $x->class_subject_id, 'class_name' => $x->class_name, 'grade' => (int) $x->grade, 'subject' => $x->subject, 'sessions' => (int) $x->sessions,
            'total' => (int) $x->total, 'present' => (int) $x->present, 'late' => (int) $x->late, 'excused' => (int) $x->excused, 'unexcused' => (int) $x->unexcused, 'rate' => $rate($x),
        ], $rows), 'trend' => array_map(fn ($x) => ['d' => substr((string) $x->d, 0, 10), 'total' => (int) $x->total, 'present' => (int) $x->present, 'late' => (int) $x->late, 'absent' => (int) $x->excused + (int) $x->unexcused, 'rate' => $rate($x)], $trend),
            'risk' => array_map(fn ($x) => ['id' => (int) $x->id, 'code' => $x->code, 'name' => $x->full_name, 'class_name' => $x->class_name, 'total' => (int) $x->total, 'absent' => (int) $x->absent, 'unexcused' => (int) $x->unexcused, 'late' => (int) $x->late], $risk)]);
    }

    /** Hồ sơ chuyên cần của một học sinh trong các môn giáo viên dạy */
    public function student(Request $r, int $id)
    {
        [, $tid] = $this->scope($r);
        $s = DB::table('sm_students')->where('id', $id)->first(['id', 'code', 'full_name']);
        abort_unless($s, 404, 'Không tìm thấy học sinh.');
        $csId = (int) $r->query('class_subject_id', 0);
        $from = Carbon::parse($this->today())->subDays(90)->toDateString();
        $w = 'l.student_id = ? AND cs.teacher_id = ? AND l.att_date >= ?'; $b = [$id, $tid, $from];
        if ($csId) { $w .= ' AND l.class_subject_id = ?'; $b[] = $csId; }
        $list = DB::select("SELECT l.att_date, l.period, l.status, l.note, sub.name subject FROM sm_att_lessons l JOIN sm_class_subjects cs ON cs.id = l.class_subject_id JOIN sm_subjects sub ON sub.id = cs.subject_id
            WHERE $w ORDER BY l.att_date DESC, l.period DESC LIMIT 200", $b);
        $sum = ['total' => 0, 'present' => 0, 'late' => 0, 'excused' => 0, 'unexcused' => 0];
        foreach ($list as $x) { $sum['total']++; $sum[$x->status]++; }
        $cls = DB::selectOne('SELECT c.name FROM sm_enrollments e JOIN sm_classes c ON c.id = e.class_id WHERE e.student_id = ? AND e.school_year_id = ?', [$id, $this->yearId()]);
        return response()->json(['student' => ['id' => (int) $s->id, 'code' => $s->code, 'name' => $s->full_name, 'class_name' => $cls->name ?? ''], 'summary' => $sum,
            'records' => array_map(fn ($x) => ['date' => substr((string) $x->att_date, 0, 10), 'period' => (int) $x->period, 'status' => $x->status, 'note' => $x->note, 'subject' => $x->subject], $list)]);
    }

    /** Lớp chủ nhiệm: điểm danh theo ngày + từng tiết trong ngày + tình hình nộp của các tiết */
    public function homeroom(Request $r)
    {
        [, $tid] = $this->scope($r);
        $date = $this->okDate($r->query('date')) ? $r->query('date') : $this->today();
        $yid = $this->yearId();
        $h = DB::table('sm_classes')->where('homeroom_teacher_id', $tid)->where('school_year_id', $yid)->first(['id', 'name', 'grade']);
        if (!$h) return response()->json(['message' => 'Bạn không phải giáo viên chủ nhiệm lớp nào trong năm học hiện tại.', 'class' => null, 'data' => []]);
        $this->autoLock($date, $date);
        $rows = DB::select("SELECT s.id, s.code, s.full_name, r.status AS day_status, r.note AS day_note,
              (SELECT lv.reason FROM sm_att_leaves lv WHERE lv.student_id = s.id AND lv.status = 'approved' AND ? BETWEEN lv.from_date AND lv.to_date ORDER BY lv.id DESC LIMIT 1) AS leave_reason
            FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id
            LEFT JOIN sm_att_records r ON r.student_id = s.id AND r.school_year_id = e.school_year_id AND r.att_date = ?
            WHERE e.class_id = ? AND e.school_year_id = ? ORDER BY SUBSTRING_INDEX(s.full_name, ' ', -1), s.full_name", [$date, $date, $h->id, $yid]);
        $per = [];
        foreach (DB::select('SELECT student_id, period, status FROM sm_att_lessons WHERE class_id = ? AND att_date = ?', [$h->id, $date]) as $x) $per[(int) $x->student_id][(int) $x->period] = $x->status;
        $lessons = DB::select("SELECT t.period, s.name subject, tc.full_name teacher, COALESCE(m.marked,0) marked, sb.status sub_status
            FROM sm_timetable t JOIN sm_class_subjects cs ON cs.id = t.class_subject_id JOIN sm_subjects s ON s.id = cs.subject_id LEFT JOIN sm_teachers tc ON tc.id = cs.teacher_id
            LEFT JOIN (SELECT class_subject_id, period, COUNT(*) marked FROM sm_att_lessons WHERE att_date = ? GROUP BY class_subject_id, period) m ON m.class_subject_id = cs.id AND m.period = t.period
            LEFT JOIN sm_att_submissions sb ON sb.class_subject_id = cs.id AND sb.period = t.period AND sb.att_date = ?
            WHERE t.class_id = ? AND t.weekday = ? ORDER BY t.period", [$date, $date, $h->id, $this->wd($date)]);
        $sum = ['present' => 0, 'late' => 0, 'excused' => 0, 'unexcused' => 0, 'unmarked' => 0];
        foreach ($rows as $x) { if ($x->day_status) $sum[$x->day_status]++; else $sum['unmarked']++; }
        return response()->json(['class' => $h, 'date' => $date, 'summary' => $sum, 'total' => count($rows),
            'lessons' => array_map(fn ($x) => ['period' => (int) $x->period, 'subject' => $x->subject, 'teacher' => $x->teacher, 'marked' => (int) $x->marked, 'submitted' => $x->sub_status === 'submitted'], $lessons),
            'data' => array_map(fn ($x) => ['id' => (int) $x->id, 'code' => $x->code, 'name' => $x->full_name, 'status' => $x->day_status, 'note' => $x->day_note, 'leave' => $x->leave_reason, 'periods' => (object) ($per[(int) $x->id] ?? [])], $rows)]);
    }
}
