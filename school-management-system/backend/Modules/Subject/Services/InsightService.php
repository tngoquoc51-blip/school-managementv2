<?php

namespace Modules\Subject\Services;

use Illuminate\Support\Facades\DB;

class InsightService
{
    public function __construct(private AssignmentService $assign) {}

    public function overview(int $yearId): array
    {
        $subjects = DB::table('sm_subjects')->get();
        $classes = DB::table('sm_classes')->where('school_year_id', $yearId)->get();
        $assigned = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->where('c.school_year_id', $yearId)->count();

        $expected = 0;
        $active = $subjects->where('status', 'active');
        foreach ($classes as $c) {
            $expected += $active->filter(fn ($s) => in_array((int) $c->grade, array_map('intval', explode(',', $s->grades)), true))->count();
        }

        $byGroup = DB::table('sm_subjects as s')->leftJoin('sm_subj_groups as g', 'g.id', '=', 's.group_id')
            ->groupBy('g.id', 'g.name')->orderBy('g.id')->selectRaw('g.id, COALESCE(g.name, ?) as name, COUNT(*) as total, SUM(s.periods_per_week) as periods', ['Chưa phân tổ'])->get();

        $top = DB::table('sm_subjects as s')
            ->leftJoin('sm_class_subjects as cs', 'cs.subject_id', '=', 's.id')
            ->leftJoin('sm_classes as c', fn ($j) => $j->on('c.id', '=', 'cs.class_id')->where('c.school_year_id', '=', $yearId))
            ->groupBy('s.id', 's.name', 's.color', 's.code')->orderByDesc('n')->orderBy('s.sort_order')->limit(8)
            ->selectRaw('s.id, s.code, s.name, s.color, COUNT(c.id) as n')->get();

        return [
            'school_year_id' => $yearId,
            'totals' => [
                'subjects' => $subjects->count(), 'active' => $active->count(), 'inactive' => $subjects->count() - $active->count(),
                'score' => $subjects->where('kind', 'score')->count(), 'pass' => $subjects->where('kind', 'pass')->count(),
                'periods_per_week' => (int) $active->sum('periods_per_week'),
                'groups' => DB::table('sm_subj_groups')->count(), 'teachers' => DB::table('sm_teachers')->count(), 'classes' => $classes->count(),
                'assigned' => $assigned, 'expected' => $expected,
                'coverage' => $expected ? round($assigned * 100 / $expected, 1) : 0,
            ],
            'by_group' => $byGroup->map(fn ($g) => ['id' => $g->id, 'name' => $g->name, 'total' => (int) $g->total, 'periods' => (int) $g->periods])->all(),
            'by_category' => ['required' => $subjects->where('category', 'required')->count(), 'elective' => $subjects->where('category', 'elective')->count(), 'topic' => $subjects->where('category', 'topic')->count()],
            'top_subjects' => $top->map(fn ($t) => (array) $t)->all(),
            'recent' => DB::table('sm_subj_audit')->orderByDesc('id')->limit(6)->get()->all(),
        ];
    }

    /** Kiểm tra toàn vẹn dữ liệu & liên kết giữa môn học – giáo viên – lớp – TKB. */
    public function integrity(int $yearId): array
    {
        $issues = [];
        $push = function (string $key, string $sev, string $title, string $hint, array $items) use (&$issues) {
            $issues[] = ['key' => $key, 'severity' => $sev, 'title' => $title, 'hint' => $hint, 'count' => count($items), 'items' => array_slice($items, 0, 25)];
        };

        $classes = DB::table('sm_classes')->where('school_year_id', $yearId)->get();
        $subjects = DB::table('sm_subjects')->get();
        $have = DB::table('sm_class_subjects')->whereIn('class_id', $classes->pluck('id'))->get()->keyBy(fn ($r) => $r->class_id . ':' . $r->subject_id);

        $missing = [];
        foreach ($classes as $c) {
            foreach ($subjects->where('status', 'active') as $s) {
                if (in_array((int) $c->grade, array_map('intval', explode(',', $s->grades)), true) && ! isset($have[$c->id . ':' . $s->id])) {
                    $missing[] = "Lớp {$c->name} chưa có giáo viên môn {$s->name}";
                }
            }
        }
        $push('missing_assignment', 'error', 'Lớp chưa được phân công giáo viên', 'Vào tab "Phân công giảng dạy" để gán hoặc dùng Tự động phân công.', $missing);

        $teachers = DB::table('sm_teachers')->get()->keyBy('id');
        $mismatch = [];
        $inactiveUse = [];
        $byHomeroom = []; // môn đánh giá do GVCN dạy (VD: HĐ trải nghiệm) — hợp lệ, không cảnh báo
        foreach ($have as $r) {
            $t = $teachers[$r->teacher_id] ?? null;
            $s = $subjects->firstWhere('id', $r->subject_id);
            $c = $classes->firstWhere('id', $r->class_id);
            $isHomeroomPass = $s && $c && $s->kind === 'pass' && (int) $c->homeroom_teacher_id === (int) $r->teacher_id;
            if ($isHomeroomPass) {
                $byHomeroom[$s->id] = true;
            }
            if ($t && $s && (int) $t->main_subject_id !== (int) $s->id && ! $isHomeroomPass) {
                $mismatch[] = "{$t->full_name} dạy {$s->name} lớp {$c->name} (chuyên môn khác)";
            }
            if ($s && $s->status !== 'active') {
                $inactiveUse[] = "Môn {$s->name} đã ngừng nhưng vẫn phân công ở lớp {$c->name}";
            }
        }
        $push('teacher_mismatch', 'warning', 'Giáo viên dạy trái chuyên môn', 'Kiểm tra lại phân công hoặc cập nhật chuyên môn giáo viên.', $mismatch);
        $push('inactive_in_use', 'warning', 'Môn đã ngừng vẫn đang được phân công', 'Gỡ phân công hoặc kích hoạt lại môn học.', $inactiveUse);

        $noSpecialist = [];
        foreach ($subjects->where('status', 'active') as $s) {
            if (! $teachers->contains(fn ($t) => (int) $t->main_subject_id === (int) $s->id) && empty($byHomeroom[$s->id])) {
                $noSpecialist[] = "Môn {$s->name} chưa có giáo viên chuyên môn";
            }
        }
        $push('no_specialist', 'error', 'Môn học chưa có giáo viên chuyên môn', 'Bổ sung giáo viên có chuyên môn môn này.', $noSpecialist);

        $push('no_group', 'info', 'Môn học chưa thuộc tổ bộ môn', 'Gán tổ bộ môn trong tab Tổ bộ môn hoặc form sửa môn.', $subjects->whereNull('group_id')->map(fn ($s) => "Môn {$s->name}")->values()->all());

        // Lệch số tiết giữa chương trình và thời khóa biểu
        $slots = DB::table('sm_timetable as tt')->join('sm_class_subjects as cs', 'cs.id', '=', 'tt.class_subject_id')
            ->groupBy('cs.id')->selectRaw('cs.id, COUNT(*) as n')->pluck('n', 'id');
        $cur = DB::table('sm_subj_curriculum')->get()->mapWithKeys(fn ($r) => [$r->subject_id . ':' . $r->grade => (int) $r->periods_per_week]);
        $tt = [];
        foreach ($have as $r) {
            $c = $classes->firstWhere('id', $r->class_id);
            $s = $subjects->firstWhere('id', $r->subject_id);
            $need = $cur[$r->subject_id . ':' . $c->grade] ?? (int) $s->periods_per_week;
            $got = (int) ($slots[$r->id] ?? 0);
            if ($got !== $need) {
                $tt[] = "Lớp {$c->name} - {$s->name}: TKB $got tiết, chương trình $need tiết";
            }
        }
        $push('timetable_mismatch', 'warning', 'Thời khóa biểu lệch với chương trình', 'Điều chỉnh TKB hoặc số tiết/tuần trong tab Chương trình & hệ số.', $tt);

        $over = [];
        foreach ($this->workload($yearId)['teachers'] as $t) {
            if ($t['status'] === 'over') {
                $over[] = "{$t['full_name']}: {$t['periods']}/{$t['quota']} tiết";
            }
        }
        $push('overload', 'warning', 'Giáo viên vượt định mức tiết dạy', 'Chia bớt lớp cho giáo viên cùng chuyên môn.', $over);

        $score = max(0, 100 - 6 * count(array_filter($issues, fn ($i) => $i['severity'] === 'error' && $i['count'])) - 3 * count(array_filter($issues, fn ($i) => $i['severity'] === 'warning' && $i['count'])));

        return ['issues' => $issues, 'health' => $score, 'total' => array_sum(array_column($issues, 'count'))];
    }

    public function workload(int $yearId): array
    {
        $loads = $this->assign->teacherLoads($yearId);
        $subjects = DB::table('sm_subjects')->pluck('name', 'id');
        $classNames = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->where('c.school_year_id', $yearId)
            ->get(['cs.teacher_id', 'c.name', 'cs.subject_id'])->groupBy('teacher_id');
        $base = (int) config('subject.teacher_quota', 17);
        $red = (int) config('subject.homeroom_reduction', 4);

        $out = [];
        foreach (DB::table('sm_teachers')->orderBy('full_name')->get() as $t) {
            $l = $loads[$t->id] ?? ['periods' => 0, 'slots' => 0, 'homeroom' => false];
            $quota = $base - ($l['homeroom'] ? $red : 0);
            $rows = $classNames[$t->id] ?? collect();
            $out[] = [
                'id' => $t->id, 'code' => $t->code, 'full_name' => $t->full_name, 'gender' => $t->gender,
                'main_subject_id' => $t->main_subject_id, 'main_subject' => $subjects[$t->main_subject_id] ?? null,
                'periods' => $l['periods'], 'quota' => $quota, 'homeroom' => $l['homeroom'], 'classes' => $l['slots'],
                'subjects' => $rows->pluck('subject_id')->unique()->map(fn ($id) => $subjects[$id] ?? '')->values()->all(),
                'class_names' => $rows->pluck('name')->unique()->values()->all(),
                'status' => $l['periods'] > $quota ? 'over' : ($l['periods'] < $quota * 0.6 ? 'under' : 'ok'),
            ];
        }
        $n = count($out) ?: 1;

        return [
            'teachers' => $out,
            'summary' => [
                'total' => count($out), 'over' => count(array_filter($out, fn ($t) => $t['status'] === 'over')),
                'under' => count(array_filter($out, fn ($t) => $t['status'] === 'under')),
                'avg_periods' => round(array_sum(array_column($out, 'periods')) / $n, 1), 'quota' => $base,
            ],
        ];
    }

    public function analytics(int $yearId, ?int $semester): array
    {
        $pass = (float) config('subject.pass_score', 5.0);
        $rows = DB::table('sm_grades as g')->join('sm_classes as c', 'c.id', '=', 'g.class_id')
            ->where('g.school_year_id', $yearId)->when($semester, fn ($q) => $q->where('g.semester', $semester))
            ->groupBy('g.subject_id', 'c.grade')
            ->selectRaw('g.subject_id, c.grade, COUNT(g.tbm) as n, SUM(g.tbm) as sum_tbm,
                SUM(CASE WHEN g.tbm >= ? THEN 1 ELSE 0 END) as passed,
                SUM(CASE WHEN g.tbm < 3.5 THEN 1 ELSE 0 END) as b1,
                SUM(CASE WHEN g.tbm >= 3.5 AND g.tbm < 5 THEN 1 ELSE 0 END) as b2,
                SUM(CASE WHEN g.tbm >= 5 AND g.tbm < 6.5 THEN 1 ELSE 0 END) as b3,
                SUM(CASE WHEN g.tbm >= 6.5 AND g.tbm < 8 THEN 1 ELSE 0 END) as b4,
                SUM(CASE WHEN g.tbm >= 8 THEN 1 ELSE 0 END) as b5,
                COUNT(g.assessment) as pf_n, SUM(CASE WHEN g.assessment = ? THEN 1 ELSE 0 END) as pf_pass', [$pass, 'Đạt'])->get()->groupBy('subject_id');

        $out = [];
        foreach (DB::table('sm_subjects')->orderBy('sort_order')->get() as $s) {
            $g = $rows[$s->id] ?? collect();
            $n = (int) $g->sum('n');
            $pfN = (int) $g->sum('pf_n');
            $out[] = [
                'id' => $s->id, 'code' => $s->code, 'name' => $s->name, 'color' => $s->color, 'kind' => $s->kind,
                'n' => $n, 'avg' => $n ? round($g->sum('sum_tbm') / $n, 2) : null,
                'pass_rate' => $n ? round($g->sum('passed') * 100 / $n, 1) : ($pfN ? round($g->sum('pf_pass') * 100 / $pfN, 1) : null),
                'dist' => [(int) $g->sum('b1'), (int) $g->sum('b2'), (int) $g->sum('b3'), (int) $g->sum('b4'), (int) $g->sum('b5')],
                'by_grade' => $g->mapWithKeys(fn ($x) => [(int) $x->grade => $x->n ? round($x->sum_tbm / $x->n, 2) : null])->all(),
            ];
        }

        return ['subjects' => $out, 'buckets' => ['< 3.5', '3.5 – 5', '5 – 6.5', '6.5 – 8', '≥ 8'], 'pass_score' => $pass];
    }
}
