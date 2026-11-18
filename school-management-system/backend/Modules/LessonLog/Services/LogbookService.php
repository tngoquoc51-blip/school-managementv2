<?php

namespace Modules\LessonLog\Services;

use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LogbookService
{
    public const RATINGS = ['tot' => 'Tốt', 'kha' => 'Khá', 'tb' => 'Trung bình', 'yeu' => 'Yếu'];
    public const SCORE = ['tot' => 4, 'kha' => 3, 'tb' => 2, 'yeu' => 1];
    public const DAYS = [2 => 'Thứ hai', 3 => 'Thứ ba', 4 => 'Thứ tư', 5 => 'Thứ năm', 6 => 'Thứ sáu', 7 => 'Thứ bảy'];

    public function year(?int $id = null): ?object
    {
        if ($id) {
            return DB::table('sm_school_years')->find($id);
        }
        return DB::table('sm_school_years')->where('is_current', 1)->first() ?? DB::table('sm_school_years')->orderByDesc('id')->first();
    }

    /** Hôm nay nếu nằm trong năm học, ngược lại lấy ngày có sổ gần nhất */
    public function defaultDate(object $year): string
    {
        $today = Carbon::today();
        if ($today->between(Carbon::parse($year->start_date), Carbon::parse($year->end_date))) {
            return $today->toDateString();
        }
        return DB::table('sm_ll_entries')->where('school_year_id', $year->id)->max('entry_date') ?: $year->start_date;
    }

    public function monday(string $date): Carbon
    {
        return Carbon::parse($date)->startOfWeek(Carbon::MONDAY);
    }

    public function semester(object $year, string $date): array
    {
        $sems = DB::table('sm_semesters')->where('school_year_id', $year->id)->orderBy('start_date')->get();
        $no = 1;
        $cur = $sems->first();
        foreach ($sems as $i => $s) {
            if ($s->start_date <= $date) {
                $cur = $s;
                $no = $i + 1;
            }
        }
        return ['no' => $no, 'name' => $cur->name ?? ('Học kỳ ' . $no), 'start' => $cur->start_date ?? $year->start_date, 'end' => $cur->end_date ?? $year->end_date];
    }

    /* ----- Lớp & phân quyền ----- */

    public function classesFor(object $u, int $yearId): array
    {
        $q = DB::table('sm_classes as c')->leftJoin('sm_teachers as t', 't.id', '=', 'c.homeroom_teacher_id')
            ->where('c.school_year_id', $yearId)->where('c.status', 'active');
        if (!$u->is_bgh) {
            $taught = DB::table('sm_class_subjects')->where('teacher_id', $u->teacher_id)->pluck('class_id')->all();
            $q->where(fn ($w) => $w->where('c.homeroom_teacher_id', $u->teacher_id)->orWhereIn('c.id', $taught ?: [0]));
        }
        $list = $q->orderBy('c.grade')->orderBy('c.name')->get(['c.id', 'c.name', 'c.grade', 'c.room', 'c.homeroom_teacher_id', 't.full_name as homeroom_name'])
            ->map(fn ($c) => [
                'id' => (int) $c->id, 'name' => $c->name, 'grade' => (int) $c->grade, 'room' => $c->room, 'homeroom_name' => $c->homeroom_name,
                'is_mine' => (bool) ($u->teacher_id && (int) $c->homeroom_teacher_id === (int) $u->teacher_id),
                'can_write' => !$u->is_bgh,
            ])->all();
        usort($list, fn ($a, $b) => ($b['is_mine'] <=> $a['is_mine']));
        return $list;
    }

    public function classOrFail(int $id, object $u): object
    {
        $c = DB::table('sm_classes as c')->leftJoin('sm_teachers as t', 't.id', '=', 'c.homeroom_teacher_id')->where('c.id', $id)
            ->first(['c.id', 'c.name', 'c.grade', 'c.room', 'c.school_year_id', 'c.homeroom_teacher_id', 't.full_name as homeroom_name']);
        abort_unless($c, 404, 'Không tìm thấy lớp.');
        $ok = $u->is_bgh || ($u->teacher_id && ((int) $c->homeroom_teacher_id === (int) $u->teacher_id
            || DB::table('sm_class_subjects')->where('class_id', $id)->where('teacher_id', $u->teacher_id)->exists()));
        abort_unless($ok, 403, 'Bạn không có quyền xem sổ đầu bài của lớp này.');
        return $c;
    }

    public function isHomeroom(object $u, object $class): bool
    {
        return $u->teacher_id && (int) $class->homeroom_teacher_id === (int) $u->teacher_id;
    }

    /* ----- Thời khóa biểu / điểm danh / tuần ----- */

    public function slots(int $classId): Collection
    {
        return DB::table('sm_timetable as t')
            ->join('sm_class_subjects as cs', 'cs.id', '=', 't.class_subject_id')->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->leftJoin('sm_teachers as th', 'th.id', '=', 'cs.teacher_id')->where('t.class_id', $classId)
            ->orderBy('t.weekday')->orderBy('t.period')
            ->get(['t.weekday', 't.period', 't.class_subject_id', 'cs.subject_id', 'cs.teacher_id', 's.name as subject_name', 's.code as subject_code', 'th.full_name as teacher_name']);
    }

    /** Điểm danh từng tiết: "Y-m-d|tiết" => số liệu */
    public function attendance(int $classId, string $from, string $to): array
    {
        $rows = DB::table('sm_att_lessons')->where('class_id', $classId)->whereBetween('att_date', [$from, $to])
            ->selectRaw("att_date, period, COUNT(*) AS total, COALESCE(SUM(status='present'),0) AS present, COALESCE(SUM(status='late'),0) AS late,
                COALESCE(SUM(status='excused'),0) AS excused, COALESCE(SUM(status='unexcused'),0) AS unexcused")
            ->groupBy('att_date', 'period')->get();
        $out = [];
        foreach ($rows as $x) {
            $out[$x->att_date . '|' . $x->period] = ['total' => (int) $x->total, 'present' => (int) $x->present, 'late' => (int) $x->late, 'excused' => (int) $x->excused, 'unexcused' => (int) $x->unexcused];
        }
        return $out;
    }

    public function weekReview(int $classId, string $monday): ?object
    {
        return DB::table('sm_ll_weeks')->where('class_id', $classId)->where('week_start', $monday)->first();
    }

    public function locked(int $classId, string $monday): bool
    {
        $w = $this->weekReview($classId, $monday);
        return $w && in_array($w->status, ['signed', 'approved'], true);
    }

    public function entryOut(object $e): array
    {
        return [
            'id' => (int) $e->id, 'entry_date' => $e->entry_date, 'period' => (int) $e->period, 'lesson_no' => $e->lesson_no !== null ? (int) $e->lesson_no : null,
            'lesson_title' => $e->lesson_title, 'content' => $e->content, 'homework' => $e->homework, 'equipment' => $e->equipment,
            'rating' => $e->rating, 'discipline_note' => $e->discipline_note, 'status' => $e->status,
            'created_by_name' => $e->created_by_name, 'updated_at' => $e->updated_at,
        ];
    }

    public function log(object $u, ?int $classId, string $action, string $desc): void
    {
        DB::table('sm_ll_logs')->insert([
            'class_id' => $classId, 'user_id' => $u->id, 'user_name' => $u->name, 'action' => $action,
            'description' => mb_substr($desc, 0, 255), 'created_at' => now()->toDateTimeString(),
        ]);
    }

    /** Thống kê một tuần của lớp: số tiết đến hạn, đã ghi, xếp loại TB, vắng */
    public function weekStats(int $classId, Carbon $monday): array
    {
        $today = Carbon::today();
        $sat = $monday->copy()->addDays(5);
        $slots = $this->slots($classId);
        $entries = DB::table('sm_ll_entries')->where('class_id', $classId)->whereBetween('entry_date', [$monday->toDateString(), $sat->toDateString()])
            ->where('status', 'submitted')->get()->keyBy(fn ($e) => $e->entry_date . '|' . $e->period);
        $due = 0;
        $filled = 0;
        $sum = 0;
        $n = 0;
        foreach ($slots as $s) {
            $d = $monday->copy()->addDays($s->weekday - 2);
            $e = $entries->get($d->toDateString() . '|' . $s->period);
            if ($d->lte($today)) {
                $due++;
                $filled += $e ? 1 : 0;
            }
            if ($e) {
                $sum += self::SCORE[$e->rating] ?? 0;
                $n++;
            }
        }
        $att = $this->attendance($classId, $monday->toDateString(), $sat->toDateString());
        $tot = ['excused' => 0, 'unexcused' => 0, 'late' => 0];
        foreach ($att as $a) {
            foreach ($tot as $k => $_) {
                $tot[$k] += $a[$k];
            }
        }
        return [
            'total' => $slots->count(), 'due' => $due, 'filled' => $filled, 'missing' => max(0, $due - $filled),
            'rate' => $due ? round($filled / $due * 100) : null, 'avg_rating' => $n ? round($sum / $n, 2) : null,
            'excused' => $tot['excused'], 'unexcused' => $tot['unexcused'], 'late' => $tot['late'],
        ];
    }
}
