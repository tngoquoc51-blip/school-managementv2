<?php

namespace Modules\Rewards\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Rewards\Middleware\EmulationAccess;
use Modules\Rewards\Services\EmulationLogger;
use Modules\Rewards\Services\RankingService;

class EmulationController extends Controller
{
    public function __construct(private RankingService $svc)
    {
    }

    private function year(Request $r): object
    {
        $y = $this->svc->year((int) $r->input('year_id') ?: null);
        abort_if(!$y, 404, 'Chưa có năm học nào trong hệ thống.');
        return $y;
    }

    private function period(Request $r): string
    {
        $p = $r->input('period', 'week');
        return in_array($p, ['week', 'month', 'semester', 'year'], true) ? $p : 'week';
    }

    private function totals(int $yearId, string $from, string $to): object
    {
        return DB::table('sm_rw_records')
            ->selectRaw("COUNT(*) AS n, COALESCE(SUM(points),0) AS s,
                COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END),0) AS plus,
                COALESCE(SUM(CASE WHEN points < 0 THEN points ELSE 0 END),0) AS minus")
            ->where('school_year_id', $yearId)->whereBetween('record_date', [$from, $to])->first();
    }

    /** Dữ liệu khởi tạo cho giao diện */
    public function meta(Request $r): JsonResponse
    {
        $y = $this->year($r);
        return response()->json([
            'year' => $y,
            'years' => DB::table('sm_school_years')->orderByDesc('id')->get(['id', 'label']),
            'classes' => DB::table('sm_classes')->where('school_year_id', $y->id)->where('status', 'active')
                ->orderBy('grade')->orderBy('name')->get(['id', 'name', 'grade']),
            'categories' => RankingService::CATEGORIES,
            'default_date' => $this->svc->defaultDate($y),
            'can' => ['review' => EmulationAccess::can($r->user(), 'review')],
        ]);
    }

    /** Tổng quan toàn trường */
    public function overview(Request $r): JsonResponse
    {
        $y = $this->year($r);
        $date = $r->input('date', $this->svc->defaultDate($y));
        $cnt = max(1, DB::table('sm_classes')->where('school_year_id', $y->id)->where('status', 'active')->count());

        $wk = $this->svc->range('week', $date, $y);
        $pv = $this->svc->previous('week', $wk['from']);
        $cur = $this->totals($y->id, $wk['from'], $wk['to']);
        $prv = $this->totals($y->id, $pv[0], $pv[1]);

        $rank = $this->svc->ranking($y->id, $wk['from'], $wk['to']);
        $hasData = array_sum(array_column($rank, 'weeks')) > 0;
        $byGrade = [];
        foreach ([10, 11, 12] as $g) {
            foreach ($rank as $i) {
                if ($i['grade'] === $g) {
                    $byGrade[] = $i;
                    break;
                }
            }
        }

        $sem = $this->svc->range('semester', $date, $y);
        $awards = DB::table('sm_rw_awards')->where('school_year_id', $y->id)
            ->selectRaw("SUM(status='pending') AS p, SUM(status='approved') AS a")->first();

        return response()->json([
            'range' => $wk,
            'kpi' => [
                'avg' => round(RankingService::BASE + $cur->s / $cnt, 1),
                'plus' => (float) $cur->plus, 'minus' => (float) $cur->minus, 'records' => (int) $cur->n,
                'pending' => (int) ($awards->p ?? 0), 'approved' => (int) ($awards->a ?? 0),
                'prev' => [
                    'avg' => round(RankingService::BASE + $prv->s / $cnt, 1),
                    'plus' => (float) $prv->plus, 'minus' => (float) $prv->minus,
                ],
            ],
            'trend' => $this->svc->weekly($y->id, $date, 8),
            'categories' => $this->svc->categories($y->id, $sem['from'], $sem['to']),
            'top' => $hasData ? array_slice($rank, 0, 5) : [],
            'bottom' => $hasData ? array_reverse(array_slice($rank, -3)) : [],
            'by_grade' => $hasData ? $byGrade : [],
            'recent' => DB::table('sm_rw_logs')->whereIn('action', ['score', 'delete', 'criteria', 'setup', 'init'])->orderByDesc('id')->limit(8)->get(),
        ]);
    }

    /** Bảng xếp hạng theo tuần / tháng / học kỳ / năm */
    public function ranking(Request $r): JsonResponse
    {
        $y = $this->year($r);
        $period = $this->period($r);
        $grade = in_array((int) $r->input('grade'), [10, 11, 12], true) ? (int) $r->input('grade') : null;
        $rg = $this->svc->range($period, $r->input('date', $this->svc->defaultDate($y)), $y);

        $items = $this->svc->ranking($y->id, $rg['from'], $rg['to'], $grade);
        $items = $this->svc->withDelta($items, $period, $rg['from'], $y->id, $grade);

        return response()->json(['range' => $rg, 'items' => $items]);
    }

    /** Hồ sơ thi đua 1 lớp (drawer) */
    public function classDetail(Request $r, int $id): JsonResponse
    {
        $c = DB::table('sm_classes as c')->leftJoin('sm_teachers as t', 't.id', '=', 'c.homeroom_teacher_id')
            ->where('c.id', $id)
            ->first(['c.id', 'c.name', 'c.grade', 'c.room', 'c.capacity', 'c.school_year_id', 't.full_name as homeroom']);
        abort_if(!$c, 404, 'Không tìm thấy lớp.');

        $y = $this->svc->year($c->school_year_id);
        $date = $r->input('date', $this->svc->defaultDate($y));
        $rg = $this->svc->range($this->period($r), $date, $y);

        $all = $this->svc->ranking($y->id, $rg['from'], $rg['to']);
        $me = collect($all)->firstWhere('id', $id);
        $gradeRank = 1 + collect($all)->where('grade', $c->grade)->where('score', '>', $me['score'] ?? 0)->count();

        return response()->json([
            'class' => $c + ['students' => DB::table('sm_enrollments')->where('class_id', $id)->count()],
            'range' => $rg,
            'rank' => [
                'school' => $me['rank'] ?? null, 'total' => count($all), 'score' => $me['score'] ?? RankingService::BASE,
                'grade' => $gradeRank, 'grade_total' => collect($all)->where('grade', $c->grade)->count(),
            ],
            'weekly' => $this->svc->weekly($y->id, $date, 10, $id),
            'categories' => $this->svc->categories($y->id, $rg['from'], $rg['to'], $id),
            'records' => DB::table('sm_rw_records as r')->join('sm_rw_criteria as k', 'k.id', '=', 'r.criteria_id')
                ->where('r.class_id', $id)->whereBetween('r.record_date', [$rg['from'], $rg['to']])
                ->orderByDesc('r.record_date')->orderByDesc('r.id')->limit(40)
                ->get(['r.id', 'r.record_date', 'r.points', 'r.note', 'r.recorded_by_name', 'k.name as criteria', 'k.category']),
            'awards' => DB::table('sm_rw_awards')->where('class_id', $id)->orderByDesc('id')->limit(5)
                ->get(['id', 'kind', 'title', 'status', 'created_at']),
        ]);
    }

    /** Lịch sử chấm điểm (phân trang + lọc) */
    public function records(Request $r): JsonResponse
    {
        $y = $this->year($r);
        $q = DB::table('sm_rw_records as r')
            ->join('sm_rw_criteria as k', 'k.id', '=', 'r.criteria_id')
            ->join('sm_classes as c', 'c.id', '=', 'r.class_id')
            ->where('r.school_year_id', $y->id);

        if ($r->filled('class_id')) $q->where('r.class_id', (int) $r->input('class_id'));
        if ($r->filled('category')) $q->where('k.category', $r->input('category'));
        if ($r->input('type') === 'plus') $q->where('r.points', '>', 0);
        if ($r->input('type') === 'minus') $q->where('r.points', '<', 0);
        if ($r->filled('from')) $q->where('r.record_date', '>=', $r->input('from'));
        if ($r->filled('to')) $q->where('r.record_date', '<=', $r->input('to'));

        return response()->json($q->orderByDesc('r.record_date')->orderByDesc('r.id')->paginate(20, [
            'r.id', 'r.record_date', 'r.points', 'r.note', 'r.recorded_by', 'r.recorded_by_name', 'r.class_id',
            'k.name as criteria', 'k.category', 'c.name as class_name',
        ]));
    }

    /** Ghi điểm cho 1 hoặc nhiều lớp cùng lúc */
    public function storeRecord(Request $r): JsonResponse
    {
        $v = $r->validate([
            'class_ids' => 'required|array|min:1|max:60',
            'class_ids.*' => 'integer|exists:sm_classes,id',
            'criteria_id' => 'required|integer|exists:sm_rw_criteria,id',
            'points' => 'nullable|numeric|min:0.1|max:100',
            'record_date' => 'required|date|before_or_equal:today',
            'note' => 'nullable|string|max:255',
        ]);

        $k = DB::table('sm_rw_criteria')->where('id', $v['criteria_id'])->first();
        if (!$k->is_active) {
            return response()->json(['message' => 'Tiêu chí này đã ngừng áp dụng.'], 422);
        }

        // Dấu điểm do loại tiêu chí quyết định; người dùng chỉ nhập độ lớn
        $pts = abs((float) ($v['points'] ?? $k->default_points)) * ($k->type === 'minus' ? -1 : 1);
        $u = $r->user();
        $classes = DB::table('sm_classes')->whereIn('id', $v['class_ids'])->get(['id', 'school_year_id', 'name']);

        DB::transaction(function () use ($classes, $k, $pts, $v, $u) {
            foreach ($classes as $c) {
                DB::table('sm_rw_records')->insert([
                    'school_year_id' => $c->school_year_id, 'class_id' => $c->id, 'criteria_id' => $k->id,
                    'points' => $pts, 'record_date' => $v['record_date'], 'note' => $v['note'] ?? null,
                    'source' => 'manual', 'recorded_by' => $u->id, 'recorded_by_name' => $u->name, 'created_at' => now(),
                ]);
            }
            $names = $classes->pluck('name')->take(4)->implode(', ') . ($classes->count() > 4 ? '…' : '');
            EmulationLogger::log($u, 'score', sprintf('%s%s điểm · %s · lớp %s', $pts > 0 ? '+' : '', $pts + 0, $k->name, $names));
        });

        return response()->json(['message' => 'Đã ghi nhận điểm thi đua.', 'count' => $classes->count(), 'points' => $pts], 201);
    }

    public function destroyRecord(Request $r, int $id): JsonResponse
    {
        $rec = DB::table('sm_rw_records as r')->join('sm_classes as c', 'c.id', '=', 'r.class_id')
            ->join('sm_rw_criteria as k', 'k.id', '=', 'r.criteria_id')->where('r.id', $id)
            ->first(['r.id', 'r.recorded_by', 'r.points', 'c.name as class_name', 'k.name as criteria']);
        abort_if(!$rec, 404, 'Không tìm thấy bản ghi.');

        $u = $r->user();
        if (!EmulationAccess::can($u, 'review') && (int) $rec->recorded_by !== (int) $u->id) {
            return response()->json(['message' => 'Bạn chỉ được xóa bản ghi do chính mình nhập.'], 403);
        }

        DB::table('sm_rw_records')->where('id', $id)->delete();
        EmulationLogger::log($u, 'delete', "Xóa điểm {$rec->points} · {$rec->criteria} · lớp {$rec->class_name}");
        return response()->json(['message' => 'Đã xóa bản ghi.']);
    }

    public function logs(Request $r): JsonResponse
    {
        $q = DB::table('sm_rw_logs');
        // Mỗi mục (Khen thưởng / Kỷ luật / Thi đua) chỉ thấy nhật ký của mình
        $scopes = [
            'reward' => ['award', 'approve', 'reject', 'award_type'],
            'discipline' => ['dis_award', 'dis_approve', 'dis_reject'],
            'emulation' => ['score', 'delete', 'criteria', 'setup', 'init'],
        ];
        if (isset($scopes[$r->input('scope')])) {
            $q->whereIn('action', $scopes[$r->input('scope')]);
        }
        if ($r->filled('action')) {
            $q->where('action', $r->input('action'));
        }
        return response()->json($q->orderByDesc('id')->paginate(25));
    }

    /** Tìm học sinh (liên kết sm_students + sm_enrollments) để đề xuất khen thưởng */
    public function students(Request $r): JsonResponse
    {
        $q = trim((string) $r->input('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json([]);
        }
        $y = $this->year($r);

        return response()->json(
            DB::table('sm_students as s')
                ->leftJoin('sm_enrollments as e', function ($j) use ($y) {
                    $j->on('e.student_id', '=', 's.id')->where('e.school_year_id', '=', $y->id);
                })
                ->leftJoin('sm_classes as c', 'c.id', '=', 'e.class_id')
                ->where(fn($w) => $w->where('s.full_name', 'like', "%{$q}%")->orWhere('s.code', 'like', "%{$q}%"))
                ->orderBy('s.full_name')->limit(8)
                ->get(['s.id', 's.code', 's.full_name', 'c.id as class_id', 'c.name as class_name'])
        );
    }
}
