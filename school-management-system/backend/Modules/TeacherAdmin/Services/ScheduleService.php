<?php

namespace Modules\TeacherAdmin\Services;

use Illuminate\Support\Facades\DB;

class ScheduleService
{
    /** Lịch dạy tuần của 1 giáo viên: cells[weekday][period] = {class, subject}. */
    public function week(int $teacherId, int $yearId): array
    {
        $rows = DB::table('sm_timetable as tt')->join('sm_class_subjects as cs', 'cs.id', '=', 'tt.class_subject_id')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->where('cs.teacher_id', $teacherId)->where('c.school_year_id', $yearId)
            ->get(['tt.id', 'tt.weekday', 'tt.period', 'c.name as class_name', 's.name as subject', 's.color']);
        $cells = [];
        $count = [];
        foreach ($rows as $r) {
            $cells[$r->weekday . '-' . $r->period][] = ['id' => $r->id, 'class_name' => $r->class_name, 'subject' => $r->subject, 'color' => $r->color];
            $count[$r->weekday] = ($count[$r->weekday] ?? 0) + 1;
        }
        $conflicts = [];
        foreach ($cells as $k => $v) {
            if (count($v) > 1) {
                $conflicts[] = $k;
            }
        }

        return ['cells' => $cells, 'per_day' => $count, 'total' => $rows->count(), 'conflicts' => $conflicts];
    }

    /** Toàn trường: danh sách giáo viên bị trùng tiết (cùng lúc dạy ≥ 2 lớp). */
    public function conflicts(int $yearId): array
    {
        return DB::table('sm_timetable as tt')->join('sm_class_subjects as cs', 'cs.id', '=', 'tt.class_subject_id')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->join('sm_teachers as t', 't.id', '=', 'cs.teacher_id')
            ->where('c.school_year_id', $yearId)->groupBy('cs.teacher_id', 't.full_name', 'tt.weekday', 'tt.period')
            ->havingRaw('COUNT(*) > 1')->selectRaw('cs.teacher_id, t.full_name, tt.weekday, tt.period, COUNT(*) as n')->get()->all();
    }

    /** Giáo viên rảnh ở tiết (weekday, period) — dùng gợi ý dạy thay. */
    public function freeTeachers(int $yearId, int $weekday, int $period, ?int $subjectId = null, string $date = null): array
    {
        $busy = DB::table('sm_timetable as tt')->join('sm_class_subjects as cs', 'cs.id', '=', 'tt.class_subject_id')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->where('c.school_year_id', $yearId)
            ->where('tt.weekday', $weekday)->where('tt.period', $period)->pluck('cs.teacher_id')->all();
        $onLeave = $date ? DB::table('sm_tch_leaves')->where('status', 'approved')->where('from_date', '<=', $date)->where('to_date', '>=', $date)->pluck('teacher_id')->all() : [];
        $subbing = $date ? DB::table('sm_tch_substitutions as sb')->join('sm_timetable as tt', 'tt.id', '=', 'sb.timetable_id')
            ->where('sb.lesson_date', $date)->where('tt.period', $period)->pluck('sb.substitute_teacher_id')->all() : [];
        $spec = $subjectId ? DB::table('sm_tch_subjects')->where('subject_id', $subjectId)->pluck('teacher_id')->all() : [];
        $q = DB::table('sm_teachers')->where('status', 'active')->whereNotIn('id', array_merge($busy, $onLeave, $subbing, [0]))->orderBy('full_name')->get(['id', 'code', 'full_name', 'main_subject_id']);

        return $q->map(fn ($t) => ['id' => $t->id, 'code' => $t->code, 'full_name' => $t->full_name, 'same_subject' => in_array($t->id, $spec)])
            ->sortByDesc('same_subject')->values()->all();
    }
}
