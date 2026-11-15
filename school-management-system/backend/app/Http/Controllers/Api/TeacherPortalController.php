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
        abort_unless(in_array($st->role, ['teacher', 'homeroom_teacher'], true) && (int) ($st->teacher_id ?? 0) > 0, 403, 'Tài khoản này chưa được liên kết với giáo viên.');
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

    private function phone($v)
    {
        if (!$v) return null;
        if (preg_match('/^[0-9+().\s-]{8,20}$/', $v)) return $v;
        try { return \Illuminate\Support\Facades\Crypt::decryptString($v); } catch (\Throwable $e) { return null; }
    }

    /** Dashboard giáo viên chủ nhiệm: chuyên cần, học sinh cần chú ý, đơn xin nghỉ, học lực, hạnh kiểm, thời khoá biểu */
    public function dashboard(Request $r)
    {
        [, $tid] = $this->tid($r);
        $h = $this->home($tid);
        abort_unless($h, 404, 'Bạn không phải giáo viên chủ nhiệm lớp nào trong năm học hiện tại.');
        $y = DB::table('sm_school_years')->where('is_current', 1)->first(['id', 'label']);
        $sy = (int) $y->id;
        $n = DB::table('sm_enrollments')->where('class_id', $h->id)->where('school_year_id', $sy)->count();

        $trend = array_reverse(DB::select("SELECT att_date, COUNT(*) AS total, SUM(status='present') AS present, SUM(status='late') AS late,
              SUM(status='excused') AS excused, SUM(status='unexcused') AS unexcused FROM sm_att_records
              WHERE class_id = ? AND school_year_id = ? GROUP BY att_date ORDER BY att_date DESC LIMIT 14", [$h->id, $sy]));
        $last = $trend ? end($trend)->att_date : null;
        $absent = $last ? DB::select("SELECT s.id, s.code, s.full_name, r.status FROM sm_att_records r JOIN sm_students s ON s.id = r.student_id
              WHERE r.class_id = ? AND r.att_date = ? AND r.status <> 'present' ORDER BY r.status, s.full_name", [$h->id, $last]) : [];

        $att = DB::select("SELECT s.id, s.code, s.full_name, COUNT(r.id) AS total, COALESCE(SUM(r.status IN ('present','late')),0) AS good,
              COALESCE(SUM(r.status='unexcused'),0) AS unexcused FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id
              LEFT JOIN sm_att_records r ON r.student_id = s.id AND r.school_year_id = e.school_year_id
              WHERE e.class_id = ? AND e.school_year_id = ? GROUP BY s.id, s.code, s.full_name", [$h->id, $sy]);
        $avg = [];
        foreach (DB::select("SELECT student_id, ROUND(AVG(tbm),2) AS avg FROM sm_grades WHERE class_id = ? AND school_year_id = ? AND tbm IS NOT NULL GROUP BY student_id", [$h->id, $sy]) as $g) {
            $avg[$g->student_id] = (float) $g->avg;
        }
        $good = $total = 0; $attention = []; $ranked = []; $dist = ['gioi' => 0, 'kha' => 0, 'tb' => 0, 'yeu' => 0];
        foreach ($att as $a) {
            $good += $a->good; $total += $a->total;
            $rate = $a->total ? round(100 * $a->good / $a->total, 1) : null;
            $g = $avg[$a->id] ?? null;
            $why = [];
            if ($rate !== null && $rate < 90) $why[] = "Chuyên cần $rate%";
            if ($a->unexcused >= 3) $why[] = "{$a->unexcused} buổi vắng không phép";
            if ($g !== null && $g < 5) $why[] = "ĐTB $g (yếu)";
            if ($why) $attention[] = ['id' => $a->id, 'code' => $a->code, 'full_name' => $a->full_name, 'rate' => $rate, 'avg' => $g, 'reasons' => $why];
            if ($g !== null) {
                $dist[$g >= 8 ? 'gioi' : ($g >= 6.5 ? 'kha' : ($g >= 5 ? 'tb' : 'yeu'))]++;
                $ranked[] = ['id' => $a->id, 'full_name' => $a->full_name, 'avg' => $g];
            }
        }
        usort($attention, fn ($p, $q) => count($q['reasons']) <=> count($p['reasons']) ?: ($p['rate'] ?? 100) <=> ($q['rate'] ?? 100));
        usort($ranked, fn ($p, $q) => $q['avg'] <=> $p['avg']);

        $lv = $this->leaveQ($h->id, $sy)->join('sm_students as s', 's.id', '=', 'lv.student_id')->where('lv.status', 'pending');
        $dow = (int) date('N');
        $date = $dow >= 6 ? date('Y-m-d', strtotime('next monday')) : date('Y-m-d');
        $tt = DB::select("SELECT t.period, p.start_time, p.end_time, s.name AS subject, te.full_name AS teacher,
              (SELECT COUNT(*) FROM sm_att_lessons l WHERE l.class_subject_id = cs.id AND l.att_date = ? AND l.period = t.period) AS marked
            FROM sm_timetable t JOIN sm_class_subjects cs ON cs.id = t.class_subject_id JOIN sm_subjects s ON s.id = cs.subject_id
            LEFT JOIN sm_teachers te ON te.id = cs.teacher_id LEFT JOIN sm_periods p ON p.id = t.period
            WHERE t.class_id = ? AND t.weekday = ? ORDER BY t.period", [$date, $h->id, (int) date('N', strtotime($date)) + 1]);

        return response()->json([
            'class' => $h, 'year' => $y->label, 'teacher' => DB::table('sm_teachers')->where('id', $tid)->value('full_name'),
            'kpi' => ['students' => $n, 'attendance' => $total ? round(100 * $good / $total, 1) : null, 'last_date' => $last,
                'absent_last' => count($absent), 'pending_leaves' => (clone $lv)->count(), 'avg_grade' => $avg ? round(array_sum($avg) / count($avg), 2) : null, 'attention' => count($attention)],
            'trend' => $trend, 'absent' => $absent, 'attention' => array_slice($attention, 0, 10),
            'leaves' => (clone $lv)->orderBy('lv.id')->limit(6)->get(['lv.id', 'lv.leave_type', 'lv.from_date', 'lv.to_date', 'lv.reason', 's.full_name', 's.code']),
            'dist' => $dist, 'top' => array_slice($ranked, 0, 5), 'bottom' => array_slice(array_reverse($ranked), 0, 5),
            'subjects' => DB::select("SELECT s.name, ROUND(AVG(g.tbm),2) AS avg FROM sm_grades g JOIN sm_subjects s ON s.id = g.subject_id
                WHERE g.class_id = ? AND g.school_year_id = ? AND g.tbm IS NOT NULL GROUP BY s.id, s.name, s.sort_order ORDER BY s.sort_order", [$h->id, $sy]),
            'conduct' => DB::select("SELECT COALESCE(NULLIF(c.hk2,''), NULLIF(c.hk1,'')) AS rating, COUNT(*) AS n FROM sm_conduct c
                JOIN sm_enrollments e ON e.student_id = c.student_id AND e.class_id = ? AND e.school_year_id = c.school_year_id
                WHERE c.school_year_id = ? GROUP BY rating", [$h->id, $sy]),
            'timetable' => ['date' => $date, 'rows' => $tt],
        ]);
    }

    /** Hồ sơ nhanh một học sinh của lớp chủ nhiệm */
    public function student(Request $r, int $id)
    {
        [, $tid] = $this->tid($r);
        $h = $this->home($tid);
        abort_unless($h, 404, 'Bạn không phải giáo viên chủ nhiệm lớp nào.');
        $sy = (int) $this->sy();
        abort_unless(DB::table('sm_enrollments')->where('class_id', $h->id)->where('school_year_id', $sy)->where('student_id', $id)->exists(), 404, 'Học sinh không thuộc lớp bạn chủ nhiệm.');
        $s = DB::table('sm_students')->where('id', $id)->first(['id', 'code', 'full_name', 'gender', 'birth_date']);
        $p = DB::table('sm_student_profiles')->where('student_id', $id)->first();
        $contacts = $p ? array_values(array_filter([
            ['label' => 'Học sinh', 'name' => $s->full_name, 'phone' => $this->phone($p->phone)],
            ['label' => 'Cha', 'name' => $p->father_name, 'phone' => $this->phone($p->father_phone)],
            ['label' => 'Mẹ', 'name' => $p->mother_name, 'phone' => $this->phone($p->mother_phone)],
            ['label' => 'Người giám hộ', 'name' => $p->guardian_name, 'phone' => $this->phone($p->guardian_phone)],
        ], fn ($c) => $c['phone'] || ($c['label'] !== 'Học sinh' && $c['name']))) : [];
        $tot = ['present' => 0, 'late' => 0, 'excused' => 0, 'unexcused' => 0];
        foreach (DB::table('sm_att_records')->where('student_id', $id)->where('school_year_id', $sy)->selectRaw('status, COUNT(*) AS n')->groupBy('status')->get() as $x) $tot[$x->status] = (int) $x->n;
        return response()->json([
            'student' => $s, 'contacts' => $contacts, 'attendance' => $tot,
            'absences' => DB::table('sm_att_records')->where('student_id', $id)->where('school_year_id', $sy)->where('status', '<>', 'present')->orderByDesc('att_date')->limit(10)->get(['att_date', 'status']),
            'grades' => DB::select("SELECT s.name, MAX(CASE WHEN g.semester = 1 THEN g.tbm END) AS hk1, MAX(CASE WHEN g.semester = 2 THEN g.tbm END) AS hk2
                FROM sm_grades g JOIN sm_subjects s ON s.id = g.subject_id WHERE g.student_id = ? AND g.school_year_id = ? GROUP BY s.id, s.name, s.sort_order ORDER BY s.sort_order", [$id, $sy]),
            'conduct' => DB::table('sm_conduct')->where('student_id', $id)->where('school_year_id', $sy)->first(['hk1', 'hk2', 'year_result']),
            'leaves' => DB::table('sm_att_leaves')->where('student_id', $id)->orderByDesc('id')->limit(3)->get(['leave_type', 'from_date', 'to_date', 'status']),
        ]);
    }
}
