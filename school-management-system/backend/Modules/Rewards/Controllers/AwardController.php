<?php

namespace Modules\Rewards\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Rewards\Middleware\EmulationAccess;
use Modules\Rewards\Services\EmulationLogger;
use Modules\Rewards\Services\RankingService;

class AwardController extends Controller
{
    private const KINDS = ['khen_thuong' => 'Khen thưởng', 'nhac_nho' => 'Nhắc nhở', 'ky_luat' => 'Kỷ luật'];

    public function __construct(private RankingService $svc)
    {
    }

    /** Lọc theo loại: ?kind=khen_thuong hoặc ?kind=nhac_nho,ky_luat */
    private function kinds(Request $r): array
    {
        return array_values(array_intersect(explode(',', (string) $r->input('kind', '')), array_keys(self::KINDS)));
    }

    /** Khen thưởng ghi action gốc, nhắc nhở/kỷ luật ghi tiền tố dis_ để nhật ký tách theo từng mục */
    private function act(string $kind, string $base): string
    {
        return $kind === 'khen_thuong' ? $base : 'dis_' . $base;
    }

    public function index(Request $r): JsonResponse
    {
        $y = $this->svc->year((int) $r->input('year_id') ?: null);
        abort_if(!$y, 404, 'Chưa có năm học.');

        $cq = DB::table('sm_rw_awards')->where('school_year_id', $y->id);
        $ks = $this->kinds($r);
        if ($ks) $cq->whereIn('kind', $ks);
        $counts = $cq->selectRaw("COALESCE(SUM(status='pending'),0) AS pending, COALESCE(SUM(status='approved'),0) AS approved, COALESCE(SUM(status='rejected'),0) AS rejected")->first();

        $q = DB::table('sm_rw_awards as a')
            ->leftJoin('sm_classes as c', 'c.id', '=', 'a.class_id')
            ->leftJoin('sm_students as s', 's.id', '=', 'a.student_id')
            ->leftJoin('sm_rw_award_types as t', 't.id', '=', 'a.type_id')
            ->where('a.school_year_id', $y->id);
        if ($r->filled('status')) $q->where('a.status', $r->input('status'));
        if ($ks) $q->whereIn('a.kind', $ks);
        if ($r->filled('target_type')) $q->where('a.target_type', $r->input('target_type'));
        if ($r->filled('q')) {
            $kw = '%' . trim($r->input('q')) . '%';
            $q->where(fn ($w) => $w->where('a.title', 'like', $kw)->orWhere('c.name', 'like', $kw)
                ->orWhere('s.full_name', 'like', $kw)->orWhere('s.code', 'like', $kw));
        }

        $per = min(60, max(1, (int) $r->input('per', 12)));
        $page = $q->orderByRaw('COALESCE(a.reviewed_at, a.created_at) DESC')->orderByDesc('a.id')->paginate($per, [
            'a.*', 'c.name as class_name', 's.full_name as student_name', 's.code as student_code', 't.name as type_name',
        ]);

        return response()->json([
            'counts' => ['pending' => (int) $counts->pending, 'approved' => (int) $counts->approved, 'rejected' => (int) $counts->rejected],
            'page' => $page,
        ]);
    }

    /** Tổng quan màn Khen thưởng */
    public function overview(Request $r): JsonResponse
    {
        $y = $this->svc->year((int) $r->input('year_id') ?: null);
        abort_if(!$y, 404, 'Chưa có năm học.');
        $ks = $this->kinds($r) ?: ['khen_thuong'];
        $base = fn () => DB::table('sm_rw_awards as a')->where('a.school_year_id', $y->id)->whereIn('a.kind', $ks);

        $k = $base()->selectRaw("COALESCE(SUM(a.status='approved'),0) AS approved, COALESCE(SUM(a.status='pending'),0) AS pending,
            COALESCE(SUM(a.status='rejected'),0) AS rejected,
            COUNT(DISTINCT CASE WHEN a.status='approved' AND a.target_type='class' THEN a.class_id END) AS classes,
            COUNT(DISTINCT CASE WHEN a.status='approved' AND a.target_type='student' THEN a.student_id END) AS students,
            COALESCE(SUM(CASE WHEN a.status='approved' AND a.bonus_applied=1 THEN a.bonus_points END),0) AS bonus")->first();

        $months = $base()->where('a.status', 'approved')
            ->selectRaw("DATE_FORMAT(COALESCE(a.reviewed_at, a.created_at), '%Y-%m') AS ym, COUNT(*) AS n")
            ->groupBy('ym')->orderBy('ym')->get()->slice(-8)->values()
            ->map(fn ($m) => ['ym' => $m->ym, 'label' => 'T' . substr($m->ym, 5, 2) . '/' . substr($m->ym, 2, 2), 'n' => (int) $m->n]);

        $levels = $base()->where('a.status', 'approved')->selectRaw("COALESCE(a.level,'Khác') AS lv, COUNT(*) AS n")
            ->groupBy('lv')->orderByDesc('n')->get()->map(fn ($l) => ['lv' => $l->lv, 'n' => (int) $l->n]);

        $byKind = $base()->where('a.status', 'approved')->selectRaw('a.kind AS kd, COUNT(*) AS n')->groupBy('kd')->orderByDesc('n')->get()
            ->map(fn ($x) => ['kd' => $x->kd, 'n' => (int) $x->n]);

        $top = DB::table('sm_rw_awards as a')->join('sm_classes as c', 'c.id', '=', 'a.class_id')
            ->where('a.school_year_id', $y->id)->whereIn('a.kind', $ks)->where('a.status', 'approved')
            ->selectRaw('c.id, c.name, COUNT(*) AS n')->groupBy('c.id', 'c.name')->orderByDesc('n')->orderBy('c.name')->limit(5)->get()
            ->map(fn ($c) => ['id' => (int) $c->id, 'name' => $c->name, 'n' => (int) $c->n]);

        $list = fn (string $status, int $n) => $base()
            ->leftJoin('sm_classes as c', 'c.id', '=', 'a.class_id')->leftJoin('sm_students as s', 's.id', '=', 'a.student_id')
            ->where('a.status', $status)->orderByRaw('COALESCE(a.reviewed_at, a.created_at) DESC')->orderByDesc('a.id')->limit($n)
            ->get(['a.*', 'c.name as class_name', 's.full_name as student_name', 's.code as student_code']);

        return response()->json([
            'kpi' => ['approved' => (int) $k->approved, 'pending' => (int) $k->pending, 'rejected' => (int) $k->rejected,
                'classes' => (int) $k->classes, 'students' => (int) $k->students, 'bonus' => (float) $k->bonus],
            'by_month' => $months, 'by_level' => $levels, 'by_kind' => $byKind, 'top_classes' => $top,
            'recent' => $list('approved', 6), 'pending' => $list('pending', 5),
        ]);
    }

    public function store(Request $r): JsonResponse
    {
        $v = $r->validate([
            'target_type' => 'required|in:class,student',
            'class_id' => 'required_if:target_type,class|nullable|integer|exists:sm_classes,id',
            'student_id' => 'required_if:target_type,student|nullable|integer|exists:sm_students,id',
            'kind' => 'required|in:khen_thuong,nhac_nho,ky_luat',
            'title' => 'required|string|max:150',
            'reason' => 'required|string|max:1000',
            'level' => 'nullable|string|max:30',
            'period_label' => 'nullable|string|max:60',
            'type_id' => 'nullable|integer|exists:sm_rw_award_types,id',
            'bonus_points' => 'nullable|numeric|min:0|max:50',
        ]);

        $y = $this->svc->year((int) $r->input('year_id') ?: null);
        abort_if(!$y, 404, 'Chưa có năm học.');

        // Học sinh → suy ra lớp từ bảng ghi danh để liên kết với xếp hạng lớp
        $classId = $v['class_id'] ?? null;
        if ($v['target_type'] === 'student' && !$classId) {
            $classId = DB::table('sm_enrollments')->where('student_id', $v['student_id'])
                ->where('school_year_id', $y->id)->value('class_id');
        }

        // Điểm thưởng thi đua: chỉ áp dụng cho khen thưởng tập thể lớp
        $bonus = 0.0;
        if ($v['kind'] === 'khen_thuong' && $v['target_type'] === 'class') {
            $bonus = isset($v['bonus_points']) ? (float) $v['bonus_points']
                : (float) (DB::table('sm_rw_award_types')->where('id', $v['type_id'] ?? 0)->value('bonus_points') ?? 0);
        }

        $u = $r->user();
        $id = DB::table('sm_rw_awards')->insertGetId([
            'school_year_id' => $y->id, 'target_type' => $v['target_type'], 'class_id' => $classId,
            'student_id' => $v['target_type'] === 'student' ? $v['student_id'] : null,
            'kind' => $v['kind'], 'title' => $v['title'], 'reason' => $v['reason'],
            'level' => $v['level'] ?? null, 'period_label' => $v['period_label'] ?? null,
            'type_id' => $v['type_id'] ?? null, 'bonus_points' => $bonus, 'bonus_applied' => 0,
            'status' => 'pending', 'proposed_by' => $u->id, 'proposed_by_name' => $u->name,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        EmulationLogger::log($u, $this->act($v['kind'], 'award'), 'Đề xuất ' . mb_strtolower(self::KINDS[$v['kind']]) . ': ' . $v['title']);
        return response()->json(['message' => 'Đã gửi đề xuất, đang chờ Ban Giám hiệu phê duyệt.', 'id' => $id], 201);
    }

    public function review(Request $r, int $id): JsonResponse
    {
        $v = $r->validate([
            'decision' => 'required|in:approve,reject',
            'note' => 'required_if:decision,reject|nullable|string|max:500',
        ]);

        $a = DB::table('sm_rw_awards')->where('id', $id)->first();
        abort_if(!$a, 404, 'Không tìm thấy đề xuất.');
        if ($a->status !== 'pending') {
            return response()->json(['message' => 'Đề xuất này đã được xử lý trước đó.'], 409);
        }

        $u = $r->user();
        $ok = $v['decision'] === 'approve';
        $bonusMsg = '';
        DB::transaction(function () use ($id, $a, $u, $ok, $v, &$bonusMsg) {
            DB::table('sm_rw_awards')->where('id', $id)->update([
                'status' => $ok ? 'approved' : 'rejected', 'reviewed_by' => $u->id, 'reviewed_by_name' => $u->name,
                'reviewed_at' => now(), 'review_note' => $v['note'] ?? null, 'updated_at' => now(),
            ]);

            // Liên kết Thi đua: khen thưởng tập thể có điểm thưởng → tự cộng vào bảng xếp hạng lớp
            if ($ok && $a->kind === 'khen_thuong' && $a->target_type === 'class' && $a->class_id
                && (float) $a->bonus_points > 0 && !$a->bonus_applied) {
                $kid = DB::table('sm_rw_criteria')->where('code', 'KT01')->value('id');
                $year = $this->svc->year((int) $a->school_year_id);
                if ($kid && $year) {
                    DB::table('sm_rw_records')->insert([
                        'school_year_id' => $a->school_year_id, 'class_id' => $a->class_id, 'criteria_id' => $kid,
                        'points' => $a->bonus_points, 'record_date' => $this->svc->defaultDate($year),
                        'note' => mb_substr('Thưởng: ' . $a->title, 0, 255), 'source' => 'award',
                        'recorded_by' => $u->id, 'recorded_by_name' => $u->name, 'created_at' => now(),
                    ]);
                    DB::table('sm_rw_awards')->where('id', $id)->update(['bonus_applied' => 1]);
                    $bonusMsg = ' Đã cộng ' . rtrim(rtrim(number_format((float) $a->bonus_points, 1, '.', ''), '0'), '.') . ' điểm thi đua cho lớp.';
                }
            }
        });

        EmulationLogger::log($u, $this->act($a->kind, $ok ? 'approve' : 'reject'), ($ok ? 'Phê duyệt: ' : 'Từ chối: ') . $a->title . $bonusMsg);

        // Liên kết phân hệ Thông báo
        try {
            DB::table('sm_notifications')->insert([
                'title' => ($ok ? 'Đã phê duyệt: ' : 'Không phê duyệt: ') . $a->title,
                'body' => $ok ? 'Ban Giám hiệu đã phê duyệt đề xuất. ' . ($v['note'] ?? '') : 'Lý do: ' . ($v['note'] ?? ''),
                'type' => 'emulation', 'priority' => 'normal', 'audience' => 'staff',
                'sender_id' => $u->id, 'sender_name' => $u->name, 'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Không để lỗi thông báo làm hỏng nghiệp vụ phê duyệt
        }

        return response()->json(['message' => ($ok ? 'Đã phê duyệt đề xuất.' : 'Đã từ chối đề xuất.') . $bonusMsg]);
    }

    public function destroy(Request $r, int $id): JsonResponse
    {
        $a = DB::table('sm_rw_awards')->where('id', $id)->first();
        abort_if(!$a, 404, 'Không tìm thấy đề xuất.');

        $u = $r->user();
        if ($a->status !== 'pending') {
            return response()->json(['message' => 'Chỉ rút lại được đề xuất đang chờ duyệt.'], 409);
        }
        if (!EmulationAccess::can($u, 'review') && (int) $a->proposed_by !== (int) $u->id) {
            return response()->json(['message' => 'Bạn chỉ được rút đề xuất do chính mình tạo.'], 403);
        }

        DB::table('sm_rw_awards')->where('id', $id)->delete();
        EmulationLogger::log($u, $this->act($a->kind, 'award'), 'Rút đề xuất: ' . $a->title);
        return response()->json(['message' => 'Đã rút đề xuất.']);
    }
}
