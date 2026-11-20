<?php

namespace Modules\TeacherAdmin\Services;

use Illuminate\Support\Facades\DB;

class InsightService
{
    public function __construct(private WorkloadService $load, private ScheduleService $sched) {}

    public function overview(int $yearId): array
    {
        $t = DB::table('sm_teachers');
        $byStatus = DB::table('sm_teachers')->selectRaw('status, COUNT(*) n')->groupBy('status')->pluck('n', 'status');
        $byDegree = DB::table('sm_teachers')->selectRaw('degree, COUNT(*) n')->groupBy('degree')->pluck('n', 'degree');
        $byContract = DB::table('sm_teachers')->selectRaw('contract, COUNT(*) n')->groupBy('contract')->pluck('n', 'contract');
        $byGender = DB::table('sm_teachers')->selectRaw('gender, COUNT(*) n')->groupBy('gender')->pluck('n', 'gender');
        $bySubject = DB::table('sm_teachers as t')->leftJoin('sm_subjects as s', 's.id', '=', 't.main_subject_id')
            ->selectRaw('s.name, s.color, COUNT(*) n')->groupBy('s.name', 's.color')->orderByDesc('n')->get();
        $wl = $this->load->overview($yearId);
        $leaves = DB::table('sm_tch_leaves');
        $today = now()->toDateString();
        $ages = DB::table('sm_teachers')->whereNotNull('birth_date')->pluck('birth_date')
            ->map(fn ($d) => (int) floor(now()->diffInYears($d)))->all();
        $buckets = ['<30' => 0, '30-39' => 0, '40-49' => 0, '50+' => 0];
        foreach ($ages as $a) {
            $buckets[$a < 30 ? '<30' : ($a < 40 ? '30-39' : ($a < 50 ? '40-49' : '50+'))]++;
        }
        $upcomingCerts = DB::table('sm_tch_certs as c')->join('sm_teachers as t', 't.id', '=', 'c.teacher_id')
            ->whereNotNull('c.expires_at')->where('c.expires_at', '<=', now()->addDays((int) config('teacheradmin.cert_warn_days', 60))->toDateString())
            ->orderBy('c.expires_at')->limit(8)->get(['c.id', 'c.name', 'c.expires_at', 't.full_name', 't.id as teacher_id']);

        return [
            'total' => (int) $t->count(),
            'active' => (int) ($byStatus['active'] ?? 0),
            'homeroom' => (int) DB::table('sm_classes')->where('school_year_id', $yearId)->whereNotNull('homeroom_teacher_id')->count(),
            'classes' => (int) DB::table('sm_classes')->where('school_year_id', $yearId)->count(),
            'on_leave_today' => (int) DB::table('sm_tch_leaves')->where('status', 'approved')->where('from_date', '<=', $today)->where('to_date', '>=', $today)->count(),
            'pending_leaves' => (int) $leaves->where('status', 'pending')->count(),
            'by_status' => $byStatus, 'by_degree' => $byDegree, 'by_contract' => $byContract, 'by_gender' => $byGender,
            'by_subject' => $bySubject, 'age_buckets' => $buckets,
            'workload' => $wl['summary'],
            'top_load' => collect($wl['teachers'])->sortByDesc('periods')->take(5)->values(),
            'upcoming_certs' => $upcomingCerts,
            'recent' => DB::table('sm_tch_audit')->orderByDesc('id')->limit(6)->get(),
        ];
    }

    /** Cung – cầu giáo viên theo môn: nhu cầu tiết dạy so với năng lực đội ngũ. */
    public function supply(int $yearId): array
    {
        $quota = (int) config('teacheradmin.teacher_quota', 17);
        $demand = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->leftJoin('sm_subj_curriculum as cur', fn ($j) => $j->on('cur.subject_id', '=', 's.id')->on('cur.grade', '=', 'c.grade'))
            ->where('c.school_year_id', $yearId)->groupBy('cs.subject_id')
            ->selectRaw('cs.subject_id, SUM(COALESCE(cur.periods_per_week, s.periods_per_week)) as periods, COUNT(DISTINCT c.id) as classes')->get()->keyBy('subject_id');
        $staff = DB::table('sm_tch_subjects as ts')->join('sm_teachers as t', 't.id', '=', 'ts.teacher_id')->where('t.status', 'active')
            ->selectRaw('ts.subject_id, COUNT(*) n, SUM(CASE WHEN ts.is_main = 1 THEN 1 ELSE 0 END) as main_n')->groupBy('ts.subject_id')->get()->keyBy('subject_id');
        $out = [];
        foreach (DB::table('sm_subjects')->orderBy('sort_order')->get() as $s) {
            $d = (int) ($demand[$s->id]->periods ?? 0);
            $n = (int) ($staff[$s->id]->main_n ?? 0);
            $need = round($d / $quota, 1);
            $out[] = ['id' => $s->id, 'code' => $s->code, 'name' => $s->name, 'color' => $s->color, 'kind' => $s->kind,
                'periods' => $d, 'classes' => (int) ($demand[$s->id]->classes ?? 0), 'teachers' => $n, 'qualified' => (int) ($staff[$s->id]->n ?? 0),
                'need_fte' => $need, 'gap' => round($n - $need, 1),
                'status' => $d === 0 ? 'none' : ($n < $need * 0.85 ? 'short' : ($n > $need * 1.4 ? 'surplus' : 'ok'))];
        }

        return ['subjects' => $out, 'quota' => $quota];
    }

    /** Hiệu quả giảng dạy theo giáo viên từ điểm đã nhập (TBM). */
    public function performance(int $yearId, ?int $semester): array
    {
        $pass = (float) config('subject.pass_score', 5.0);
        $rows = DB::table('sm_grades as g')->join('sm_teachers as t', 't.id', '=', 'g.teacher_id')->where('g.school_year_id', $yearId)
            ->when($semester, fn ($q) => $q->where('g.semester', $semester))->whereNotNull('g.tbm')
            ->groupBy('g.teacher_id', 't.full_name', 't.code')
            ->selectRaw('g.teacher_id, t.full_name, t.code, COUNT(*) n, AVG(g.tbm) avg, SUM(CASE WHEN g.tbm >= ? THEN 1 ELSE 0 END) as passed', [$pass])->get();

        return ['pass_score' => $pass, 'teachers' => $rows->map(fn ($r) => [
            'id' => $r->teacher_id, 'full_name' => $r->full_name, 'code' => $r->code, 'n' => (int) $r->n,
            'avg' => round((float) $r->avg, 2), 'pass_rate' => $r->n ? round($r->passed * 100 / $r->n, 1) : null,
        ])->sortByDesc('avg')->values()->all()];
    }

    public function integrity(int $yearId): array
    {
        $issues = [];
        $push = function (string $key, string $sev, string $title, string $hint, $items) use (&$issues) {
            $items = collect($items)->values();
            $issues[] = ['key' => $key, 'severity' => $sev, 'title' => $title, 'hint' => $hint, 'count' => $items->count(), 'items' => $items->take(30)->all()];
        };
        $T = fn () => DB::table('sm_teachers');

        $push('no_subject', 'error', 'Giáo viên chưa có chuyên môn chính', 'Mở hồ sơ và chọn môn chính.',
            $T()->whereNotIn('id', DB::table('sm_tch_subjects')->where('is_main', 1)->select('teacher_id'))->where('status', 'active')->get(['id', 'code', 'full_name'])->map(fn ($x) => ['id' => $x->id, 'label' => "{$x->full_name} ({$x->code})"]));
        $push('inactive_assigned', 'error', 'Giáo viên ngưng/nghỉ hưu vẫn đang được phân công', 'Chuyển phân công sang giáo viên khác.',
            DB::table('sm_class_subjects as cs')->join('sm_teachers as t', 't.id', '=', 'cs.teacher_id')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
                ->where('c.school_year_id', $yearId)->where('t.status', '!=', 'active')->groupBy('t.id', 't.full_name', 't.status')->selectRaw('t.id, t.full_name, t.status, COUNT(*) n')->get()
                ->map(fn ($x) => ['id' => $x->id, 'label' => "{$x->full_name}: {$x->n} phân công"]));
        $push('conflict', 'error', 'Giáo viên trùng tiết trong thời khóa biểu', 'Điều chỉnh thời khóa biểu để tránh dạy 2 lớp cùng lúc.',
            collect($this->sched->conflicts($yearId))->map(fn ($x) => ['id' => $x->teacher_id, 'label' => "{$x->full_name}: thứ {$x->weekday} tiết {$x->period} ({$x->n} lớp)"]));
        $push('no_homeroom', 'warning', 'Lớp chưa có giáo viên chủ nhiệm', 'Vào tab Chủ nhiệm để phân công.',
            DB::table('sm_classes')->where('school_year_id', $yearId)->whereNull('homeroom_teacher_id')->get(['id', 'name'])->map(fn ($x) => ['id' => $x->id, 'label' => "Lớp {$x->name}"]));
        $over = collect($this->load->overview($yearId)['teachers'])->where('status', 'over');
        $push('overload', 'warning', 'Giáo viên vượt định mức tiết dạy', 'Dùng gợi ý cân bằng tải ở tab Tải dạy.',
            $over->map(fn ($x) => ['id' => $x['id'], 'label' => "{$x['full_name']}: {$x['periods']}/{$x['quota']} tiết"]));
        $push('off_specialty', 'warning', 'Dạy ngoài chuyên môn đã đăng ký', 'Bổ sung chuyên môn cho giáo viên hoặc đổi người dạy.',
            DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->join('sm_teachers as t', 't.id', '=', 'cs.teacher_id')->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
                ->where('c.school_year_id', $yearId)->where('s.kind', '!=', 'pass')
                ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('sm_tch_subjects as ts')->whereColumn('ts.teacher_id', 'cs.teacher_id')->whereColumn('ts.subject_id', 'cs.subject_id'))
                ->get(['t.id', 't.full_name', 's.name as subject', 'c.name as class_name'])->map(fn ($x) => ['id' => $x->id, 'label' => "{$x->full_name} dạy {$x->subject} lớp {$x->class_name}"]));
        $push('no_contact', 'info', 'Thiếu số điện thoại hoặc email', 'Bổ sung để gửi thông báo.',
            $T()->where('status', 'active')->where(fn ($q) => $q->whereNull('phone')->orWhere('phone', '')->orWhereNull('email')->orWhere('email', ''))->get(['id', 'full_name', 'code'])->map(fn ($x) => ['id' => $x->id, 'label' => "{$x->full_name} ({$x->code})"]));
        $push('cert_expiring', 'warning', 'Chứng chỉ sắp hết hạn', 'Nhắc giáo viên gia hạn.',
            DB::table('sm_tch_certs as c')->join('sm_teachers as t', 't.id', '=', 'c.teacher_id')->whereNotNull('c.expires_at')
                ->where('c.expires_at', '<=', now()->addDays((int) config('teacheradmin.cert_warn_days', 60))->toDateString())->get(['t.id', 't.full_name', 'c.name', 'c.expires_at'])
                ->map(fn ($x) => ['id' => $x->id, 'label' => "{$x->full_name}: {$x->name} (hết hạn {$x->expires_at})"]));
        $push('duplicate_name', 'info', 'Trùng họ tên (kiểm tra có phải hồ sơ trùng)', 'Xác minh và gộp nếu trùng.',
            DB::table('sm_teachers')->groupBy('full_name')->havingRaw('COUNT(*) > 1')->selectRaw('full_name, COUNT(*) n')->get()->map(fn ($x) => ['id' => null, 'label' => "{$x->full_name} ({$x->n} hồ sơ)"]));

        $score = max(0, 100 - 6 * count(array_filter($issues, fn ($i) => $i['severity'] === 'error' && $i['count'])) - 3 * count(array_filter($issues, fn ($i) => $i['severity'] === 'warning' && $i['count'])) - count(array_filter($issues, fn ($i) => $i['severity'] === 'info' && $i['count'])));

        return ['issues' => $issues, 'health' => $score, 'total' => array_sum(array_column($issues, 'count'))];
    }
}
