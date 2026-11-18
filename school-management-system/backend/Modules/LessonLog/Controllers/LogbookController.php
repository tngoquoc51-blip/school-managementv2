<?php

namespace Modules\LessonLog\Controllers;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\LessonLog\Services\LogbookService;

class LogbookController extends Controller
{
    private const AVG = "AVG(CASE rating WHEN 'tot' THEN 4 WHEN 'kha' THEN 3 WHEN 'tb' THEN 2 ELSE 1 END)";

    public function __construct(private LogbookService $svc)
    {
    }

    private function dateOf(Request $r, object $class): string
    {
        $d = (string) $r->query('date', '');
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) {
            return $d;
        }
        return $this->svc->defaultDate($this->svc->year((int) $class->school_year_id));
    }

    private function reviewOut(?object $w): ?array
    {
        return $w ? [
            'status' => $w->status, 'homeroom_comment' => $w->homeroom_comment, 'signed_by_name' => $w->signed_by_name, 'signed_at' => $w->signed_at,
            'bgh_note' => $w->bgh_note, 'bgh_by_name' => $w->bgh_by_name, 'bgh_at' => $w->bgh_at,
        ] : null;
    }

    /* ===================== Meta ===================== */

    public function meta(Request $r): JsonResponse
    {
        $u = $r->user();
        $y = $this->svc->year((int) $r->input('year_id') ?: null);
        abort_if(!$y, 404, 'Chưa có năm học trong hệ thống.');
        $classes = $this->svc->classesFor($u, (int) $y->id);
        $mine = collect($classes)->firstWhere('is_mine', true);
        $criteria = Schema::hasTable('sm_rw_criteria')
            ? DB::table('sm_rw_criteria')->where('is_active', 1)->orderBy('category')->orderBy('sort_order')->get(['id', 'code', 'name', 'category', 'type', 'default_points'])
            : [];

        return response()->json([
            'year' => ['id' => (int) $y->id, 'label' => $y->label, 'start_date' => $y->start_date, 'end_date' => $y->end_date],
            'years' => DB::table('sm_school_years')->orderByDesc('id')->get(['id', 'label']),
            'classes' => $classes,
            'me' => [
                'name' => $u->name, 'role' => $u->role, 'teacher_id' => $u->teacher_id, 'is_bgh' => $u->is_bgh,
                'teacher_name' => $u->teacher_id ? DB::table('sm_teachers')->where('id', $u->teacher_id)->value('full_name') : null,
                'homeroom_class_id' => $mine['id'] ?? null,
            ],
            'periods' => DB::table('sm_periods')->orderBy('id')->get(['id', 'start_time', 'end_time']),
            'ratings' => LogbookService::RATINGS, 'days' => LogbookService::DAYS,
            'default_date' => $this->svc->defaultDate($y), 'today' => Carbon::today()->toDateString(),
            'criteria' => $criteria,
        ]);
    }

    /* ===================== Sổ tuần ===================== */

    public function week(Request $r): JsonResponse
    {
        $u = $r->user();
        $c = $this->svc->classOrFail((int) $r->query('class_id'), $u);
        $mon = $this->svc->monday($this->dateOf($r, $c));
        $sat = $mon->copy()->addDays(5);
        $today = Carbon::today();
        $home = $this->svc->isHomeroom($u, $c);
        $review = $this->svc->weekReview($c->id, $mon->toDateString());
        $locked = $review && in_array($review->status, ['signed', 'approved'], true);

        $entries = DB::table('sm_ll_entries')->where('class_id', $c->id)->whereBetween('entry_date', [$mon->toDateString(), $sat->toDateString()])
            ->get()->keyBy(fn ($e) => $e->entry_date . '|' . $e->period);
        $att = $this->svc->attendance($c->id, $mon->toDateString(), $sat->toDateString());

        $slots = [];
        foreach ($this->svc->slots($c->id) as $s) {
            $d = $mon->copy()->addDays($s->weekday - 2);
            $key = $d->toDateString() . '|' . $s->period;
            $e = $entries->get($key);
            $past = $d->lte($today);
            $slots[] = [
                'date' => $d->toDateString(), 'weekday' => (int) $s->weekday, 'period' => (int) $s->period, 'class_subject_id' => (int) $s->class_subject_id,
                'subject_id' => (int) $s->subject_id, 'subject_name' => $s->subject_name, 'subject_code' => $s->subject_code,
                'teacher_id' => (int) $s->teacher_id, 'teacher_name' => $s->teacher_name,
                'entry' => $e ? $this->svc->entryOut($e) : null, 'att' => $att[$key] ?? null,
                'state' => $e ? ($e->status === 'submitted' ? 'done' : 'draft') : ($past ? 'missing' : 'future'),
                'can_write' => !$u->is_bgh && $past && !$locked && ($home || (int) $s->teacher_id === (int) $u->teacher_id),
            ];
        }

        $days = [];
        foreach (LogbookService::DAYS as $wd => $label) {
            $d = $mon->copy()->addDays($wd - 2);
            $days[] = ['weekday' => $wd, 'label' => $label, 'date' => $d->toDateString(), 'is_today' => $d->isSameDay($today)];
        }

        return response()->json([
            'class' => ['id' => (int) $c->id, 'name' => $c->name, 'grade' => (int) $c->grade, 'room' => $c->room, 'homeroom_name' => $c->homeroom_name],
            'week' => [
                'start' => $mon->toDateString(), 'end' => $sat->toDateString(), 'iso' => $mon->isoWeek(),
                'label' => 'Tuần ' . $mon->isoWeek() . ' (' . $mon->format('d/m') . ' – ' . $sat->format('d/m/Y') . ')',
                'prev' => $mon->copy()->subWeek()->toDateString(), 'next' => $mon->copy()->addWeek()->toDateString(), 'is_current' => $mon->isSameDay($today->copy()->startOfWeek()),
            ],
            'days' => $days, 'slots' => $slots, 'review' => $this->reviewOut($review), 'locked' => (bool) $locked,
            'stats' => $this->svc->weekStats($c->id, $mon), 'is_homeroom' => $home,
        ]);
    }

    /** Chi tiết một tiết: danh sách học sinh vắng / muộn lấy từ điểm danh từng tiết */
    public function slot(Request $r): JsonResponse
    {
        $c = $this->svc->classOrFail((int) $r->query('class_id'), $r->user());
        $date = (string) $r->query('date');
        $period = (int) $r->query('period');
        abort_unless(preg_match('/^\d{4}-\d{2}-\d{2}$/', $date), 422, 'Ngày không hợp lệ.');
        $absent = DB::table('sm_att_lessons as a')->join('sm_students as s', 's.id', '=', 'a.student_id')
            ->where('a.class_id', $c->id)->where('a.att_date', $date)->where('a.period', $period)->where('a.status', '<>', 'present')
            ->orderBy('s.full_name')->get(['s.id', 's.code', 's.full_name', 'a.status', 'a.note']);
        return response()->json(['absent' => $absent, 'summary' => $this->svc->attendance($c->id, $date, $date)[$date . '|' . $period] ?? null]);
    }

    public function saveEntry(Request $r): JsonResponse
    {
        $u = $r->user();
        abort_if($u->is_bgh, 403, 'Ban Giám hiệu chỉ xem và duyệt sổ, không ghi thay giáo viên.');
        $v = $r->validate([
            'class_id' => 'required|integer|exists:sm_classes,id', 'entry_date' => 'required|date_format:Y-m-d', 'period' => 'required|integer|min:1|max:9',
            'status' => 'required|in:draft,submitted', 'lesson_no' => 'nullable|integer|min:1|max:999',
            'lesson_title' => 'required_if:status,submitted|nullable|string|max:200', 'content' => 'nullable|string|max:2000',
            'homework' => 'nullable|string|max:1000', 'equipment' => 'nullable|string|max:500',
            'rating' => 'required_if:status,submitted|nullable|in:tot,kha,tb,yeu', 'discipline_note' => 'nullable|string|max:1000',
        ], ['lesson_title.required_if' => 'Nhập tên bài dạy trước khi ký sổ.', 'rating.required_if' => 'Chọn xếp loại tiết học trước khi ký sổ.']);

        $c = $this->svc->classOrFail((int) $v['class_id'], $u);
        $date = Carbon::parse($v['entry_date']);
        abort_if($date->gt(Carbon::today()), 422, 'Chưa thể ghi sổ cho tiết học chưa diễn ra.');
        abort_if($date->dayOfWeekIso === 7, 422, 'Chủ nhật không có tiết học.');

        $slot = DB::table('sm_timetable as t')->join('sm_class_subjects as cs', 'cs.id', '=', 't.class_subject_id')
            ->where('t.class_id', $c->id)->where('t.weekday', $date->dayOfWeekIso + 1)->where('t.period', $v['period'])
            ->first(['t.class_subject_id', 'cs.subject_id', 'cs.teacher_id']);
        abort_unless($slot, 422, 'Tiết này không có trong thời khóa biểu của lớp.');
        abort_unless($this->svc->isHomeroom($u, $c) || (int) $slot->teacher_id === (int) $u->teacher_id, 403, 'Bạn chỉ được ghi sổ cho tiết mình dạy hoặc lớp mình chủ nhiệm.');
        abort_if($this->svc->locked($c->id, $this->svc->monday($v['entry_date'])->toDateString()), 423, 'Sổ tuần này đã được ký nên không thể chỉnh sửa. Hãy mở lại tuần để sửa.');

        $year = $this->svc->year((int) $c->school_year_id);
        $now = now()->toDateTimeString();
        $data = [
            'school_year_id' => $c->school_year_id, 'semester' => $this->svc->semester($year, $v['entry_date'])['no'], 'class_subject_id' => $slot->class_subject_id,
            'subject_id' => $slot->subject_id, 'teacher_id' => $slot->teacher_id, 'lesson_no' => $v['lesson_no'] ?? null, 'lesson_title' => trim((string) ($v['lesson_title'] ?? '')),
            'content' => $v['content'] ?? null, 'homework' => $v['homework'] ?? null, 'equipment' => $v['equipment'] ?? null,
            'rating' => $v['rating'] ?? null, 'discipline_note' => $v['discipline_note'] ?? null, 'status' => $v['status'], 'updated_at' => $now,
        ];
        $ex = DB::table('sm_ll_entries')->where('class_id', $c->id)->where('entry_date', $v['entry_date'])->where('period', $v['period'])->first();
        if ($ex) {
            DB::table('sm_ll_entries')->where('id', $ex->id)->update($data);
            $id = (int) $ex->id;
        } else {
            $id = (int) DB::table('sm_ll_entries')->insertGetId($data + [
                'class_id' => $c->id, 'entry_date' => $v['entry_date'], 'period' => $v['period'], 'source' => 'manual',
                'created_by' => $u->id, 'created_by_name' => $u->name, 'created_at' => $now,
            ]);
        }
        $subject = DB::table('sm_subjects')->where('id', $slot->subject_id)->value('name');
        $this->svc->log($u, $c->id, $v['status'] === 'submitted' ? 'sign' : 'draft', ($v['status'] === 'submitted' ? 'Ký sổ' : 'Lưu nháp') . " tiết {$v['period']} {$subject} ngày " . $date->format('d/m'));

        return response()->json(['message' => $v['status'] === 'submitted' ? 'Đã ký sổ đầu bài.' : 'Đã lưu nháp.', 'entry' => $this->svc->entryOut(DB::table('sm_ll_entries')->find($id))]);
    }

    public function deleteEntry(Request $r, int $id): JsonResponse
    {
        $u = $r->user();
        $e = DB::table('sm_ll_entries')->find($id);
        abort_unless($e, 404, 'Không tìm thấy bản ghi.');
        $c = $this->svc->classOrFail((int) $e->class_id, $u);
        abort_if($u->is_bgh, 403, 'Ban Giám hiệu không xóa sổ của giáo viên.');
        abort_unless($this->svc->isHomeroom($u, $c) || (int) $e->teacher_id === (int) $u->teacher_id, 403, 'Bạn không có quyền xóa bản ghi này.');
        abort_if($this->svc->locked($c->id, $this->svc->monday($e->entry_date)->toDateString()), 423, 'Sổ tuần này đã được ký nên không thể xóa.');
        DB::table('sm_ll_entries')->where('id', $id)->delete();
        $this->svc->log($u, $c->id, 'delete', 'Xóa bản ghi tiết ' . $e->period . ' ngày ' . Carbon::parse($e->entry_date)->format('d/m'));
        return response()->json(['message' => 'Đã xóa bản ghi.']);
    }

    /* ===================== Tổng quan ===================== */

    public function overview(Request $r): JsonResponse
    {
        $u = $r->user();
        $c = $this->svc->classOrFail((int) $r->query('class_id'), $u);
        $mon = $this->svc->monday($this->dateOf($r, $c));
        $sat = $mon->copy()->addDays(5);
        $today = Carbon::today();
        $slots = $this->svc->slots($c->id);

        // Tiết đến hạn mà chưa ký sổ (tuần đang xem + 2 tuần trước)
        $from = $mon->copy()->subWeeks(2);
        $to = $sat->lt($today) ? $sat : $today;
        $signed = DB::table('sm_ll_entries')->where('class_id', $c->id)->where('status', 'submitted')->whereBetween('entry_date', [$from->toDateString(), $sat->toDateString()])
            ->get()->keyBy(fn ($e) => $e->entry_date . '|' . $e->period);
        $todo = [];
        for ($w = $from->copy(); $w->lte($mon); $w->addWeek()) {
            foreach ($slots as $s) {
                $d = $w->copy()->addDays($s->weekday - 2);
                if ($d->gt($to) || $signed->has($d->toDateString() . '|' . $s->period)) {
                    continue;
                }
                $todo[] = ['date' => $d->toDateString(), 'weekday' => (int) $s->weekday, 'period' => (int) $s->period, 'subject_name' => $s->subject_name,
                    'teacher_name' => $s->teacher_name, 'mine' => (int) $s->teacher_id === (int) $u->teacher_id];
            }
        }
        usort($todo, fn ($a, $b) => [$b['date'], $a['period']] <=> [$a['date'], $b['period']]);

        // Theo môn trong tuần
        $bySubject = [];
        $entries = DB::table('sm_ll_entries')->where('class_id', $c->id)->where('status', 'submitted')->whereBetween('entry_date', [$mon->toDateString(), $sat->toDateString()])
            ->get()->keyBy(fn ($e) => $e->entry_date . '|' . $e->period);
        foreach ($slots as $s) {
            $d = $mon->copy()->addDays($s->weekday - 2);
            $k = $s->subject_id;
            $bySubject[$k] ??= ['subject_id' => (int) $k, 'name' => $s->subject_name, 'teacher_name' => $s->teacher_name, 'due' => 0, 'filled' => 0];
            if ($d->lte($today)) {
                $bySubject[$k]['due']++;
                $bySubject[$k]['filled'] += $entries->has($d->toDateString() . '|' . $s->period) ? 1 : 0;
            }
        }

        $absent = DB::table('sm_att_lessons as a')->join('sm_students as s', 's.id', '=', 'a.student_id')->where('a.class_id', $c->id)
            ->whereBetween('a.att_date', [$mon->toDateString(), $sat->toDateString()])->where('a.status', '<>', 'present')
            ->selectRaw("s.id, s.code, s.full_name, COUNT(*) AS n, SUM(a.status='unexcused') AS unexcused, SUM(a.status='excused') AS excused, SUM(a.status='late') AS late")
            ->groupBy('s.id', 's.code', 's.full_name')->orderByDesc('n')->limit(5)->get();

        $notes = DB::table('sm_ll_notes')->where('class_id', $c->id)->whereBetween('note_date', [$mon->toDateString(), $sat->toDateString()])
            ->selectRaw("COALESCE(SUM(kind='praise'),0) AS praise, COALESCE(SUM(kind='violation'),0) AS violation, COALESCE(SUM(kind='note'),0) AS note")->first();

        return response()->json([
            'stats' => $this->svc->weekStats($c->id, $mon), 'review' => $this->reviewOut($this->svc->weekReview($c->id, $mon->toDateString())),
            'by_subject' => array_values($bySubject), 'todo' => array_slice($todo, 0, 12), 'todo_total' => count($todo),
            'absent' => $absent, 'notes' => ['praise' => (int) $notes->praise, 'violation' => (int) $notes->violation, 'note' => (int) $notes->note],
            'trend' => $this->trend($c->id, $mon, 8, $slots),
            'recent' => DB::table('sm_ll_logs')->where('class_id', $c->id)->orderByDesc('id')->limit(8)->get(['id', 'user_name', 'action', 'description', 'created_at']),
            'week' => ['start' => $mon->toDateString(), 'end' => $sat->toDateString(), 'label' => 'Tuần ' . $mon->isoWeek() . ' (' . $mon->format('d/m') . ' – ' . $sat->format('d/m/Y') . ')'],
        ]);
    }

    private function trend(int $classId, Carbon $mon, int $n, $slots): array
    {
        $start = $mon->copy()->subWeeks($n - 1);
        $rows = DB::table('sm_ll_entries')->where('class_id', $classId)->where('status', 'submitted')
            ->whereBetween('entry_date', [$start->toDateString(), $mon->copy()->addDays(5)->toDateString()])
            ->selectRaw('DATE_SUB(entry_date, INTERVAL WEEKDAY(entry_date) DAY) AS wk, COUNT(*) AS n, ' . self::AVG . ' AS avg')->groupBy('wk')->get()->keyBy('wk');
        $today = Carbon::today();
        $out = [];
        for ($i = 0; $i < $n; $i++) {
            $w = $start->copy()->addWeeks($i);
            $due = 0;
            foreach ($slots as $s) {
                $due += $w->copy()->addDays($s->weekday - 2)->lte($today) ? 1 : 0;
            }
            $x = $rows->get($w->toDateString());
            $out[] = ['label' => 'T' . $w->isoWeek(), 'start' => $w->toDateString(), 'filled' => $x ? (int) $x->n : 0, 'due' => $due,
                'rate' => $due ? min(100, round(($x ? (int) $x->n : 0) / $due * 100)) : null, 'avg_rating' => $x ? round((float) $x->avg, 2) : null];
        }
        return $out;
    }

    /* ===================== Tiến độ chương trình ===================== */

    public function progress(Request $r): JsonResponse
    {
        $u = $r->user();
        $c = $this->svc->classOrFail((int) $r->query('class_id'), $u);
        $date = $this->dateOf($r, $c);
        $year = $this->svc->year((int) $c->school_year_id);
        $sem = $this->svc->semester($year, $date);
        $asOf = Carbon::parse(min(Carbon::today()->toDateString(), $sem['end'], $date > $sem['end'] ? $sem['end'] : '9999-12-31'));
        $weeks = max(1, (int) floor($this->svc->monday($sem['start'])->diffInDays($this->svc->monday($asOf->toDateString())) / 7) + 1);

        $perWeek = $this->svc->slots($c->id)->groupBy('subject_id');
        $entries = DB::table('sm_ll_entries')->where('class_id', $c->id)->where('status', 'submitted')->whereBetween('entry_date', [$sem['start'], $sem['end']])
            ->orderByDesc('entry_date')->orderByDesc('period')->get(['subject_id', 'entry_date', 'period', 'lesson_no', 'lesson_title', 'rating'])->groupBy('subject_id');

        $subjects = [];
        foreach ($perWeek as $sid => $rows) {
            $f = $rows->first();
            $list = $entries->get($sid, collect());
            $last = $list->first();
            $scores = $list->map(fn ($e) => LogbookService::SCORE[$e->rating] ?? 0);
            $planned = $rows->count() * $weeks;
            $subjects[] = [
                'subject_id' => (int) $sid, 'name' => $f->subject_name, 'code' => $f->subject_code, 'teacher_name' => $f->teacher_name, 'per_week' => $rows->count(),
                'planned' => $planned, 'logged' => $list->count(), 'rate' => $planned ? min(100, round($list->count() / $planned * 100)) : null,
                'last_date' => $last->entry_date ?? null, 'last_no' => $last->lesson_no ?? null, 'last_title' => $last->lesson_title ?? null,
                'avg_rating' => $scores->count() ? round($scores->avg(), 2) : null,
            ];
        }
        usort($subjects, fn ($a, $b) => ($a['rate'] ?? 0) <=> ($b['rate'] ?? 0));

        $lessons = null;
        if ($r->filled('subject_id')) {
            $lessons = DB::table('sm_ll_entries as e')->leftJoin('sm_teachers as t', 't.id', '=', 'e.teacher_id')
                ->where('e.class_id', $c->id)->where('e.subject_id', (int) $r->query('subject_id'))->where('e.status', 'submitted')->whereBetween('e.entry_date', [$sem['start'], $sem['end']])
                ->orderByDesc('e.entry_date')->orderByDesc('e.period')->limit(200)
                ->get(['e.id', 'e.entry_date', 'e.period', 'e.lesson_no', 'e.lesson_title', 'e.homework', 'e.rating', 't.full_name as teacher_name']);
        }

        return response()->json(['semester' => $sem + ['weeks' => $weeks], 'subjects' => $subjects, 'lessons' => $lessons]);
    }

    /* ===================== Vắng mặt / chuyên cần ===================== */

    private function range(Request $r, object $c): array
    {
        $mon = $this->svc->monday($this->dateOf($r, $c));
        $ok = fn ($d) => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d);
        return [$ok($r->query('from')) ? $r->query('from') : $mon->toDateString(), $ok($r->query('to')) ? $r->query('to') : $mon->copy()->addDays(5)->toDateString()];
    }

    public function attendance(Request $r): JsonResponse
    {
        $c = $this->svc->classOrFail((int) $r->query('class_id'), $r->user());
        [$from, $to] = $this->range($r, $c);

        $students = DB::table('sm_att_lessons as a')->join('sm_students as s', 's.id', '=', 'a.student_id')->where('a.class_id', $c->id)->whereBetween('a.att_date', [$from, $to])
            ->selectRaw("s.id, s.code, s.full_name, COUNT(*) AS total, COALESCE(SUM(a.status='late'),0) AS late, COALESCE(SUM(a.status='excused'),0) AS excused, COALESCE(SUM(a.status='unexcused'),0) AS unexcused")
            ->groupBy('s.id', 's.code', 's.full_name')->havingRaw("SUM(a.status IN ('late','excused','unexcused')) > 0")
            ->orderByRaw("(SUM(a.status = 'unexcused') * 2 + SUM(a.status = 'excused') + SUM(a.status = 'late')) DESC")->limit(100)->get();

        $daily = DB::table('sm_att_lessons')->where('class_id', $c->id)->whereBetween('att_date', [$from, $to])
            ->selectRaw("att_date AS d, COUNT(*) AS total, COALESCE(SUM(status='present'),0) AS present, COALESCE(SUM(status='late'),0) AS late, COALESCE(SUM(status='excused'),0) AS excused, COALESCE(SUM(status='unexcused'),0) AS unexcused")
            ->groupBy('att_date')->orderBy('att_date')->get();

        $sum = ['total' => 0, 'present' => 0, 'late' => 0, 'excused' => 0, 'unexcused' => 0];
        foreach ($daily as $d) {
            foreach ($sum as $k => $_) {
                $sum[$k] += (int) $d->$k;
            }
        }
        $sum['rate'] = $sum['total'] ? round($sum['present'] / $sum['total'] * 100, 1) : null;

        return response()->json(['from' => $from, 'to' => $to, 'summary' => $sum, 'students' => $students, 'daily' => $daily]);
    }

    public function studentAttendance(Request $r): JsonResponse
    {
        $c = $this->svc->classOrFail((int) $r->query('class_id'), $r->user());
        [$from, $to] = $this->range($r, $c);
        $rows = DB::table('sm_att_lessons as a')->leftJoin('sm_class_subjects as cs', 'cs.id', '=', 'a.class_subject_id')->leftJoin('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->where('a.class_id', $c->id)->where('a.student_id', (int) $r->query('student_id'))->whereBetween('a.att_date', [$from, $to])->where('a.status', '<>', 'present')
            ->orderByDesc('a.att_date')->orderBy('a.period')->get(['a.att_date', 'a.period', 'a.status', 'a.note', 's.name as subject_name']);
        return response()->json(['data' => $rows]);
    }

    public function roster(Request $r): JsonResponse
    {
        $c = $this->svc->classOrFail((int) $r->query('class_id'), $r->user());
        return response()->json(['data' => DB::table('sm_enrollments as e')->join('sm_students as s', 's.id', '=', 'e.student_id')
            ->where('e.class_id', $c->id)->where('e.school_year_id', $c->school_year_id)->orderBy('s.full_name')->get(['s.id', 's.code', 's.full_name'])]);
    }

    public function logs(Request $r): JsonResponse
    {
        $c = $this->svc->classOrFail((int) $r->query('class_id'), $r->user());
        return response()->json(DB::table('sm_ll_logs')->where('class_id', $c->id)->orderByDesc('id')->paginate(25, ['id', 'user_name', 'action', 'description', 'created_at']));
    }
}
