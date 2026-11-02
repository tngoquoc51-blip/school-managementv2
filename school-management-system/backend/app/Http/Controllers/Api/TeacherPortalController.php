<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Cổng giáo viên: hồ sơ giảng dạy, môn của tôi, lớp chủ nhiệm, duyệt đơn xin nghỉ. Mỗi giáo viên chỉ thấy dữ liệu của mình. */
class TeacherPortalController extends LessonAttendanceStaffController
{
    private function tid(Request $r): array
    {
        $st = $this->staff($r);
        abort_unless($st->role === 'teacher' && (int) ($st->teacher_id ?? 0) > 0, 403, 'Tài khoản này chưa được liên kết với giáo viên.');
        return [$st, (int) $st->teacher_id];
    }

    private function sy()
    {
        return DB::table('sm_school_years')->where('is_current', 1)->value('id');
    }

    private function home(int $tid)
    {
        return DB::table('sm_classes')->where('homeroom_teacher_id', $tid)->where('school_year_id', $this->sy())->first(['id', 'name', 'grade']);
    }

    public function profile(Request $r)
    {
        [, $tid] = $this->tid($r);
        $sy = $this->sy();
        $t = DB::table('sm_teachers as t')->leftJoin('sm_subjects as s', 's.id', '=', 't.main_subject_id')->where('t.id', $tid)
            ->first(['t.id', 't.code', 't.full_name', 't.gender', 's.name as main_subject']);
        $home = $this->home($tid);
        $a = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->where('cs.teacher_id', $tid)->where('c.school_year_id', $sy);
        return response()->json([
            'teacher' => $t, 'homeroom' => $home,
            'position' => ($home ? "Giáo viên chủ nhiệm lớp {$home->name} · " : '') . 'Giáo viên bộ môn ' . ($t->main_subject ?? ''),
            'stats' => [
                'classes' => (clone $a)->distinct()->count('c.id'), 'assignments' => (clone $a)->count(),
                'students' => $home ? DB::table('sm_enrollments')->where('class_id', $home->id)->where('school_year_id', $sy)->count() : 0,
                'pending_leaves' => $home ? $this->leaveQ($home->id, $sy)->where('lv.status', 'pending')->count() : 0,
            ],
        ]);
    }

    /** Các lớp-môn giáo viên đang dạy kèm tỷ lệ chuyên cần */
    public function assignments(Request $r)
    {
        [, $tid] = $this->tid($r);
        $rows = DB::select("SELECT cs.id, c.name AS class_name, c.grade, s.name AS subject, s.code,
              (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id AND e.school_year_id = c.school_year_id) AS students,
              (SELECT COUNT(*) FROM sm_timetable t WHERE t.class_subject_id = cs.id) AS periods_per_week,
              COALESCE(SUM(l.status IN ('present','late')), 0) AS good, COUNT(l.id) AS total
            FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id JOIN sm_subjects s ON s.id = cs.subject_id
            LEFT JOIN sm_att_lessons l ON l.class_subject_id = cs.id
            WHERE cs.teacher_id = ? AND c.school_year_id = ?
            GROUP BY cs.id, c.id, c.name, c.grade, c.school_year_id, s.name, s.code, s.sort_order ORDER BY c.grade, c.name, s.sort_order", [$tid, $this->sy()]);
        return response()->json(['data' => $rows]);
    }

    /** Học sinh của một lớp-môn và chuyên cần của từng em trong môn đó */
    public function assignment(Request $r, int $id)
    {
        [, $tid] = $this->tid($r);
        $cs = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->where('cs.id', $id)->where('cs.teacher_id', $tid)->first(['cs.id', 'c.id as class_id', 'c.school_year_id', 'c.name as class_name', 's.name as subject']);
        abort_unless($cs, 404, 'Bạn không được phân công dạy môn này.');
        $rows = DB::select("SELECT s.id, s.code, s.full_name, COUNT(l.id) AS total, COALESCE(SUM(l.status='present'),0) AS present,
              COALESCE(SUM(l.status='late'),0) AS late, COALESCE(SUM(l.status='excused'),0) AS excused, COALESCE(SUM(l.status='unexcused'),0) AS unexcused
            FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id
            LEFT JOIN sm_att_lessons l ON l.student_id = s.id AND l.class_subject_id = ?
            WHERE e.class_id = ? AND e.school_year_id = ? GROUP BY s.id, s.code, s.full_name ORDER BY s.full_name", [$id, $cs->class_id, $cs->school_year_id]);
        return response()->json(['class' => $cs->class_name, 'subject' => $cs->subject, 'data' => $rows]);
    }

    /** Lớp chủ nhiệm: danh sách học sinh + chuyên cần theo ngày */
    public function homeroom(Request $r)
    {
        [, $tid] = $this->tid($r);
        $h = $this->home($tid);
        abort_unless($h, 404, 'Bạn không phải giáo viên chủ nhiệm lớp nào trong năm học hiện tại.');
        $sy = $this->sy();
        $rows = DB::select("SELECT s.id, s.code, s.full_name, COUNT(r.id) AS total, COALESCE(SUM(r.status='present'),0) AS present,
              COALESCE(SUM(r.status='late'),0) AS late, COALESCE(SUM(r.status='excused'),0) AS excused, COALESCE(SUM(r.status='unexcused'),0) AS unexcused
            FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id
            LEFT JOIN sm_att_records r ON r.student_id = s.id AND r.school_year_id = e.school_year_id
            WHERE e.class_id = ? AND e.school_year_id = ? GROUP BY s.id, s.code, s.full_name ORDER BY s.full_name", [$h->id, $sy]);
        return response()->json(['class' => $h, 'data' => $rows]);
    }

    private function leaveQ(int $classId, int $sy)
    {
        return DB::table('sm_att_leaves as lv')->join('sm_enrollments as e', fn ($j) => $j->on('e.student_id', '=', 'lv.student_id')->where('e.class_id', $classId)->where('e.school_year_id', $sy));
    }

    public function leaves(Request $r)
    {
        [, $tid] = $this->tid($r);
        $h = $this->home($tid);
        abort_unless($h, 404, 'Bạn không phải giáo viên chủ nhiệm lớp nào.');
        $q = $this->leaveQ($h->id, $this->sy())->join('sm_students as s', 's.id', '=', 'lv.student_id');
        if (in_array($r->query('status'), ['pending', 'approved', 'rejected', 'cancelled'], true)) $q->where('lv.status', $r->query('status'));
        return response()->json(['data' => $q->orderByDesc('lv.id')->limit(100)->get(['lv.*', 's.code', 's.full_name'])]);
    }

    public function reviewLeave(Request $r, int $id)
    {
        [$st, $tid] = $this->tid($r);
        $h = $this->home($tid);
        abort_unless($h, 403, 'Chỉ giáo viên chủ nhiệm mới duyệt đơn xin nghỉ.');
        $d = $r->validate(['decision' => 'required|in:approve,reject', 'note' => 'nullable|string|max:255']);
        abort_if($d['decision'] === 'reject' && blank($d['note'] ?? null), 422, 'Vui lòng nhập lý do từ chối.');
        $lv = $this->leaveQ($h->id, $this->sy())->where('lv.id', $id)->first(['lv.*']);
        abort_unless($lv, 404, 'Không tìm thấy đơn của học sinh trong lớp bạn chủ nhiệm.');
        abort_unless($lv->status === 'pending', 422, 'Đơn này đã được xử lý hoặc đã bị huỷ.');
        DB::transaction(function () use ($d, $lv, $st) {
            $ok = $d['decision'] === 'approve';
            DB::table('sm_att_leaves')->where('id', $lv->id)->update([
                'status' => $ok ? 'approved' : 'rejected', 'reviewer_note' => $d['note'] ?? null,
                'reviewed_by' => $st->id, 'reviewed_at' => now(), 'updated_at' => now()]);
            if ($ok) {   // đơn được duyệt: các buổi vắng không phép trong khoảng ngày chuyển thành vắng có phép
                foreach (['sm_att_records', 'sm_att_lessons'] as $tb) {
                    DB::table($tb)->where('student_id', $lv->student_id)->whereBetween('att_date', [$lv->from_date, $lv->to_date])
                        ->where('status', 'unexcused')->update(['status' => 'excused', 'updated_at' => now()]);
                }
            }
        });
        return response()->json(['message' => $d['decision'] === 'approve' ? 'Đã duyệt đơn xin nghỉ.' : 'Đã từ chối đơn xin nghỉ.']);
    }
}
