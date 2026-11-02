<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Chuyên cần – cổng học sinh (đi sau middleware StudentToken). */
class StudentAttendancePortalController extends Controller
{
    private const SEM = 'IF(MONTH(att_date) BETWEEN 2 AND 8,2,1)';

    private function sem(Request $r): int
    {
        $s = (int) $r->query('semester', 0);
        return in_array($s, [1, 2], true) ? $s : 0;
    }

    private function enr(int $sid, int $yid)
    {
        $e = DB::table('sm_enrollments')->where('student_id', $sid)->where('school_year_id', $yid)->first();
        abort_unless($e, 404, 'Học sinh không học trong năm học này.');
        return $e;
    }

    private function sid(Request $r): int
    {
        foreach (['student_id', 'sm_student_id'] as $k) {
            if ($v = $r->attributes->get($k)) return (int) $v;
        }
        foreach (['student', 'account', 'auth_student', 'auth_account'] as $k) {
            $o = $r->attributes->get($k);
            if (is_object($o)) {
                $v = $k === 'student' ? ($o->id ?? null) : ($o->student_id ?? null);
                if ($v) return (int) $v;
            }
        }
        if ($t = $r->bearerToken()) {   // dự phòng: tự tra token học sinh
            $row = DB::table('sm_api_tokens as t')->join('sm_accounts as a', 'a.id', '=', 't.account_id')
                ->where('t.token_hash', hash('sha256', $t))
                ->where(fn ($q) => $q->whereNull('t.expires_at')->orWhere('t.expires_at', '>', now()))
                ->first(['a.student_id']);
            if ($row && $row->student_id) return (int) $row->student_id;
        }
        abort(401, 'Không xác định được học sinh từ phiên đăng nhập.');
    }

    private function year(Request $r)
    {
        $id = (int) $r->query('year');
        $y = $id ? DB::table('sm_school_years')->find($id) : DB::table('sm_school_years')->where('is_current', 1)->first();
        abort_unless($y, 404, 'Không tìm thấy năm học.');
        return $y;
    }

    public function overview(Request $r)
    {
        $sid = $this->sid($r);
        $y = $this->year($r);
        $sem = $this->sem($r);
        $q = DB::table('sm_att_records')->where('student_id', $sid)->where('school_year_id', $y->id)
            ->when($sem, fn ($x) => $x->whereRaw(self::SEM . ' = ?', [$sem]));

        $tot = ['present' => 0, 'late' => 0, 'excused' => 0, 'unexcused' => 0];
        $monthly = [];
        foreach ((clone $q)->selectRaw("DATE_FORMAT(att_date,'%Y-%m') AS m, status, COUNT(*) AS n")->groupBy('m', 'status')->get() as $x) {
            $tot[$x->status] += $x->n;
            $monthly[$x->m][$x->status] = (int) $x->n;
        }
        ksort($monthly);
        $days = array_sum($tot);
        $rate = $days ? round(100 * ($tot['present'] + $tot['late']) / $days, 1) : null;

        $streak = 0;
        foreach ((clone $q)->orderByDesc('att_date')->limit(120)->pluck('status') as $s) {
            if ($s !== 'present') break;
            $streak++;
        }
        $cls = DB::table('sm_enrollments as e')->join('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->where('e.student_id', $sid)->where('e.school_year_id', $y->id)->first(['c.name', 'c.grade']);
        $stu = DB::table('sm_students')->where('id', $sid)->first(['code', 'full_name']);

        return response()->json([
            'student' => $stu, 'class' => $cls, 'year' => ['id' => $y->id, 'label' => $y->label, 'start' => $y->start_date, 'end' => $y->end_date],
            'years' => DB::table('sm_enrollments as e')->join('sm_school_years as y', 'y.id', '=', 'e.school_year_id')
                ->join('sm_classes as c', 'c.id', '=', 'e.class_id')->where('e.student_id', $sid)->orderByDesc('y.start_date')
                ->get(['y.id', 'y.label', 'y.is_current', 'c.name as class_name', 'c.grade']),
            'semester' => $sem,
            'totals' => $tot + ['days' => $days], 'rate' => $rate, 'streak' => $streak, 'monthly' => $monthly,
            'pending_leaves' => DB::table('sm_att_leaves')->where('student_id', $sid)->where('status', 'pending')->count(),
        ]);
    }

    /** ?m=YYYY-MM  hoặc  ?issues=1 (các buổi không có mặt trong năm học) */
    public function records(Request $r)
    {
        $sid = $this->sid($r);
        $q = DB::table('sm_att_records')->where('student_id', $sid)->orderBy('att_date', $r->boolean('issues') ? 'desc' : 'asc');
        if ($r->boolean('issues')) {
            $sem = $this->sem($r);
            $q->where('school_year_id', $this->year($r)->id)->where('status', '!=', 'present')
                ->when($sem, fn ($x) => $x->whereRaw(self::SEM . ' = ?', [$sem]))->limit(300);
        } else {
            $m = (string) $r->query('m', date('Y-m'));
            abort_unless(preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $m), 422, 'Tháng không hợp lệ.');
            $q->whereBetween('att_date', ["$m-01", date('Y-m-t', strtotime("$m-01"))]);
        }
        return response()->json(['data' => $q->get(['att_date', 'status', 'note'])]);
    }

    /** Chuyên cần theo từng môn của lớp học sinh trong năm học / học kỳ */
    public function subjects(Request $r)
    {
        $sid = $this->sid($r);
        $y = $this->year($r);
        $e = $this->enr($sid, $y->id);
        $sem = $this->sem($r) ? 'AND l.semester = ' . $this->sem($r) : '';
        $rows = DB::select("SELECT cs.id, s.name AS subject, s.code, t.full_name AS teacher,
              COALESCE(SUM(l.status='present'),0) AS present, COALESCE(SUM(l.status='late'),0) AS late,
              COALESCE(SUM(l.status='excused'),0) AS excused, COALESCE(SUM(l.status='unexcused'),0) AS unexcused, COUNT(l.id) AS total
            FROM sm_class_subjects cs JOIN sm_subjects s ON s.id = cs.subject_id LEFT JOIN sm_teachers t ON t.id = cs.teacher_id
            LEFT JOIN sm_att_lessons l ON l.class_subject_id = cs.id AND l.student_id = ? AND l.school_year_id = ? $sem
            WHERE cs.class_id = ? GROUP BY cs.id, s.name, s.code, t.full_name, s.sort_order ORDER BY s.sort_order", [$sid, $y->id, $e->class_id]);
        return response()->json(['data' => $rows]);
    }

    /** Chi tiết từng buổi học của một môn: ngày nào có mặt, ngày nào nghỉ */
    public function subject(Request $r, int $id)
    {
        $sid = $this->sid($r);
        $y = $this->year($r);
        $e = $this->enr($sid, $y->id);
        $cs = DB::table('sm_class_subjects as cs')->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->leftJoin('sm_teachers as t', 't.id', '=', 'cs.teacher_id')->where('cs.id', $id)->first(['cs.class_id', 's.name as subject', 't.full_name as teacher']);
        abort_unless($cs && (int) $cs->class_id === (int) $e->class_id, 404, 'Môn học không thuộc lớp của bạn.');
        $sem = $this->sem($r);
        $lessons = DB::table('sm_att_lessons as l')->leftJoin('sm_periods as p', 'p.id', '=', 'l.period')
            ->where('l.student_id', $sid)->where('l.class_subject_id', $id)->where('l.school_year_id', $y->id)
            ->when($sem, fn ($x) => $x->where('l.semester', $sem))->orderBy('l.att_date')->orderBy('l.period')
            ->get(['l.att_date', 'l.period', 'l.status', 'l.note', 'p.start_time', 'p.end_time']);
        return response()->json(['subject' => $cs->subject, 'teacher' => $cs->teacher, 'lessons' => $lessons]);
    }

    public function leaves(Request $r)
    {
        return response()->json(['data' => DB::table('sm_att_leaves')->where('student_id', $this->sid($r))
            ->orderByDesc('id')->limit(50)->get()]);
    }

    public function storeLeave(Request $r)
    {
        $sid = $this->sid($r);
        $d = $r->validate([
            'leave_type' => 'required|in:sick,family,other',
            'from_date' => 'required|date|after_or_equal:' . date('Y-m-d', strtotime('-7 days')),
            'to_date' => 'required|date|after_or_equal:from_date',
            'reason' => 'required|string|min:10|max:500',
        ], [
            'from_date.after_or_equal' => 'Chỉ được xin nghỉ trong vòng 7 ngày trở lại và các ngày sắp tới.',
            'to_date.after_or_equal' => 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.',
            'reason.min' => 'Lý do cần ít nhất 10 ký tự.',
        ]);
        abort_if((strtotime($d['to_date']) - strtotime($d['from_date'])) / 86400 > 29, 422, 'Mỗi đơn tối đa 30 ngày.');
        $mine = DB::table('sm_att_leaves')->where('student_id', $sid)->whereIn('status', ['pending', 'approved']);
        abort_if((clone $mine)->where('from_date', '<=', $d['to_date'])->where('to_date', '>=', $d['from_date'])->exists(), 422, 'Khoảng ngày này đã có đơn xin nghỉ khác.');
        abort_if((clone $mine)->where('status', 'pending')->count() >= 3, 422, 'Bạn đang có 3 đơn chờ duyệt. Hãy chờ nhà trường xử lý.');

        $id = DB::table('sm_att_leaves')->insertGetId($d + ['student_id' => $sid, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(['message' => 'Đã gửi đơn xin nghỉ. Vui lòng chờ giáo viên chủ nhiệm duyệt.', 'data' => DB::table('sm_att_leaves')->find($id)], 201);
    }

    public function cancelLeave(Request $r, int $id)
    {
        $n = DB::table('sm_att_leaves')->where('id', $id)->where('student_id', $this->sid($r))->where('status', 'pending')
            ->update(['status' => 'cancelled', 'updated_at' => now()]);
        abort_unless($n, 422, 'Chỉ có thể huỷ đơn đang chờ duyệt.');
        return response()->json(['message' => 'Đã huỷ đơn xin nghỉ.']);
    }
}
