<?php

namespace Modules\Roster\Services;

use Illuminate\Support\Facades\DB;

class OverviewService
{
    public function build(int $yearId): array
    {
        $totalStudents = DB::table('sm_students')->count();
        $enrolled = DB::table('sm_enrollments')->where('school_year_id', $yearId)->count();
        $classes = DB::table('sm_classes')->where('school_year_id', $yearId)->count();

        $gender = DB::table('sm_enrollments as e')->join('sm_students as s', 's.id', '=', 'e.student_id')
            ->where('e.school_year_id', $yearId)->selectRaw('s.gender, COUNT(*) c')->groupBy('s.gender')->pluck('c', 'gender');

        $byGrade = DB::table('sm_classes as c')->where('c.school_year_id', $yearId)
            ->selectRaw('c.grade, COUNT(*) classes, (SELECT COUNT(*) FROM sm_enrollments e JOIN sm_classes c2 ON c2.id = e.class_id WHERE c2.school_year_id = ? AND c2.grade = c.grade) students', [$yearId])
            ->groupBy('c.grade')->orderBy('c.grade')->get()->map(fn ($g) => ['grade' => (int) $g->grade, 'classes' => (int) $g->classes, 'students' => (int) $g->students])->all();

        $unplaced = DB::table('sm_students as s')->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('sm_enrollments as e')->whereColumn('e.student_id', 's.id')->where('e.school_year_id', $yearId))->count();
        $noAccount = DB::table('sm_students as s')->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('sm_accounts as a')->whereColumn('a.student_id', 's.id'))->count();
        $locked = DB::table('sm_accounts')->where(fn ($q) => $q->where('status', '!=', 'active')->orWhere('locked_until', '>', now()))->count();

        $sizes = DB::table('sm_classes as c')->where('c.school_year_id', $yearId)
            ->selectRaw('c.id, c.name, c.homeroom_teacher_id, (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id) n')->get();
        $over = $sizes->filter(fn ($c) => $c->n > RosterSupport::CLASS_MAX)->count();
        $under = $sizes->filter(fn ($c) => $c->n < RosterSupport::CLASS_MIN)->count();
        $noHomeroom = $sizes->whereNull('homeroom_teacher_id')->count();
        $empty = $sizes->where('n', 0)->count();

        $warnings = [];
        if ($unplaced) $warnings[] = ['level' => 'warning', 'message' => "$unplaced học sinh chưa được xếp lớp trong năm học này", 'target' => 'students', 'filter' => 'unplaced', 'count' => $unplaced];
        if ($noHomeroom) $warnings[] = ['level' => 'warning', 'message' => "$noHomeroom lớp chưa có giáo viên chủ nhiệm", 'target' => 'classes', 'filter' => 'no_homeroom', 'count' => $noHomeroom];
        if ($over) $warnings[] = ['level' => 'warning', 'message' => "$over lớp vượt sĩ số " . RosterSupport::CLASS_MAX, 'target' => 'classes', 'filter' => 'over', 'count' => $over];
        if ($under - $empty > 0) $warnings[] = ['level' => 'info', 'message' => ($under - $empty) . ' lớp dưới ' . RosterSupport::CLASS_MIN . ' học sinh', 'target' => 'classes', 'filter' => 'under', 'count' => $under - $empty];
        if ($noAccount) $warnings[] = ['level' => 'info', 'message' => "$noAccount học sinh chưa có tài khoản đăng nhập", 'target' => 'students', 'filter' => 'no_account', 'count' => $noAccount];

        $conduct = DB::table('sm_conduct')->where('school_year_id', $yearId)->selectRaw('year_result r, COUNT(*) c')->groupBy('year_result')->pluck('c', 'r');

        $recent = DB::table('cat_audit_logs')->whereIn('entity', ['student', 'class'])->orderByDesc('id')->limit(8)
            ->get(['id', 'entity', 'entity_label', 'action', 'user_name', 'created_at'])->map(fn ($r) => (array) $r)->all();

        return [
            'totals' => ['students' => $totalStudents, 'enrolled' => $enrolled, 'unplaced' => $unplaced, 'classes' => $classes],
            'gender' => ['male' => (int) ($gender['Nam'] ?? 0), 'female' => (int) ($gender['Nữ'] ?? 0)],
            'by_grade' => $byGrade,
            'accounts' => ['missing' => $noAccount, 'not_active' => $locked],
            'class_size' => ['over' => $over, 'under' => $under, 'empty' => $empty, 'average' => $classes ? round($enrolled / $classes, 1) : 0, 'max' => RosterSupport::CLASS_MAX, 'min' => RosterSupport::CLASS_MIN],
            'conduct' => collect($conduct)->map(fn ($c, $k) => ['label' => $k, 'count' => (int) $c])->values()->all(),
            'warnings' => $warnings,
            'recent' => $recent,
        ];
    }
}
