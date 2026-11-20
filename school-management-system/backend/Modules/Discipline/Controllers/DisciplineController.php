<?php

namespace Modules\Discipline\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Discipline\Services\DisciplineScoreService as Score;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DisciplineController extends Controller
{
    private const APPROVERS = ['super_admin', 'admin', 'principal', 'vice_principal'];
    private const STAFF = ['super_admin', 'admin', 'principal', 'vice_principal', 'supervisor', 'giam_thi', 'giao_vu',
        'academic', 'homeroom_teacher', 'teacher'];
    private const ACTIONS = ['nhac_nho', 'phe_binh', 'kiem_diem', 'lao_dong', 'moi_phu_huynh', 'khien_trach', 'canh_cao', 'dinh_chi'];

    public function __construct(private Score $sc) {}

    /* ------------------------------------------------------------ helpers */

    private function roles(Request $r): array
    {
        static $cache = [];
        $id = $r->user()->id;
        return $cache[$id] ??= DB::table('model_has_roles as m')->join('roles as ro', 'ro.id', '=', 'm.role_id')
            ->where('m.model_id', $id)->pluck('ro.name')->all();
    }

    private function can(Request $r, string $ability): bool
    {
        $allowed = $ability === 'approve' ? self::APPROVERS : self::STAFF;
        return (bool) array_intersect($this->roles($r), $allowed);
    }

    private function need(Request $r, string $ability): void
    {
        abort_unless($this->can($r, $ability), 403, 'Bạn không có quyền thực hiện thao tác này.');
    }

    private function actor(Request $r): string
    {
        return mb_substr($r->user()->name ?? $r->user()->email ?? 'Hệ thống', 0, 80);
    }

    private function log(?int $recordId, ?int $studentId, string $kind, string $summary, Request $r): void
    {
        DB::table('sm_disc_logs')->insert(['record_id' => $recordId, 'student_id' => $studentId, 'kind' => $kind,
            'summary' => mb_substr($summary, 0, 255), 'actor_name' => $this->actor($r), 'created_at' => now()]);
    }

    private function year(Request $r): int
    {
        return (int) ($r->query('year_id') ?: $this->sc->currentYearId());
    }

    private function sem(Request $r): int
    {
        return (int) $r->query('semester', 0);
    }

    private function recordOrFail(int $id): object
    {
        $rec = DB::table('sm_disc_records')->where('id', $id)->first();
        abort_unless($rec, 404, 'Không tìm thấy biên bản vi phạm.');
        return $rec;
    }

    private function recordsQuery(Request $r)
    {
        $q = DB::table('sm_disc_records as r')
            ->join('sm_students as s', 's.id', '=', 'r.student_id')
            ->join('sm_classes as c', 'c.id', '=', 'r.class_id')
            ->join('sm_disc_categories as k', 'k.id', '=', 'r.category_id')
            ->select('r.*', 's.code as student_code', 's.full_name as student_name', 's.gender', 'c.name as class_name',
                'c.grade', 'k.name as category_name', 'k.group_name', 'k.severity')
            ->where('r.school_year_id', $this->year($r))
            ->when($this->sem($r) > 0, fn ($x) => $x->where('r.semester', $this->sem($r)))
            ->when($r->query('class_id'), fn ($x, $v) => $x->where('r.class_id', $v))
            ->when($r->query('grade'), fn ($x, $v) => $x->where('c.grade', $v))
            ->when($r->query('category_id'), fn ($x, $v) => $x->where('r.category_id', $v))
            ->when($r->query('group'), fn ($x, $v) => $x->where('k.group_name', $v))
            ->when($r->query('severity'), fn ($x, $v) => $x->where('k.severity', $v))
            ->when($r->query('status'), fn ($x, $v) => $x->where('r.status', $v))
            ->when($r->query('from'), fn ($x, $v) => $x->where('r.occurred_at', '>=', $v . ' 00:00:00'))
            ->when($r->query('to'), fn ($x, $v) => $x->where('r.occurred_at', '<=', $v . ' 23:59:59'))
            ->when($r->query('q'), function ($x, $v) {
                $like = '%' . trim($v) . '%';
                $x->where(fn ($w) => $w->where('s.full_name', 'like', $like)->orWhere('s.code', 'like', $like)->orWhere('r.code', 'like', $like));
            });
        return $q;
    }

    /* --------------------------------------------------------------- meta */

    public function meta(Request $r)
    {
        $this->need($r, 'create');
        $yearId = $this->year($r);
        return [
            'year_id' => $yearId,
            'semester' => $this->sc->semesterFor($yearId),
            'years' => DB::table('sm_school_years')->orderByDesc('id')->get(['id', 'label', 'is_current']),
            'classes' => DB::table('sm_classes')->where('school_year_id', $yearId)->orderBy('grade')->orderBy('name')->get(['id', 'name', 'grade']),
            'categories' => DB::table('sm_disc_categories')->orderBy('group_name')->orderBy('code')->get(),
            'settings' => $this->sc->settings(),
            'permissions' => ['approve' => $this->can($r, 'approve'), 'create' => $this->can($r, 'create')],
        ];
    }

    /* ----------------------------------------------------------- overview */

    public function overview(Request $r)
    {
        $this->need($r, 'create');
        $year = $this->year($r);
        $sem = $this->sem($r);
        $counted = Score::COUNTED;

        $base = fn () => DB::table('sm_disc_records as r')->where('r.school_year_id', $year)
            ->when($sem > 0, fn ($x) => $x->where('r.semester', $sem));

        $total = (clone $base())->count();
        $pending = (clone $base())->where('r.status', 'pending')->count();
        $valid = (clone $base())->whereIn('r.status', $counted)->count();
        $resolved = (clone $base())->where('r.status', 'resolved')->count();
        $severe = (clone $base())->whereIn('r.status', $counted)
            ->join('sm_disc_categories as k', 'k.id', '=', 'r.category_id')->where('k.severity', '>=', 3)->count();
        $students = (clone $base())->whereIn('r.status', $counted)->distinct()->count('r.student_id');
        $commend = DB::table('sm_disc_commendations')->where('school_year_id', $year)->where('status', 'approved')
            ->when($sem > 0, fn ($x) => $x->where('semester', $sem))->count();
        $appealsPending = DB::table('sm_disc_appeals')->where('status', 'pending')->count();
        $enrolled = DB::table('sm_enrollments')->where('school_year_id', $year)->count();

        $thisMonth = DB::table('sm_disc_records')->where('school_year_id', $year)->whereIn('status', $counted)
            ->whereRaw("DATE_FORMAT(occurred_at,'%Y-%m') = ?", [date('Y-m')])->count();
        $lastMonth = DB::table('sm_disc_records')->where('school_year_id', $year)->whereIn('status', $counted)
            ->whereRaw("DATE_FORMAT(occurred_at,'%Y-%m') = ?", [date('Y-m', strtotime('first day of last month'))])->count();

        $perDay = DB::table('sm_disc_records')->where('school_year_id', $year)->whereIn('status', $counted)
            ->where('occurred_at', '>=', now()->subDays(29)->startOfDay())
            ->groupBy(DB::raw('DATE(occurred_at)'))->selectRaw('DATE(occurred_at) d, COUNT(*) n')->pluck('n', 'd');
        $trend = [];
        for ($i = 29; $i >= 0; $i--) {
            $d = now()->subDays($i)->format('Y-m-d');
            $trend[] = ['date' => $d, 'count' => (int) ($perDay[$d] ?? 0)];
        }

        $byGroup = (clone $base())->whereIn('r.status', $counted)
            ->join('sm_disc_categories as k', 'k.id', '=', 'r.category_id')
            ->groupBy('k.group_name')->selectRaw('k.group_name name, COUNT(*) count, SUM(r.points) points')->orderByDesc('count')->get();
        $byCategory = (clone $base())->whereIn('r.status', $counted)
            ->join('sm_disc_categories as k', 'k.id', '=', 'r.category_id')
            ->groupBy('k.id', 'k.name', 'k.severity')->selectRaw('k.name, k.severity, COUNT(*) count')->orderByDesc('count')->limit(8)->get();
        $byClass = (clone $base())->whereIn('r.status', $counted)
            ->join('sm_classes as c', 'c.id', '=', 'r.class_id')
            ->groupBy('c.id', 'c.name')->selectRaw('c.id, c.name, COUNT(*) count, SUM(r.points) points')->orderByDesc('count')->limit(10)->get();
        $byGrade = (clone $base())->whereIn('r.status', $counted)
            ->join('sm_classes as c', 'c.id', '=', 'r.class_id')
            ->groupBy('c.grade')->selectRaw('c.grade, COUNT(*) count')->orderBy('c.grade')->get();

        // Phân bố hạnh kiểm đề xuất toàn trường
        $scores = $this->sc->scores($year, $sem);
        $dist = ['Tốt' => 0, 'Khá' => 0, 'Đạt' => 0, 'Chưa đạt' => 0];
        foreach ($scores as $s) $dist[$s['rank']]++;
        $dist[$this->sc->rank($this->sc->settings()['base_score'])] += max(0, $enrolled - count($scores));

        $watch = collect($scores)->sortBy('score')->take(8)->all();
        $info = DB::table('sm_students as s')->leftJoin('sm_enrollments as e', fn ($j) => $j->on('e.student_id', '=', 's.id')->where('e.school_year_id', $year))
            ->leftJoin('sm_classes as c', 'c.id', '=', 'e.class_id')->whereIn('s.id', array_keys($watch))
            ->get(['s.id', 's.code', 's.full_name', 'c.name as class_name'])->keyBy('id');
        $watchlist = [];
        foreach ($watch as $id => $s) {
            $watchlist[] = ['student_id' => $id, 'code' => $info[$id]->code ?? '', 'full_name' => $info[$id]->full_name ?? '',
                'class_name' => $info[$id]->class_name ?? '', ...$s];
        }

        $recent = $this->recordsQuery($r)->orderByDesc('r.created_at')->limit(8)->get();

        return compact('total', 'pending', 'valid', 'resolved', 'severe', 'students', 'commend', 'enrolled') + [
            'appeals_pending' => $appealsPending, 'this_month' => $thisMonth, 'last_month' => $lastMonth,
            'trend' => $trend, 'by_group' => $byGroup, 'by_category' => $byCategory, 'by_class' => $byClass,
            'by_grade' => $byGrade, 'rank_distribution' => $dist, 'watchlist' => $watchlist, 'recent' => $recent,
        ];
    }

    /* ------------------------------------------------------------- alerts */

    public function alerts(Request $r)
    {
        $this->need($r, 'create');
        $year = $this->sc->currentYearId();
        $s = $this->sc->settings();
        $alerts = [];

        $pending = DB::table('sm_disc_records')->where('status', 'pending')->count();
        if ($pending) $alerts[] = ['key' => 'pending_records', 'level' => 'warn', 'tab' => 'records', 'count' => $pending,
            'title' => "$pending biên bản vi phạm chờ duyệt", 'message' => 'Cần Ban giám hiệu xem xét và phê duyệt.'];

        $pc = DB::table('sm_disc_commendations')->where('status', 'pending')->count();
        if ($pc) $alerts[] = ['key' => 'pending_commend', 'level' => 'info', 'tab' => 'commendations', 'count' => $pc,
            'title' => "$pc đề xuất khen thưởng chờ duyệt", 'message' => 'Duyệt để cộng điểm rèn luyện cho học sinh.'];

        $pa = DB::table('sm_disc_appeals')->where('status', 'pending')->count();
        if ($pa) $alerts[] = ['key' => 'pending_appeals', 'level' => 'danger', 'tab' => 'appeals', 'count' => $pa,
            'title' => "$pa đơn khiếu nại chưa phản hồi", 'message' => 'Phản hồi trong thời hạn quy định để bảo đảm quyền lợi học sinh.'];

        $low = collect($this->sc->scores($year))->filter(fn ($x) => $x['score'] < $s['warn_score'])->count();
        if ($low) $alerts[] = ['key' => 'low_score', 'level' => 'danger', 'tab' => 'students', 'count' => $low,
            'title' => "$low học sinh dưới mức điểm cảnh báo ({$s['warn_score']})", 'message' => 'Nên mời phụ huynh và lập kế hoạch hỗ trợ.'];

        $repeat = DB::table('sm_disc_records as r')->join('sm_students as s', 's.id', '=', 'r.student_id')
            ->whereIn('r.status', Score::COUNTED)->where('r.occurred_at', '>=', now()->subDays($s['repeat_days']))
            ->groupBy('r.student_id', 's.full_name')->havingRaw('COUNT(*) >= ?', [$s['repeat_count']])
            ->selectRaw('s.full_name, COUNT(*) n')->orderByDesc('n')->limit(5)->get();
        if ($repeat->count()) $alerts[] = ['key' => 'repeat', 'level' => 'warn', 'tab' => 'students', 'count' => $repeat->count(),
            'title' => $repeat->count() . " học sinh tái phạm ≥ {$s['repeat_count']} lần/{$s['repeat_days']} ngày",
            'message' => $repeat->pluck('full_name')->take(3)->implode(', ') . ($repeat->count() > 3 ? '…' : '')];

        return ['alerts' => $alerts, 'total' => array_sum(array_column($alerts, 'count'))];
    }

    /* ------------------------------------------------------------ records */

    public function records(Request $r)
    {
        $this->need($r, 'create');
        $sort = in_array($r->query('sort'), ['occurred_at', 'points', 'created_at']) ? $r->query('sort') : 'occurred_at';
        return $this->recordsQuery($r)->orderBy("r.$sort", $r->query('dir') === 'asc' ? 'asc' : 'desc')
            ->orderByDesc('r.id')->paginate(min((int) $r->query('per_page', 15), 100));
    }

    public function show(Request $r, int $id)
    {
        $this->need($r, 'create');
        $this->recordOrFail($id);
        $rec = DB::table('sm_disc_records as r')
            ->join('sm_students as s', 's.id', '=', 'r.student_id')->join('sm_classes as c', 'c.id', '=', 'r.class_id')
            ->join('sm_disc_categories as k', 'k.id', '=', 'r.category_id')
            ->where('r.id', $id)
            ->first(['r.*', 's.code as student_code', 's.full_name as student_name', 's.gender', 's.birth_date', 'c.name as class_name',
                'c.grade', 'k.name as category_name', 'k.group_name', 'k.severity', 'k.suggested_action']);
        return ['record' => $rec,
            'logs' => DB::table('sm_disc_logs')->where('record_id', $id)->orderByDesc('id')->get(),
            'appeals' => DB::table('sm_disc_appeals')->where('record_id', $id)->orderByDesc('id')->get(),
            'student_score' => $this->sc->studentScore($rec->student_id, $rec->school_year_id, 0),
            'prior_count' => DB::table('sm_disc_records')->where('student_id', $rec->student_id)->where('id', '<>', $id)
                ->whereIn('status', Score::COUNTED)->where('school_year_id', $rec->school_year_id)->count()];
    }

    public function store(Request $r)
    {
        $this->need($r, 'create');
        $v = $r->validate([
            'student_id' => 'required|integer|exists:sm_students,id',
            'category_id' => 'required|integer|exists:sm_disc_categories,id',
            'occurred_at' => 'required|date',
            'location' => 'nullable|string|max:120',
            'description' => 'required|string|min:5|max:1000',
            'evidence_note' => 'nullable|string|max:255',
            'points' => 'nullable|integer|min:0|max:100',
            'year_id' => 'nullable|integer|exists:sm_school_years,id',
        ]);
        $cat = DB::table('sm_disc_categories')->where('id', $v['category_id'])->first();
        abort_unless($cat->is_active, 422, 'Lỗi vi phạm này đã ngừng sử dụng.');
        $year = (int) ($v['year_id'] ?? $this->sc->currentYearId());
        $classId = DB::table('sm_enrollments')->where('student_id', $v['student_id'])->where('school_year_id', $year)->value('class_id');
        abort_unless($classId, 422, 'Học sinh chưa được xếp lớp trong năm học này.');

        $auto = $this->can($r, 'approve');
        $now = now();
        $id = DB::transaction(function () use ($v, $cat, $year, $classId, $auto, $now, $r) {
            $id = DB::table('sm_disc_records')->insertGetId([
                'code' => 'TMP' . uniqid(), 'school_year_id' => $year, 'semester' => $this->sc->semesterFor($year, $v['occurred_at']),
                'student_id' => $v['student_id'], 'class_id' => $classId, 'category_id' => $cat->id,
                'occurred_at' => date('Y-m-d H:i:s', strtotime($v['occurred_at'])), 'location' => $v['location'] ?? null,
                'description' => $v['description'], 'evidence_note' => $v['evidence_note'] ?? null,
                'points' => $v['points'] ?? $cat->points, 'status' => $auto ? 'approved' : 'pending',
                'reported_by_id' => $r->user()->id, 'reported_by_name' => $this->actor($r),
                'reviewed_by_name' => $auto ? $this->actor($r) : null, 'reviewed_at' => $auto ? $now : null,
                'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('sm_disc_records')->where('id', $id)->update(['code' => sprintf('VP-%s-%05d', date('Y'), $id)]);
            $this->log($id, $v['student_id'], 'created', 'Ghi nhận vi phạm: ' . $cat->name . ($auto ? ' (duyệt ngay)' : ''), $r);
            return $id;
        });
        return response()->json(['id' => $id, 'status' => $auto ? 'approved' : 'pending', 'message' => 'Đã ghi nhận vi phạm.'], 201);
    }

    public function update(Request $r, int $id)
    {
        $this->need($r, 'approve');
        $rec = $this->recordOrFail($id);
        abort_if(in_array($rec->status, ['resolved', 'cancelled']), 422, 'Biên bản đã xử lý hoặc đã hủy, không thể sửa.');
        $v = $r->validate([
            'category_id' => 'sometimes|integer|exists:sm_disc_categories,id',
            'occurred_at' => 'sometimes|date', 'location' => 'nullable|string|max:120',
            'description' => 'sometimes|string|min:5|max:1000', 'evidence_note' => 'nullable|string|max:255',
            'points' => 'sometimes|integer|min:0|max:100',
        ]);
        if (isset($v['occurred_at'])) {
            $v['semester'] = $this->sc->semesterFor($rec->school_year_id, $v['occurred_at']);
            $v['occurred_at'] = date('Y-m-d H:i:s', strtotime($v['occurred_at']));
        }
        DB::table('sm_disc_records')->where('id', $id)->update($v + ['updated_at' => now()]);
        $this->log($id, $rec->student_id, 'updated', 'Chỉnh sửa nội dung biên bản', $r);
        return ['message' => 'Đã cập nhật biên bản.'];
    }

    public function destroy(Request $r, int $id)
    {
        $this->need($r, 'approve');
        $rec = $this->recordOrFail($id);
        abort_unless(in_array($rec->status, ['pending', 'rejected']), 422, 'Chỉ xóa được biên bản chờ duyệt hoặc đã từ chối. Hãy dùng "Hủy biên bản".');
        DB::table('sm_disc_records')->where('id', $id)->delete();
        $this->log(null, $rec->student_id, 'deleted', "Xóa biên bản {$rec->code}", $r);
        return ['message' => 'Đã xóa biên bản.'];
    }

    public function review(Request $r, int $id)
    {
        $this->need($r, 'approve');
        $rec = $this->recordOrFail($id);
        $v = $r->validate(['decision' => 'required|in:approve,reject', 'note' => 'nullable|string|max:255']);
        abort_unless($rec->status === 'pending', 422, 'Biên bản này không còn ở trạng thái chờ duyệt.');
        abort_if($v['decision'] === 'reject' && blank($v['note'] ?? null), 422, 'Vui lòng nhập lý do từ chối.');
        $status = $v['decision'] === 'approve' ? 'approved' : 'rejected';
        DB::table('sm_disc_records')->where('id', $id)->update(['status' => $status, 'reviewed_by_name' => $this->actor($r),
            'reviewed_at' => now(), 'review_note' => $v['note'] ?? null, 'updated_at' => now()]);
        $this->log($id, $rec->student_id, $status, ($status === 'approved' ? 'Duyệt biên bản' : 'Từ chối biên bản') . (($v['note'] ?? '') ? ': ' . $v['note'] : ''), $r);
        return ['status' => $status, 'message' => $status === 'approved' ? 'Đã duyệt biên bản. Điểm rèn luyện đã được trừ.' : 'Đã từ chối biên bản.'];
    }

    public function resolve(Request $r, int $id)
    {
        $this->need($r, 'approve');
        $rec = $this->recordOrFail($id);
        $v = $r->validate(['action_type' => 'required|in:' . implode(',', self::ACTIONS), 'action_note' => 'nullable|string|max:500',
            'action_date' => 'required|date', 'parent_notified' => 'boolean']);
        abort_unless($rec->status === 'approved', 422, 'Chỉ xử lý được biên bản đã duyệt và chưa xử lý.');
        DB::table('sm_disc_records')->where('id', $id)->update($v + ['parent_notified' => (int) ($v['parent_notified'] ?? 0),
            'status' => 'resolved', 'resolved_at' => now(), 'updated_at' => now()]);
        $this->log($id, $rec->student_id, 'resolved', 'Xử lý: ' . $v['action_type'] . (($v['action_note'] ?? '') ? ' – ' . $v['action_note'] : ''), $r);
        return ['message' => 'Đã ghi nhận hình thức xử lý.'];
    }

    public function cancel(Request $r, int $id)
    {
        $this->need($r, 'approve');
        $rec = $this->recordOrFail($id);
        $v = $r->validate(['note' => 'required|string|min:3|max:255']);
        abort_unless(in_array($rec->status, ['approved', 'resolved']), 422, 'Chỉ hủy được biên bản đã duyệt.');
        DB::table('sm_disc_records')->where('id', $id)->update(['status' => 'cancelled', 'review_note' => $v['note'], 'updated_at' => now()]);
        $this->log($id, $rec->student_id, 'cancelled', 'Hủy biên bản: ' . $v['note'] . ' (hoàn lại điểm)', $r);
        return ['message' => 'Đã hủy biên bản và hoàn lại điểm rèn luyện.'];
    }

    /* ----------------------------------------------------------- students */

    public function studentSearch(Request $r)
    {
        $this->need($r, 'create');
        $year = $this->year($r);
        $like = '%' . trim((string) $r->query('q', '')) . '%';
        $rows = DB::table('sm_students as s')
            ->join('sm_enrollments as e', fn ($j) => $j->on('e.student_id', '=', 's.id')->where('e.school_year_id', $year))
            ->join('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->when($r->query('class_id'), fn ($x, $v) => $x->where('e.class_id', $v))
            ->where(fn ($w) => $w->where('s.full_name', 'like', $like)->orWhere('s.code', 'like', $like))
            ->orderBy('s.full_name')->limit(12)->get(['s.id', 's.code', 's.full_name', 's.gender', 'c.name as class_name', 'c.id as class_id']);
        $scores = $this->sc->scores($year, 0);
        $base = $this->sc->settings()['base_score'];
        return $rows->map(fn ($x) => (array) $x + ['score' => $scores[$x->id]['score'] ?? $base, 'rank' => $scores[$x->id]['rank'] ?? $this->sc->rank($base)]);
    }

    public function studentProfile(Request $r, int $id)
    {
        $this->need($r, 'create');
        $year = $this->year($r);
        $st = DB::table('sm_students')->where('id', $id)->first();
        abort_unless($st, 404, 'Không tìm thấy học sinh.');
        $cls = DB::table('sm_enrollments as e')->join('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->where('e.student_id', $id)->where('e.school_year_id', $year)->first(['c.id', 'c.name', 'c.grade']);

        $att = DB::table('sm_ca_records')->where('student_id', $id)->where('school_year_id', $year)
            ->groupBy('status')->selectRaw('status, COUNT(*) n')->pluck('n', 'status');
        $official = DB::table('sm_conduct')->where('student_id', $id)->where('school_year_id', $year)->first();

        return [
            'student' => $st, 'class' => $cls,
            'scores' => ['hk1' => $this->sc->studentScore($id, $year, 1), 'hk2' => $this->sc->studentScore($id, $year, 2),
                'year' => $this->sc->studentScore($id, $year, 0)],
            'records' => DB::table('sm_disc_records as r')->join('sm_disc_categories as k', 'k.id', '=', 'r.category_id')
                ->where('r.student_id', $id)->where('r.school_year_id', $year)->orderByDesc('r.occurred_at')
                ->get(['r.*', 'k.name as category_name', 'k.group_name', 'k.severity']),
            'commendations' => DB::table('sm_disc_commendations')->where('student_id', $id)->where('school_year_id', $year)->orderByDesc('awarded_date')->get(),
            'attendance' => $att, 'official_conduct' => $official,
            'timeline' => DB::table('sm_disc_logs')->where('student_id', $id)->orderByDesc('id')->limit(30)->get(),
        ];
    }

    /** Ghi hạnh kiểm đề xuất (theo điểm rèn luyện) vào sổ hạnh kiểm chính thức sm_conduct. */
    public function applyConduct(Request $r, int $id)
    {
        $this->need($r, 'approve');
        $v = $r->validate(['year_id' => 'required|integer|exists:sm_school_years,id', 'semester' => 'required|in:1,2']);
        abort_unless(DB::table('sm_students')->where('id', $id)->exists(), 404, 'Không tìm thấy học sinh.');
        $rank = $this->sc->studentScore($id, (int) $v['year_id'], (int) $v['semester'])['rank'];
        $row = DB::table('sm_conduct')->where('student_id', $id)->where('school_year_id', $v['year_id'])->first();
        $hk = ['hk1' => $row->hk1 ?? '', 'hk2' => $row->hk2 ?? ''];
        $hk['hk' . $v['semester']] = $rank;
        $set = array_filter($hk);
        $year = array_search(min(array_map(fn ($x) => Score::RANK_ORDER[$x] ?? 0, $set)), Score::RANK_ORDER);
        $data = $hk + ['year_result' => $year];
        $row ? DB::table('sm_conduct')->where('id', $row->id)->update($data)
             : DB::table('sm_conduct')->insert($data + ['student_id' => $id, 'school_year_id' => $v['year_id']]);
        $this->log(null, $id, 'conduct', "Ghi hạnh kiểm HK{$v['semester']} = $rank vào sổ hạnh kiểm", $r);
        return ['message' => "Đã ghi hạnh kiểm HK{$v['semester']}: $rank (cả năm: $year).", 'rank' => $rank, 'year_result' => $year];
    }

    /* ------------------------------------------------------ commendations */

    public function commendations(Request $r)
    {
        $this->need($r, 'create');
        return DB::table('sm_disc_commendations as m')->join('sm_students as s', 's.id', '=', 'm.student_id')
            ->join('sm_classes as c', 'c.id', '=', 'm.class_id')
            ->where('m.school_year_id', $this->year($r))
            ->when($this->sem($r) > 0, fn ($x) => $x->where('m.semester', $this->sem($r)))
            ->when($r->query('status'), fn ($x, $v) => $x->where('m.status', $v))
            ->when($r->query('class_id'), fn ($x, $v) => $x->where('m.class_id', $v))
            ->when($r->query('q'), fn ($x, $v) => $x->where(fn ($w) => $w->where('s.full_name', 'like', "%$v%")->orWhere('s.code', 'like', "%$v%")))
            ->orderByDesc('m.awarded_date')->orderByDesc('m.id')
            ->select('m.*', 's.code as student_code', 's.full_name as student_name', 'c.name as class_name')
            ->paginate(min((int) $r->query('per_page', 15), 100));
    }

    public function commendationStore(Request $r)
    {
        $this->need($r, 'create');
        $v = $r->validate(['student_id' => 'required|integer|exists:sm_students,id',
            'kind' => 'required|in:khen_mieng,giay_khen,hoc_tap,hoat_dong,tieu_bieu', 'title' => 'required|string|min:3|max:160',
            'description' => 'nullable|string|max:500', 'points' => 'required|integer|min:0|max:30', 'awarded_date' => 'required|date']);
        $year = $this->sc->currentYearId();
        $classId = DB::table('sm_enrollments')->where('student_id', $v['student_id'])->where('school_year_id', $year)->value('class_id');
        abort_unless($classId, 422, 'Học sinh chưa được xếp lớp trong năm học hiện tại.');
        $auto = $this->can($r, 'approve');
        $id = DB::table('sm_disc_commendations')->insertGetId($v + ['school_year_id' => $year,
            'semester' => $this->sc->semesterFor($year, $v['awarded_date']), 'class_id' => $classId,
            'status' => $auto ? 'approved' : 'pending', 'created_by_name' => $this->actor($r),
            'reviewed_by_name' => $auto ? $this->actor($r) : null, 'reviewed_at' => $auto ? now() : null,
            'created_at' => now(), 'updated_at' => now()]);
        $this->log(null, $v['student_id'], 'commend', 'Khen thưởng: ' . $v['title'] . ' (+' . $v['points'] . ')', $r);
        return response()->json(['id' => $id, 'message' => $auto ? 'Đã trao khen thưởng và cộng điểm.' : 'Đã gửi đề xuất khen thưởng chờ duyệt.'], 201);
    }

    public function commendationReview(Request $r, int $id)
    {
        $this->need($r, 'approve');
        $v = $r->validate(['decision' => 'required|in:approve,reject', 'note' => 'nullable|string|max:255']);
        $row = DB::table('sm_disc_commendations')->where('id', $id)->first();
        abort_unless($row, 404, 'Không tìm thấy đề xuất.');
        abort_unless($row->status === 'pending', 422, 'Đề xuất này đã được xử lý.');
        $status = $v['decision'] === 'approve' ? 'approved' : 'rejected';
        DB::table('sm_disc_commendations')->where('id', $id)->update(['status' => $status, 'reviewed_by_name' => $this->actor($r),
            'reviewed_at' => now(), 'review_note' => $v['note'] ?? null, 'updated_at' => now()]);
        $this->log(null, $row->student_id, 'commend_' . $status, ($status === 'approved' ? 'Duyệt' : 'Từ chối') . ' khen thưởng: ' . $row->title, $r);
        return ['message' => $status === 'approved' ? 'Đã duyệt khen thưởng, điểm rèn luyện đã được cộng.' : 'Đã từ chối đề xuất.'];
    }

    /* ------------------------------------------------------------- appeals */

    public function appeals(Request $r)
    {
        $this->need($r, 'create');
        return DB::table('sm_disc_appeals as a')->join('sm_disc_records as r', 'r.id', '=', 'a.record_id')
            ->join('sm_students as s', 's.id', '=', 'a.student_id')->join('sm_classes as c', 'c.id', '=', 'r.class_id')
            ->join('sm_disc_categories as k', 'k.id', '=', 'r.category_id')
            ->when($r->query('status'), fn ($x, $v) => $x->where('a.status', $v))
            ->orderByRaw("a.status = 'pending' DESC")->orderByDesc('a.id')
            ->select('a.*', 'r.code as record_code', 'r.points', 'r.occurred_at', 'k.name as category_name',
                's.full_name as student_name', 's.code as student_code', 'c.name as class_name')
            ->paginate(min((int) $r->query('per_page', 15), 100));
    }

    public function appealStore(Request $r)
    {
        $this->need($r, 'create');
        $v = $r->validate(['record_id' => 'required|integer|exists:sm_disc_records,id', 'reason' => 'required|string|min:10|max:800']);
        $rec = $this->recordOrFail($v['record_id']);
        abort_unless(in_array($rec->status, Score::COUNTED), 422, 'Chỉ khiếu nại được biên bản đã duyệt.');
        abort_if(DB::table('sm_disc_appeals')->where('record_id', $rec->id)->where('status', 'pending')->exists(), 422, 'Biên bản này đang có đơn khiếu nại chờ xử lý.');
        $days = $this->sc->settings()['appeal_days'];
        $from = $rec->reviewed_at ?? $rec->created_at;
        abort_if(strtotime($from) < strtotime("-$days days"), 422, "Đã quá hạn khiếu nại ($days ngày kể từ ngày duyệt).");
        $id = DB::table('sm_disc_appeals')->insertGetId(['record_id' => $rec->id, 'student_id' => $rec->student_id, 'reason' => $v['reason'],
            'created_by_name' => $this->actor($r), 'created_at' => now(), 'updated_at' => now()]);
        $this->log($rec->id, $rec->student_id, 'appeal', 'Tiếp nhận đơn khiếu nại', $r);
        return response()->json(['id' => $id, 'message' => 'Đã tiếp nhận đơn khiếu nại.'], 201);
    }

    public function appealRespond(Request $r, int $id)
    {
        $this->need($r, 'approve');
        $v = $r->validate(['decision' => 'required|in:accept,reject', 'response' => 'required|string|min:3|max:500']);
        $ap = DB::table('sm_disc_appeals')->where('id', $id)->first();
        abort_unless($ap, 404, 'Không tìm thấy đơn khiếu nại.');
        abort_unless($ap->status === 'pending', 422, 'Đơn này đã được phản hồi.');
        DB::transaction(function () use ($ap, $v, $id, $r) {
            $accept = $v['decision'] === 'accept';
            DB::table('sm_disc_appeals')->where('id', $id)->update(['status' => $accept ? 'accepted' : 'rejected',
                'response' => $v['response'], 'responded_by_name' => $this->actor($r), 'responded_at' => now(), 'updated_at' => now()]);
            if ($accept) DB::table('sm_disc_records')->where('id', $ap->record_id)->update(['status' => 'cancelled',
                'review_note' => 'Chấp nhận khiếu nại: ' . $v['response'], 'updated_at' => now()]);
            $this->log($ap->record_id, $ap->student_id, $accept ? 'appeal_accept' : 'appeal_reject',
                ($accept ? 'Chấp nhận khiếu nại – hủy biên bản' : 'Bác khiếu nại') . ': ' . $v['response'], $r);
        });
        return ['message' => $v['decision'] === 'accept' ? 'Đã chấp nhận khiếu nại, biên bản được hủy và hoàn điểm.' : 'Đã phản hồi và bác khiếu nại.'];
    }

    /* ---------------------------------------------------------- categories */

    public function categories(Request $r)
    {
        $this->need($r, 'create');
        return DB::table('sm_disc_categories as k')
            ->leftJoin('sm_disc_records as r', 'r.category_id', '=', 'k.id')
            ->groupBy('k.id')->orderBy('k.group_name')->orderBy('k.code')
            ->select('k.*', DB::raw('COUNT(r.id) as used_count'))->get();
    }

    private function catRules(?int $ignore = null): array
    {
        return ['code' => 'required|string|max:16|unique:sm_disc_categories,code' . ($ignore ? ",$ignore" : ''),
            'name' => 'required|string|max:160', 'group_name' => 'required|in:Nề nếp,Học tập,Đạo đức,An toàn,Khác',
            'severity' => 'required|integer|min:1|max:4', 'points' => 'required|integer|min:0|max:100',
            'suggested_action' => 'nullable|in:' . implode(',', self::ACTIONS), 'is_active' => 'boolean'];
    }

    public function categoryStore(Request $r)
    {
        $this->need($r, 'approve');
        $v = $r->validate($this->catRules());
        $id = DB::table('sm_disc_categories')->insertGetId($v + ['is_active' => (int) ($v['is_active'] ?? 1), 'created_at' => now(), 'updated_at' => now()]);
        $this->log(null, null, 'category', 'Thêm lỗi vi phạm: ' . $v['name'], $r);
        return response()->json(['id' => $id, 'message' => 'Đã thêm lỗi vi phạm.'], 201);
    }

    public function categoryUpdate(Request $r, int $id)
    {
        $this->need($r, 'approve');
        $v = $r->validate($this->catRules($id));
        DB::table('sm_disc_categories')->where('id', $id)->update($v + ['updated_at' => now()]);
        $this->log(null, null, 'category', 'Cập nhật lỗi vi phạm: ' . $v['name'], $r);
        return ['message' => 'Đã cập nhật.'];
    }

    public function categoryDestroy(Request $r, int $id)
    {
        $this->need($r, 'approve');
        if (DB::table('sm_disc_records')->where('category_id', $id)->exists()) {
            DB::table('sm_disc_categories')->where('id', $id)->update(['is_active' => 0, 'updated_at' => now()]);
            return ['message' => 'Lỗi này đã được sử dụng nên chỉ được ngừng áp dụng (không xóa).', 'deactivated' => true];
        }
        DB::table('sm_disc_categories')->where('id', $id)->delete();
        return ['message' => 'Đã xóa lỗi vi phạm.', 'deactivated' => false];
    }

    /* ------------------------------------------------------------ settings */

    public function settings(Request $r)
    {
        $this->need($r, 'create');
        return $this->sc->settings();
    }

    public function settingsUpdate(Request $r)
    {
        $this->need($r, 'approve');
        $v = $r->validate(['base_score' => 'required|integer|min:10|max:200', 'tot_min' => 'required|integer|min:1|max:200',
            'kha_min' => 'required|integer|min:1|max:200', 'dat_min' => 'required|integer|min:1|max:200',
            'warn_score' => 'required|integer|min:1|max:200', 'repeat_count' => 'required|integer|min:2|max:20',
            'repeat_days' => 'required|integer|min:1|max:365', 'appeal_days' => 'required|integer|min:1|max:60']);
        abort_unless($v['tot_min'] > $v['kha_min'] && $v['kha_min'] > $v['dat_min'], 422, 'Ngưỡng phải thỏa: Tốt > Khá > Đạt.');
        foreach ($v as $k => $val) DB::table('sm_disc_settings')->updateOrInsert(['k' => $k], ['v' => (string) $val]);
        $this->sc->forgetSettings();
        $this->log(null, null, 'settings', 'Cập nhật quy chế điểm rèn luyện', $r);
        return ['message' => 'Đã lưu quy chế.', 'settings' => $this->sc->settings()];
    }

    /* ------------------------------------------------------ reports & logs */

    public function classReport(Request $r)
    {
        $this->need($r, 'create');
        $year = $this->year($r);
        $sem = $this->sem($r);
        $base = $this->sc->settings()['base_score'];
        $classes = DB::table('sm_classes as c')->leftJoin('sm_teachers as t', 't.id', '=', 'c.homeroom_teacher_id')
            ->where('c.school_year_id', $year)->orderBy('c.grade')->orderBy('c.name')->get(['c.id', 'c.name', 'c.grade', 't.full_name as homeroom']);
        $size = DB::table('sm_enrollments')->where('school_year_id', $year)->groupBy('class_id')->selectRaw('class_id, COUNT(*) n')->pluck('n', 'class_id');
        $vio = DB::table('sm_disc_records')->where('school_year_id', $year)->whereIn('status', Score::COUNTED)
            ->when($sem > 0, fn ($x) => $x->where('semester', $sem))->groupBy('class_id')
            ->selectRaw('class_id, COUNT(*) n, SUM(points) p, COUNT(DISTINCT student_id) st')->get()->keyBy('class_id');
        $com = DB::table('sm_disc_commendations')->where('school_year_id', $year)->where('status', 'approved')
            ->when($sem > 0, fn ($x) => $x->where('semester', $sem))->groupBy('class_id')->selectRaw('class_id, COUNT(*) n, SUM(points) p')->get()->keyBy('class_id');
        $rows = $classes->map(function ($c) use ($size, $vio, $com, $base) {
            $n = max(1, (int) ($size[$c->id] ?? 0));
            $p = (int) ($vio[$c->id]->p ?? 0);
            $a = (int) ($com[$c->id]->p ?? 0);
            return ['class_id' => $c->id, 'name' => $c->name, 'grade' => $c->grade, 'homeroom' => $c->homeroom, 'size' => (int) ($size[$c->id] ?? 0),
                'violations' => (int) ($vio[$c->id]->n ?? 0), 'students_violated' => (int) ($vio[$c->id]->st ?? 0), 'deducted' => $p,
                'commendations' => (int) ($com[$c->id]->n ?? 0), 'avg_score' => round(max(0, min($base, $base - ($p - $a) / $n)), 1)];
        });
        return $rows->sortByDesc('violations')->values();
    }

    public function logs(Request $r)
    {
        $this->need($r, 'approve');
        return DB::table('sm_disc_logs')->orderByDesc('id')->paginate(min((int) $r->query('per_page', 30), 100));
    }

    public function export(Request $r): StreamedResponse
    {
        $this->need($r, 'create');
        $rows = $this->recordsQuery($r)->orderByDesc('r.occurred_at')->limit(20000)->get();
        $status = ['pending' => 'Chờ duyệt', 'approved' => 'Đã duyệt', 'resolved' => 'Đã xử lý', 'rejected' => 'Từ chối', 'cancelled' => 'Đã hủy'];
        $sev = [1 => 'Nhẹ', 2 => 'Trung bình', 3 => 'Nặng', 4 => 'Rất nặng'];
        return response()->streamDownload(function () use ($rows, $status, $sev) {
            $f = fopen('php://output', 'w');
            fwrite($f, "\xEF\xBB\xBF"); // BOM để Excel đọc đúng tiếng Việt
            fputcsv($f, ['Mã biên bản', 'Ngày vi phạm', 'Mã HS', 'Họ tên', 'Lớp', 'Lỗi vi phạm', 'Nhóm', 'Mức độ', 'Điểm trừ', 'Trạng thái', 'Hình thức xử lý', 'Người ghi nhận', 'Người duyệt']);
            foreach ($rows as $x) {
                fputcsv($f, [$x->code, $x->occurred_at, $x->student_code, $x->student_name, $x->class_name, $x->category_name, $x->group_name,
                    $sev[$x->severity] ?? '', $x->points, $status[$x->status] ?? $x->status, $x->action_type, $x->reported_by_name, $x->reviewed_by_name]);
            }
            fclose($f);
        }, 'ky-luat-' . date('Ymd-His') . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
