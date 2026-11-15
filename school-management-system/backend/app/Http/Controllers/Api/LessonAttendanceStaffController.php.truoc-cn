<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Giáo viên điểm danh từng tiết (đi sau middleware StaffToken). */
class LessonAttendanceStaffController extends Controller
{
    private const ADMIN_ROLES = ['academic', 'principal', 'vice_principal', 'super_admin'];

    protected function staff(Request $r)
    {
        foreach (['staff', 'staff_account', 'account', 'auth_staff'] as $k) {
            $o = $r->attributes->get($k);
            if (is_object($o) && isset($o->id) && ($row = DB::table('sm_staff_accounts')->find($o->id))) return $row;
        }
        if (($id = $r->attributes->get('staff_id')) && ($row = DB::table('sm_staff_accounts')->find($id))) return $row;
        if ($t = $r->bearerToken()) {   // dự phòng: tự tra token nhân viên
            $row = DB::table('sm_staff_tokens as t')->join('sm_staff_accounts as a', 'a.id', '=', 't.staff_id')
                ->where('t.token_hash', hash('sha256', $t))->where('t.expires_at', '>', now())->first(['a.*']);
            if ($row) return $row;
        }
        abort(401, 'Không xác định được tài khoản đăng nhập.');
    }

    private function lesson(Request $r, array $d)
    {
        $st = $this->staff($r);
        $cs = DB::table('sm_class_subjects')->find($d['class_subject_id']);
        abort_unless($cs, 404, 'Không tìm thấy lớp môn học.');
        abort_unless(in_array($st->role, self::ADMIN_ROLES, true) || ($st->role === 'teacher' && (int) ($st->teacher_id ?? 0) === (int) $cs->teacher_id),
            403, 'Bạn chỉ được điểm danh môn học và lớp do mình giảng dạy.');
        $ok = DB::table('sm_timetable')->where('class_id', $cs->class_id)->where('class_subject_id', $cs->id)
            ->where('period', $d['period'])->where('weekday', (int) date('N', strtotime($d['date'])) + 1)->exists();
        abort_unless($ok, 422, 'Tiết học này không có trong thời khoá biểu của ngày đã chọn.');
        return $cs;
    }

    /** Các tiết dạy của giáo viên trong một ngày */
    public function lessons(Request $r)
    {
        $d = $r->validate(['date' => 'nullable|date', 'teacher_id' => 'nullable|integer']);
        $date = $d['date'] ?? date('Y-m-d');
        $st = $this->staff($r);
        $tid = $st->role === 'teacher' ? (int) ($st->teacher_id ?? 0) : (int) ($d['teacher_id'] ?? 0);
        abort_unless($tid, 422, 'Tài khoản này chưa được liên kết với giáo viên nào.');
        $rows = DB::select("SELECT t.period, p.start_time, p.end_time, cs.id AS class_subject_id, c.name AS class_name, s.name AS subject,
              (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id AND e.school_year_id = c.school_year_id) AS total,
              (SELECT COUNT(*) FROM sm_att_lessons l WHERE l.class_subject_id = cs.id AND l.att_date = ? AND l.period = t.period) AS marked
            FROM sm_timetable t JOIN sm_class_subjects cs ON cs.id = t.class_subject_id JOIN sm_classes c ON c.id = cs.class_id
            JOIN sm_subjects s ON s.id = cs.subject_id LEFT JOIN sm_periods p ON p.id = t.period
            WHERE cs.teacher_id = ? AND t.weekday = ? AND c.school_year_id = (SELECT id FROM sm_school_years WHERE is_current = 1 LIMIT 1)
            ORDER BY t.period", [$date, $tid, (int) date('N', strtotime($date)) + 1]);
        return response()->json(['teacher' => DB::table('sm_teachers')->where('id', $tid)->value('full_name'), 'date' => $date, 'data' => $rows]);
    }

    public function roster(Request $r)
    {
        $d = $r->validate(['class_subject_id' => 'required|integer', 'date' => 'required|date', 'period' => 'required|integer|between:1,5']);
        $cs = $this->lesson($r, $d);
        $yid = DB::table('sm_classes')->where('id', $cs->class_id)->value('school_year_id');
        $rows = DB::table('sm_enrollments as e')->join('sm_students as s', 's.id', '=', 'e.student_id')
            ->leftJoin('sm_att_lessons as l', fn ($j) => $j->on('l.student_id', '=', 's.id')->where('l.att_date', $d['date'])->where('l.period', $d['period']))
            ->where('e.class_id', $cs->class_id)->where('e.school_year_id', $yid)->orderBy('s.full_name')
            ->get(['s.id', 's.code', 's.full_name', 'l.status', 'l.note']);
        return response()->json(['data' => $rows]);
    }

    public function mark(Request $r)
    {
        $d = $r->validate([
            'class_subject_id' => 'required|integer', 'date' => 'required|date|before_or_equal:today', 'period' => 'required|integer|between:1,5',
            'items' => 'required|array|min:1|max:80', 'items.*.student_id' => 'required|integer',
            'items.*.status' => 'required|in:present,late,excused,unexcused', 'items.*.note' => 'nullable|string|max:255',
        ], ['date.before_or_equal' => 'Không thể điểm danh cho ngày trong tương lai.']);
        $cs = $this->lesson($r, $d);
        $st = $this->staff($r);
        $yid = DB::table('sm_classes')->where('id', $cs->class_id)->value('school_year_id');
        $ids = array_values(array_unique(array_column($d['items'], 'student_id')));
        abort_unless(DB::table('sm_enrollments')->where('class_id', $cs->class_id)->where('school_year_id', $yid)->whereIn('student_id', $ids)->count() === count($ids),
            422, 'Danh sách có học sinh không thuộc lớp này.');
        $m = (int) date('n', strtotime($d['date']));
        $rows = array_map(fn ($i) => [
            'student_id' => $i['student_id'], 'class_id' => $cs->class_id, 'class_subject_id' => $cs->id, 'school_year_id' => $yid,
            'semester' => ($m >= 2 && $m <= 8) ? 2 : 1, 'att_date' => $d['date'], 'period' => $d['period'], 'status' => $i['status'],
            'note' => $i['note'] ?? null, 'recorded_by' => $st->id, 'created_at' => now(), 'updated_at' => now(),
        ], $d['items']);

        DB::transaction(function () use ($rows, $ids, $cs, $d) {
            DB::table('sm_att_lessons')->upsert($rows, ['student_id', 'att_date', 'period'], ['class_subject_id', 'status', 'note', 'recorded_by', 'updated_at']);
            // Đồng bộ điểm danh THEO NGÀY: vắng >= 1/2 số tiết đã ghi nhận => vắng cả ngày; còn lại có vắng/muộn => đi muộn
            $in = implode(',', array_fill(0, count($ids), '?'));
            DB::statement("INSERT INTO sm_att_records (student_id, class_id, school_year_id, att_date, status, created_at, updated_at)
                SELECT l.student_id, l.class_id, l.school_year_id, l.att_date,
                  CASE WHEN SUM(l.status IN ('excused','unexcused')) > 0 AND SUM(l.status IN ('excused','unexcused')) * 2 >= COUNT(*)
                       THEN IF(SUM(l.status = 'unexcused') > 0, 'unexcused', 'excused')
                       WHEN SUM(l.status <> 'present') > 0 THEN 'late' ELSE 'present' END, NOW(), NOW()
                FROM sm_att_lessons l WHERE l.att_date = ? AND l.class_id = ? AND l.student_id IN ($in)
                GROUP BY l.student_id, l.class_id, l.school_year_id, l.att_date
                ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()", array_merge([$d['date'], $cs->class_id], $ids));
        });
        return response()->json(['message' => 'Đã lưu điểm danh cho ' . count($rows) . ' học sinh.']);
    }
}
