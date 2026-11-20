<?php

namespace Modules\TeacherAdmin\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\TeacherAdmin\Support\Audit;

class LeaveService
{
    public function __construct(private ScheduleService $sched) {}

    public function list(array $f): array
    {
        return DB::table('sm_tch_leaves as l')->join('sm_teachers as t', 't.id', '=', 'l.teacher_id')
            ->when(! empty($f['status']), fn ($q) => $q->where('l.status', $f['status']))
            ->when(! empty($f['teacher_id']), fn ($q) => $q->where('l.teacher_id', (int) $f['teacher_id']))
            ->orderByRaw("CASE l.status WHEN 'pending' THEN 0 ELSE 1 END")->orderByDesc('l.from_date')
            ->get(['l.*', 't.full_name', 't.code', 't.main_subject_id'])->map(function ($r) {
                $r->days = Carbon::parse($r->from_date)->diffInDays(Carbon::parse($r->to_date)) + 1;
                $r->lessons = $this->lessonsOf($r)->count();
                $r->covered = DB::table('sm_tch_substitutions')->where('leave_id', $r->id)->count();

                return $r;
            })->all();
    }

    public function create(array $d): array
    {
        if ($d['to_date'] < $d['from_date']) {
            return [false, 'Ngày kết thúc phải sau ngày bắt đầu', null];
        }
        $overlap = DB::table('sm_tch_leaves')->where('teacher_id', $d['teacher_id'])->whereIn('status', ['pending', 'approved'])
            ->where('from_date', '<=', $d['to_date'])->where('to_date', '>=', $d['from_date'])->exists();
        if ($overlap) {
            return [false, 'Giáo viên đã có đơn nghỉ trùng thời gian này', null];
        }
        $id = (int) DB::table('sm_tch_leaves')->insertGetId([
            'teacher_id' => $d['teacher_id'], 'leave_type' => $d['leave_type'] ?? 'personal', 'from_date' => $d['from_date'], 'to_date' => $d['to_date'],
            'reason' => $d['reason'] ?? null, 'status' => 'pending', 'created_at' => now(),
        ]);
        $t = DB::table('sm_teachers')->find($d['teacher_id']);
        Audit::log('leave', "Tạo đơn nghỉ {$d['from_date']} → {$d['to_date']} cho " . ($t->full_name ?? ''), $d['teacher_id']);

        return [true, 'Đã tạo đơn nghỉ', $id];
    }

    public function review(int $id, string $decision, ?string $note): array
    {
        $l = DB::table('sm_tch_leaves')->find($id);
        if (! $l) {
            return [false, 'Không tìm thấy đơn'];
        }
        if (! in_array($decision, ['approved', 'rejected', 'cancelled'], true)) {
            return [false, 'Quyết định không hợp lệ'];
        }
        if ($decision === 'cancelled') {
            DB::table('sm_tch_substitutions')->where('leave_id', $id)->delete();
        }
        DB::table('sm_tch_leaves')->where('id', $id)->update([
            'status' => $decision, 'review_note' => $note, 'reviewed_at' => now(),
            'reviewed_by' => request()->user()->name ?? request()->user()->full_name ?? 'admin',
        ]);
        $label = ['approved' => 'Duyệt', 'rejected' => 'Từ chối', 'cancelled' => 'Hủy'][$decision];
        Audit::log('leave', "$label đơn nghỉ #$id", $l->teacher_id);

        return [true, "$label đơn nghỉ thành công"];
    }

    public function delete(int $id): bool
    {
        DB::table('sm_tch_substitutions')->where('leave_id', $id)->delete();

        return (bool) DB::table('sm_tch_leaves')->where('id', $id)->delete();
    }

    /** Các tiết dạy bị ảnh hưởng bởi đơn nghỉ (mỗi ngày trong khoảng ứng với thứ của TKB). */
    public function lessonsOf(object $l)
    {
        $tt = DB::table('sm_timetable as tt')->join('sm_class_subjects as cs', 'cs.id', '=', 'tt.class_subject_id')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->where('cs.teacher_id', $l->teacher_id)
            ->get(['tt.id as timetable_id', 'tt.weekday', 'tt.period', 'c.name as class_name', 'c.school_year_id', 's.name as subject', 's.id as subject_id']);
        $out = collect();
        for ($d = Carbon::parse($l->from_date); $d->lte(Carbon::parse($l->to_date)); $d->addDay()) {
            $wd = $d->dayOfWeek === 0 ? 8 : $d->dayOfWeek + 1; // thứ 2 = 2 … thứ 7 = 7, CN = 8
            foreach ($tt->where('weekday', $wd) as $x) {
                $out->push((object) array_merge((array) $x, ['lesson_date' => $d->toDateString()]));
            }
        }

        return $out;
    }

    /** Chi tiết các tiết cần dạy thay + gợi ý giáo viên rảnh. */
    public function coverage(int $leaveId): ?array
    {
        $l = DB::table('sm_tch_leaves')->find($leaveId);
        if (! $l) {
            return null;
        }
        $subs = DB::table('sm_tch_substitutions as sb')->join('sm_teachers as t', 't.id', '=', 'sb.substitute_teacher_id')
            ->where('sb.leave_id', $leaveId)->get(['sb.timetable_id', 'sb.lesson_date', 'sb.substitute_teacher_id', 't.full_name'])
            ->keyBy(fn ($r) => $r->lesson_date . '|' . $r->timetable_id);
        $lessons = [];
        foreach ($this->lessonsOf($l) as $x) {
            $key = $x->lesson_date . '|' . $x->timetable_id;
            $sub = $subs[$key] ?? null;
            $lessons[] = [
                'key' => $key, 'lesson_date' => $x->lesson_date, 'timetable_id' => $x->timetable_id, 'weekday' => $x->weekday, 'period' => $x->period,
                'class_name' => $x->class_name, 'subject' => $x->subject, 'substitute_id' => $sub->substitute_teacher_id ?? null, 'substitute' => $sub->full_name ?? null,
                'candidates' => $sub ? [] : array_slice($this->sched->freeTeachers((int) $x->school_year_id, (int) $x->weekday, (int) $x->period, (int) $x->subject_id, $x->lesson_date), 0, 6),
            ];
        }

        return ['leave' => $l, 'lessons' => $lessons];
    }

    public function assignSubstitute(int $leaveId, string $date, int $timetableId, int $teacherId): array
    {
        $l = DB::table('sm_tch_leaves')->find($leaveId);
        $tt = DB::table('sm_timetable')->find($timetableId);
        $t = DB::table('sm_teachers')->find($teacherId);
        if (! $l || ! $tt || ! $t) {
            return [false, 'Dữ liệu không hợp lệ'];
        }
        if ($l->status !== 'approved') {
            return [false, 'Chỉ phân công dạy thay cho đơn đã được duyệt'];
        }
        $year = (int) DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->where('cs.id', $tt->class_subject_id)->value('c.school_year_id');
        $free = collect($this->sched->freeTeachers($year, (int) $tt->weekday, (int) $tt->period, null, $date))->pluck('id')->all();
        if (! in_array($teacherId, $free, true)) {
            return [false, "{$t->full_name} không rảnh ở tiết này (đang dạy, nghỉ phép hoặc đã dạy thay)"];
        }
        DB::table('sm_tch_substitutions')->updateOrInsert(
            ['lesson_date' => $date, 'timetable_id' => $timetableId],
            ['leave_id' => $leaveId, 'substitute_teacher_id' => $teacherId, 'created_at' => now()]
        );
        Audit::log('substitute', "Phân công {$t->full_name} dạy thay ngày $date (tiết {$tt->period})", $teacherId);

        return [true, "Đã phân công {$t->full_name} dạy thay"];
    }

    public function removeSubstitute(int $leaveId, string $date, int $timetableId): bool
    {
        return (bool) DB::table('sm_tch_substitutions')->where('leave_id', $leaveId)->where('lesson_date', $date)->where('timetable_id', $timetableId)->delete();
    }

    /** Tự động phân công dạy thay: ưu tiên cùng môn, ít tiết thay nhất. */
    public function autoCover(int $leaveId): array
    {
        $cov = $this->coverage($leaveId);
        if (! $cov) {
            return [false, 'Không tìm thấy đơn', 0];
        }
        if ($cov['leave']->status !== 'approved') {
            return [false, 'Chỉ tự động phân công dạy thay cho đơn đã được duyệt', 0];
        }
        $n = 0;
        foreach ($cov['lessons'] as $x) {
            if ($x['substitute_id'] || ! $x['candidates']) {
                continue;
            }
            $load = DB::table('sm_tch_substitutions')->selectRaw('substitute_teacher_id, COUNT(*) n')->groupBy('substitute_teacher_id')->pluck('n', 'substitute_teacher_id');
            $c = collect($x['candidates'])->sortBy([['same_subject', 'desc'], fn ($a, $b) => ($load[$a['id']] ?? 0) <=> ($load[$b['id']] ?? 0)])->first();
            [$ok] = $this->assignSubstitute($leaveId, $x['lesson_date'], $x['timetable_id'], $c['id']);
            $n += $ok ? 1 : 0;
        }

        return [true, "Đã tự động phân công $n tiết dạy thay", $n];
    }
}
