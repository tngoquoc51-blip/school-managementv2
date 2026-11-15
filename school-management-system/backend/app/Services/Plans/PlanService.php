<?php

namespace App\Services\Plans;

use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Nghiệp vụ Kế hoạch: danh sách + thống kê, vòng đời phê duyệt, nhiệm vụ, tiến độ, liên kết, nhân bản, mẫu.
 * $actor = ['id' => ?int, 'name' => string] – người thao tác (ghi vào dòng thời gian).
 */
class PlanService
{
    private const ACTIVE = ['approved', 'running', 'paused'];

    private function bad(string $field, string $message): ValidationException
    {
        return ValidationException::withMessages([$field => [$message]]);
    }

    private function today(): string
    {
        return Carbon::today()->toDateString();
    }

    private function label(string $group, ?string $key): string
    {
        return (string) (config("school_plans.$group")[$key] ?? $key);
    }

    public function log(int $planId, string $type, string $message, array $actor, array $meta = []): void
    {
        DB::table('school_plan_activities')->insert([
            'plan_id' => $planId, 'type' => $type, 'message' => $message,
            'meta' => $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null,
            'user_id' => $actor['id'] ?? null, 'user_name' => $actor['name'] ?? 'Hệ thống', 'created_at' => now(),
        ]);
    }

    /* ===================== tùy chọn cho giao diện ===================== */

    public function options(): array
    {
        $years = DB::table('school_plans')->whereNull('deleted_at')->whereNotNull('school_year')->distinct()->orderByDesc('school_year')->pluck('school_year')->all();
        $now = Carbon::now();
        $start = $now->month >= 8 ? $now->year : $now->year - 1;
        $cur = $start . '-' . ($start + 1);
        if (! in_array($cur, $years, true)) {
            array_unshift($years, $cur);
        }

        $tpl = array_map(fn ($t) => [
            'key' => $t['key'], 'title' => $t['title'], 'desc' => $t['desc'], 'level' => $t['level'], 'category' => $t['category'],
            'duration_days' => $t['duration_days'], 'tasks' => count($t['tasks']),
        ], config('school_plans.templates'));

        return [
            'levels' => config('school_plans.levels'), 'categories' => config('school_plans.categories'),
            'statuses' => config('school_plans.statuses'), 'priorities' => config('school_plans.priorities'),
            'task_statuses' => config('school_plans.task_statuses'), 'transitions' => config('school_plans.transitions'),
            'templates' => $tpl, 'link_targets' => config('school_plans.link_targets'),
            'school_years' => $years, 'current_year' => $cur,
            'owners' => DB::table('school_plans')->whereNull('deleted_at')->whereNotNull('owner_name')->distinct()->orderBy('owner_name')->pluck('owner_name')->all(),
        ];
    }

    /* ===================== danh sách ===================== */

    private function filters(Builder $q, array $f, bool $withStatus, ?int $actorId): void
    {
        $today = $this->today();
        if (! empty($f['q'])) {
            $k = '%' . $f['q'] . '%';
            $q->where(fn ($w) => $w->where('p.title', 'like', $k)->orWhere('p.code', 'like', $k)->orWhere('p.owner_name', 'like', $k)->orWhere('p.department', 'like', $k));
        }
        if ($withStatus && ! empty($f['status'])) {
            $q->where('p.status', $f['status']);
        }
        foreach (['level', 'category', 'school_year', 'priority'] as $k) {
            if (! empty($f[$k])) {
                $q->where('p.' . $k, $f[$k]);
            }
        }
        if (! empty($f['owner'])) {
            $q->where('p.owner_name', $f['owner']);
        }
        if (isset($f['parent_id']) && $f['parent_id'] !== '') {
            $q->where('p.parent_id', (int) $f['parent_id']);
        }
        if (! empty($f['root'])) {
            $q->whereNull('p.parent_id');
        }
        switch ($f['view'] ?? '') {
            case 'mine':
                $q->where('p.created_by', $actorId);
                break;
            case 'late':
                $q->whereIn('p.status', self::ACTIVE)->whereNotNull('p.end_date')->where('p.end_date', '<', $today);
                break;
            case 'soon':
                $q->whereIn('p.status', self::ACTIVE)->whereBetween('p.end_date', [$today, Carbon::today()->addDays(14)->toDateString()]);
                break;
            case 'pending':
                $q->where('p.status', 'pending');
                break;
        }
    }

    private function mapPlan($r): array
    {
        $a = (array) $r;
        $today = $this->today();
        $active = in_array($r->status, self::ACTIVE, true);
        $a['id'] = (int) $r->id;
        $a['progress'] = (int) $r->progress;
        $a['budget'] = $r->budget !== null ? (int) $r->budget : null;
        $a['spent'] = (int) $r->spent;
        $a['tasks_total'] = (int) ($r->tasks_total ?? 0);
        $a['tasks_done'] = (int) ($r->tasks_done ?? 0);
        $a['children_count'] = (int) ($r->children_count ?? 0);
        $a['is_late'] = $active && $r->end_date && $r->end_date < $today;
        $a['days_left'] = $r->end_date ? (int) Carbon::today()->diffInDays(Carbon::parse($r->end_date), false) : null;
        unset($a['deleted_at']);
        return $a;
    }

    public function list(array $f, ?int $actorId): array
    {
        $all = ! empty($f['all']);
        $per = $all ? 1000 : min(max((int) ($f['per_page'] ?? 15), 5), 100);
        $page = $all ? 1 : max((int) ($f['page'] ?? 1), 1);

        $q = DB::table('school_plans as p')->whereNull('p.deleted_at');
        $this->filters($q, $f, true, $actorId);
        $total = (clone $q)->count();

        $q->select('p.*')
            ->selectRaw('(SELECT COUNT(*) FROM school_plan_tasks t WHERE t.plan_id = p.id) as tasks_total')
            ->selectRaw("(SELECT COUNT(*) FROM school_plan_tasks t WHERE t.plan_id = p.id AND t.status = 'done') as tasks_done")
            ->selectRaw('(SELECT COUNT(*) FROM school_plans c WHERE c.parent_id = p.id AND c.deleted_at IS NULL) as children_count');

        $dir = strtolower((string) ($f['dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        switch ($f['sort'] ?? 'updated') {
            case 'end_date': $q->orderBy('p.end_date', $dir); break;
            case 'start_date': $q->orderBy('p.start_date', $dir); break;
            case 'progress': $q->orderBy('p.progress', $dir); break;
            case 'title': $q->orderBy('p.title', $dir); break;
            case 'priority': $q->orderByRaw("CASE p.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END " . $dir); break;
            default: $q->orderBy('p.updated_at', 'desc');
        }
        $q->orderBy('p.id', 'desc');

        $rows = $q->forPage($page, $per)->get()->map(fn ($r) => $this->mapPlan($r))->all();

        // thống kê theo bộ lọc (không áp dụng lọc trạng thái)
        $s = DB::table('school_plans as p')->whereNull('p.deleted_at');
        $this->filters($s, $f, false, $actorId);
        $byStatus = (clone $s)->selectRaw('p.status, COUNT(*) as n')->groupBy('p.status')->pluck('n', 'status')->all();
        $agg = (clone $s)->selectRaw('COUNT(*) as total, COALESCE(AVG(p.progress), 0) as avg_progress, COALESCE(SUM(p.budget), 0) as budget, COALESCE(SUM(p.spent), 0) as spent')->first();
        $late = (clone $s)->whereIn('p.status', self::ACTIVE)->whereNotNull('p.end_date')->where('p.end_date', '<', $this->today())->count();

        return [
            'rows' => $rows,
            'meta' => [
                'current_page' => $page, 'last_page' => max(1, (int) ceil($total / $per)), 'per_page' => $per, 'total' => $total,
                'summary' => [
                    'total' => (int) $agg->total, 'by_status' => array_map('intval', $byStatus), 'late' => $late,
                    'avg_progress' => (int) round($agg->avg_progress), 'budget' => (int) $agg->budget, 'spent' => (int) $agg->spent,
                ],
            ],
        ];
    }

    /* ===================== tổng quan (dashboard) ===================== */

    public function dashboard(?string $schoolYear): array
    {
        $today = $this->today();
        $base = fn () => DB::table('school_plans as p')->whereNull('p.deleted_at')->when($schoolYear, fn ($q) => $q->where('p.school_year', $schoolYear));

        $byStatus = $base()->selectRaw('p.status, COUNT(*) as n')->groupBy('p.status')->pluck('n', 'status')->all();
        $byCat = $base()->selectRaw('p.category, COUNT(*) as n, COALESCE(AVG(p.progress), 0) as pr')->groupBy('p.category')->get()
            ->map(fn ($r) => ['key' => $r->category, 'label' => $this->label('categories', $r->category), 'count' => (int) $r->n, 'progress' => (int) round($r->pr)])->all();
        $agg = $base()->selectRaw('COUNT(*) as total, COALESCE(AVG(p.progress), 0) as avg_progress, COALESCE(SUM(p.budget), 0) as budget, COALESCE(SUM(p.spent), 0) as spent')->first();

        $cols = ['p.id', 'p.code', 'p.title', 'p.status', 'p.priority', 'p.progress', 'p.start_date', 'p.end_date', 'p.owner_name', 'p.category'];
        $late = $base()->whereIn('p.status', self::ACTIVE)->whereNotNull('p.end_date')->where('p.end_date', '<', $today)->orderBy('p.end_date')->limit(8)->get($cols)->map(fn ($r) => (array) $r)->all();
        $soon = $base()->whereIn('p.status', self::ACTIVE)->whereBetween('p.end_date', [$today, Carbon::today()->addDays(14)->toDateString()])->orderBy('p.end_date')->limit(8)->get($cols)->map(fn ($r) => (array) $r)->all();
        $pending = $base()->where('p.status', 'pending')->orderBy('p.submitted_at')->limit(8)->get($cols)->map(fn ($r) => (array) $r)->all();

        $tasks = [
            'overdue'  => DB::table('school_plan_tasks as t')->join('school_plans as p', 'p.id', '=', 't.plan_id')->whereNull('p.deleted_at')->where('t.status', '!=', 'done')->whereNotNull('t.due_date')->where('t.due_date', '<', $today)->count(),
            'due_week' => DB::table('school_plan_tasks as t')->join('school_plans as p', 'p.id', '=', 't.plan_id')->whereNull('p.deleted_at')->where('t.status', '!=', 'done')->whereBetween('t.due_date', [$today, Carbon::today()->addDays(7)->toDateString()])->count(),
            'blocked'  => DB::table('school_plan_tasks as t')->join('school_plans as p', 'p.id', '=', 't.plan_id')->whereNull('p.deleted_at')->where('t.status', 'blocked')->count(),
            'done_month' => DB::table('school_plan_tasks as t')->join('school_plans as p', 'p.id', '=', 't.plan_id')->whereNull('p.deleted_at')->where('t.status', 'done')->where('t.completed_at', '>=', Carbon::now()->startOfMonth())->count(),
        ];

        // số kế hoạch hoạt động theo tháng của năm học (T8 → T7)
        $now = Carbon::now();
        $y0 = $schoolYear ? (int) substr($schoolYear, 0, 4) : ($now->month >= 8 ? $now->year : $now->year - 1);
        $ranges = $base()->whereNotNull('p.start_date')->whereNotNull('p.end_date')->whereNotIn('p.status', ['cancelled', 'rejected'])->get(['p.start_date', 'p.end_date']);
        $months = [];
        for ($i = 0; $i < 12; $i++) {
            $m = Carbon::create($y0, 8, 1)->addMonths($i);
            $a = $m->copy()->startOfMonth()->toDateString();
            $b = $m->copy()->endOfMonth()->toDateString();
            $months[] = ['label' => 'T' . $m->month, 'year' => $m->year, 'count' => $ranges->filter(fn ($r) => $r->start_date <= $b && $r->end_date >= $a)->count()];
        }

        $recent = DB::table('school_plan_activities as a')->join('school_plans as p', 'p.id', '=', 'a.plan_id')->whereNull('p.deleted_at')
            ->orderByDesc('a.id')->limit(12)->get(['a.id', 'a.plan_id', 'p.title as plan_title', 'a.type', 'a.message', 'a.user_name', 'a.created_at'])->map(fn ($r) => (array) $r)->all();

        return [
            'total' => (int) $agg->total, 'avg_progress' => (int) round($agg->avg_progress), 'budget' => (int) $agg->budget, 'spent' => (int) $agg->spent,
            'by_status' => array_map('intval', $byStatus), 'by_category' => $byCat, 'late' => $late, 'soon' => $soon, 'pending' => $pending,
            'tasks' => $tasks, 'months' => $months, 'recent' => $recent,
        ];
    }

    /* ===================== chi tiết ===================== */

    public function show(int $id): ?array
    {
        $p = DB::table('school_plans')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $p) {
            return null;
        }
        $plan = $this->mapPlan($p + (object) []);  // giữ các trường gốc
        $plan['tasks_total'] = DB::table('school_plan_tasks')->where('plan_id', $id)->count();
        $plan['tasks_done'] = DB::table('school_plan_tasks')->where('plan_id', $id)->where('status', 'done')->count();

        $parent = $p->parent_id ? DB::table('school_plans')->where('id', $p->parent_id)->whereNull('deleted_at')->first(['id', 'code', 'title']) : null;

        return [
            'plan'     => $plan,
            'parent'   => $parent ? (array) $parent : null,
            'children' => DB::table('school_plans')->where('parent_id', $id)->whereNull('deleted_at')->orderBy('start_date')->get(['id', 'code', 'title', 'status', 'progress', 'start_date', 'end_date', 'level'])->map(fn ($r) => (array) $r)->all(),
            'tasks'    => DB::table('school_plan_tasks')->where('plan_id', $id)->orderByRaw("FIELD(status, 'blocked', 'doing', 'review', 'todo', 'done')")->orderBy('due_date')->orderBy('position')->get()->map(fn ($r) => (array) $r)->all(),
            'links'    => DB::table('school_plan_links')->where('plan_id', $id)->orderBy('id')->get(['id', 'kind', 'label', 'url'])->map(fn ($r) => (array) $r)->all(),
            'activities' => DB::table('school_plan_activities')->where('plan_id', $id)->orderByDesc('id')->limit(60)->get()->map(fn ($r) => (array) $r)->all(),
        ];
    }

    /* ===================== tạo / sửa / xóa ===================== */

    private function nextCode(): string
    {
        $prefix = config('school_plans.code_prefix', 'KH') . '-' . date('Y') . '-';
        $last = DB::table('school_plans')->where('code', 'like', $prefix . '%')->orderByDesc('code')->value('code');
        $n = $last ? ((int) substr($last, -3)) + 1 : 1;
        return $prefix . str_pad((string) $n, 3, '0', STR_PAD_LEFT);
    }

    public function store(array $d, array $actor): int
    {
        $row = $d + ['status' => 'draft', 'priority' => 'normal', 'level' => 'project', 'category' => 'other'];
        $row['code'] = $this->nextCode();
        $row['spent'] = $row['spent'] ?? 0;
        $row['progress'] = $row['progress'] ?? 0;
        $row['owner_id'] = $row['owner_id'] ?? ($actor['id'] ?? null);
        $row['created_by'] = $actor['id'] ?? null;
        $row['created_at'] = $row['updated_at'] = now();
        $id = (int) DB::table('school_plans')->insertGetId($row);
        $this->log($id, 'create', 'Tạo kế hoạch ' . $row['code'], $actor);
        return $id;
    }

    public function update(int $id, array $d, array $actor): void
    {
        $p = DB::table('school_plans')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $p) {
            throw $this->bad('id', 'Không tìm thấy kế hoạch.');
        }
        if (in_array($p->status, ['completed', 'cancelled'], true)) {
            throw $this->bad('status', 'Kế hoạch đã hoàn thành hoặc đã hủy nên không sửa được.');
        }
        if (isset($d['parent_id']) && (int) $d['parent_id'] === $id) {
            throw $this->bad('parent_id', 'Kế hoạch không thể là cha của chính nó.');
        }
        $changed = [];
        foreach ($d as $k => $v) {
            if ((string) ($p->{$k} ?? '') !== (string) ($v ?? '')) {
                $changed[] = $k;
            }
        }
        if (! $changed) {
            return;
        }
        DB::table('school_plans')->where('id', $id)->update($d + ['updated_at' => now()]);
        $this->log($id, 'update', 'Cập nhật thông tin kế hoạch', $actor, ['fields' => $changed]);
    }

    public function destroy(int $id, array $actor): void
    {
        $p = DB::table('school_plans')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $p) {
            throw $this->bad('id', 'Không tìm thấy kế hoạch.');
        }
        if (! in_array($p->status, ['draft', 'cancelled', 'rejected'], true)) {
            throw $this->bad('status', 'Chỉ xóa được kế hoạch ở trạng thái Nháp, Đã hủy hoặc Bị từ chối.');
        }
        DB::table('school_plans')->where('id', $id)->update(['deleted_at' => now()]);
        DB::table('school_plans')->where('parent_id', $id)->update(['parent_id' => null]);
        $this->log($id, 'update', 'Xóa kế hoạch', $actor);
    }

    /* ===================== vòng đời phê duyệt ===================== */

    public function transition(int $id, string $to, ?string $note, bool $force, array $actor): array
    {
        return DB::transaction(function () use ($id, $to, $note, $force, $actor) {
            $p = DB::table('school_plans')->where('id', $id)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $p) {
                throw $this->bad('id', 'Không tìm thấy kế hoạch.');
            }
            $allowed = config('school_plans.transitions')[$p->status] ?? [];
            if (! in_array($to, $allowed, true)) {
                throw $this->bad('status', 'Không thể chuyển từ “' . $this->label('statuses', $p->status) . '” sang “' . $this->label('statuses', $to) . '”.');
            }

            $upd = ['status' => $to, 'updated_at' => now()];
            $type = 'status';

            if ($to === 'pending') {
                if (! $p->start_date || ! $p->end_date) {
                    throw $this->bad('status', 'Cần nhập ngày bắt đầu và ngày kết thúc trước khi gửi phê duyệt.');
                }
                $upd += ['submitted_at' => now(), 'approval_note' => null];
            }
            if ($to === 'approved' || $to === 'rejected') {
                if ($to === 'rejected' && ! trim((string) $note)) {
                    throw $this->bad('note', 'Vui lòng nhập lý do từ chối.');
                }
                $upd += ['approved_by' => $actor['id'] ?? null, 'approved_at' => now(), 'approval_note' => $note];
                $type = 'approval';
            }
            if ($to === 'completed') {
                $open = DB::table('school_plan_tasks')->where('plan_id', $id)->where('status', '!=', 'done')->count();
                if ($open > 0 && ! $force) {
                    throw $this->bad('status', "Còn {$open} nhiệm vụ chưa hoàn thành. Hoàn thành các nhiệm vụ hoặc chọn “Vẫn hoàn thành”.");
                }
                $upd += ['progress' => 100, 'completed_at' => now()];
            }

            DB::table('school_plans')->where('id', $id)->update($upd);
            $msg = $this->label('statuses', $p->status) . ' → ' . $this->label('statuses', $to) . ($note ? ': ' . $note : '');
            $this->log($id, $type, $msg, $actor, ['from' => $p->status, 'to' => $to]);

            return ['status' => $to, 'status_label' => $this->label('statuses', $to)];
        });
    }

    /* ===================== nhiệm vụ & tiến độ ===================== */

    public function recalc(int $planId): int
    {
        $tasks = DB::table('school_plan_tasks')->where('plan_id', $planId)->get(['weight', 'status']);
        if ($tasks->isEmpty()) {
            return (int) DB::table('school_plans')->where('id', $planId)->value('progress');
        }
        $total = max(1, (int) $tasks->sum('weight'));
        $done = (int) $tasks->where('status', 'done')->sum('weight');
        $pct = (int) round($done / $total * 100);
        DB::table('school_plans')->where('id', $planId)->update(['progress' => $pct, 'updated_at' => now()]);
        return $pct;
    }

    public function storeTask(int $planId, array $d, array $actor): int
    {
        if (! DB::table('school_plans')->where('id', $planId)->whereNull('deleted_at')->exists()) {
            throw $this->bad('plan', 'Không tìm thấy kế hoạch.');
        }
        $d += ['status' => 'todo', 'priority' => 'normal', 'weight' => 5];
        $d['position'] = (int) DB::table('school_plan_tasks')->where('plan_id', $planId)->max('position') + 1;
        $d['plan_id'] = $planId;
        $d['created_by'] = $actor['id'] ?? null;
        $d['completed_at'] = $d['status'] === 'done' ? now() : null;
        $d['created_at'] = $d['updated_at'] = now();
        $id = (int) DB::table('school_plan_tasks')->insertGetId($d);
        $this->recalc($planId);
        $this->log($planId, 'task', 'Thêm nhiệm vụ: ' . $d['title'], $actor);
        return $id;
    }

    public function updateTask(int $taskId, array $d, array $actor): array
    {
        $t = DB::table('school_plan_tasks')->where('id', $taskId)->first();
        if (! $t) {
            throw $this->bad('task', 'Không tìm thấy nhiệm vụ.');
        }
        if (isset($d['status']) && $d['status'] !== $t->status) {
            $d['completed_at'] = $d['status'] === 'done' ? now() : null;
            $this->log((int) $t->plan_id, 'task', 'Nhiệm vụ “' . $t->title . '”: ' . $this->label('task_statuses', $t->status) . ' → ' . $this->label('task_statuses', $d['status']), $actor);
        }
        DB::table('school_plan_tasks')->where('id', $taskId)->update($d + ['updated_at' => now()]);
        return ['progress' => $this->recalc((int) $t->plan_id), 'plan_id' => (int) $t->plan_id];
    }

    public function destroyTask(int $taskId, array $actor): array
    {
        $t = DB::table('school_plan_tasks')->where('id', $taskId)->first();
        if (! $t) {
            throw $this->bad('task', 'Không tìm thấy nhiệm vụ.');
        }
        DB::table('school_plan_tasks')->where('id', $taskId)->delete();
        $this->log((int) $t->plan_id, 'task', 'Xóa nhiệm vụ: ' . $t->title, $actor);
        return ['progress' => $this->recalc((int) $t->plan_id)];
    }

    /* ===================== bình luận, liên kết ===================== */

    public function comment(int $planId, string $body, array $actor): void
    {
        if (! DB::table('school_plans')->where('id', $planId)->whereNull('deleted_at')->exists()) {
            throw $this->bad('plan', 'Không tìm thấy kế hoạch.');
        }
        $this->log($planId, 'comment', $body, $actor);
    }

    public function addLink(int $planId, array $d, array $actor): int
    {
        if (! DB::table('school_plans')->where('id', $planId)->whereNull('deleted_at')->exists()) {
            throw $this->bad('plan', 'Không tìm thấy kế hoạch.');
        }
        $id = (int) DB::table('school_plan_links')->insertGetId($d + ['plan_id' => $planId, 'created_by' => $actor['id'] ?? null, 'created_at' => now(), 'updated_at' => now()]);
        $this->log($planId, 'link', 'Thêm liên kết: ' . $d['label'], $actor);
        return $id;
    }

    public function deleteLink(int $linkId, array $actor): void
    {
        $l = DB::table('school_plan_links')->where('id', $linkId)->first();
        if ($l) {
            DB::table('school_plan_links')->where('id', $linkId)->delete();
            $this->log((int) $l->plan_id, 'link', 'Gỡ liên kết: ' . $l->label, $actor);
        }
    }

    /* ===================== nhân bản & mẫu ===================== */

    public function duplicate(int $id, string $newStart, ?string $title, array $actor): int
    {
        return DB::transaction(function () use ($id, $newStart, $title, $actor) {
            $p = DB::table('school_plans')->where('id', $id)->whereNull('deleted_at')->first();
            if (! $p) {
                throw $this->bad('id', 'Không tìm thấy kế hoạch.');
            }
            $shift = $p->start_date ? Carbon::parse($p->start_date)->diffInDays(Carbon::parse($newStart), false) : 0;
            $sh = fn (?string $d) => $d ? Carbon::parse($d)->addDays($shift)->toDateString() : null;

            $new = (array) $p;
            unset($new['id'], $new['deleted_at']);
            $newId = $this->store([
                'title' => $title ?: $p->title . ' (bản sao)', 'level' => $p->level, 'category' => $p->category, 'school_year' => $p->school_year, 'term' => $p->term,
                'parent_id' => $p->parent_id, 'owner_name' => $p->owner_name, 'department' => $p->department, 'priority' => $p->priority,
                'start_date' => $sh($p->start_date) ?? $newStart, 'end_date' => $sh($p->end_date), 'budget' => $p->budget,
                'objectives' => $p->objectives, 'content' => $p->content,
            ], $actor);

            foreach (DB::table('school_plan_tasks')->where('plan_id', $id)->orderBy('position')->get() as $t) {
                $this->storeTask($newId, [
                    'title' => $t->title, 'description' => $t->description, 'assignee_name' => $t->assignee_name, 'priority' => $t->priority, 'weight' => $t->weight,
                    'start_date' => $sh($t->start_date), 'due_date' => $sh($t->due_date), 'status' => 'todo',
                ], $actor);
            }
            $this->log($newId, 'create', 'Nhân bản từ kế hoạch ' . $p->code, $actor);
            return $newId;
        });
    }

    public function fromTemplate(string $key, array $d, array $actor): int
    {
        $tpl = collect(config('school_plans.templates'))->firstWhere('key', $key);
        if (! $tpl) {
            throw $this->bad('template', 'Không tìm thấy mẫu kế hoạch.');
        }
        return DB::transaction(function () use ($tpl, $d, $actor) {
            $start = Carbon::parse($d['start_date']);
            $id = $this->store([
                'title' => $d['title'] ?: $tpl['title'], 'level' => $tpl['level'], 'category' => $tpl['category'],
                'school_year' => $d['school_year'] ?? null, 'owner_name' => $d['owner_name'] ?? ($actor['name'] ?? null),
                'start_date' => $start->toDateString(), 'end_date' => $start->copy()->addDays($tpl['duration_days'])->toDateString(),
                'objectives' => $tpl['desc'],
            ], $actor);
            foreach ($tpl['tasks'] as $t) {
                $this->storeTask($id, [
                    'title' => $t['title'], 'priority' => $t['p'], 'weight' => $t['w'],
                    'start_date' => $start->toDateString(), 'due_date' => $start->copy()->addDays($t['due'])->toDateString(),
                ], $actor);
            }
            $this->log($id, 'create', 'Tạo từ mẫu “' . $tpl['title'] . '” (' . count($tpl['tasks']) . ' nhiệm vụ)', $actor);
            return $id;
        });
    }
}
