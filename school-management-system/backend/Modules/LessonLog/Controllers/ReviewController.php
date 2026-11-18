<?php

namespace Modules\LessonLog\Controllers;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\LessonLog\Services\LogbookService;

/** Ký sổ tuần (GVCN) → Ban Giám hiệu duyệt hoặc trả lại. */
class ReviewController extends Controller
{
    public function __construct(private LogbookService $svc)
    {
    }

    private function monday(Request $r): Carbon
    {
        $d = (string) $r->input('week_start');
        abort_unless(preg_match('/^\d{4}-\d{2}-\d{2}$/', $d), 422, 'Tuần không hợp lệ.');
        $m = $this->svc->monday($d);
        abort_unless($m->toDateString() === $d, 422, 'Ngày bắt đầu tuần phải là thứ hai.');
        return $m;
    }

    private function row(object $c, Carbon $m): object
    {
        $w = $this->svc->weekReview($c->id, $m->toDateString());
        if (!$w) {
            $id = DB::table('sm_ll_weeks')->insertGetId(['school_year_id' => $c->school_year_id, 'class_id' => $c->id, 'week_start' => $m->toDateString(),
                'status' => 'open', 'created_at' => now()->toDateTimeString(), 'updated_at' => now()->toDateTimeString()]);
            $w = DB::table('sm_ll_weeks')->find($id);
        }
        return $w;
    }

    /** Danh sách các tuần của học kỳ kèm trạng thái ký / duyệt */
    public function index(Request $r): JsonResponse
    {
        $c = $this->svc->classOrFail((int) $r->query('class_id'), $r->user());
        $year = $this->svc->year((int) $c->school_year_id);
        $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $r->query('date')) ? $r->query('date') : $this->svc->defaultDate($year);
        $sem = $this->svc->semester($year, $date);
        $first = $this->svc->monday($sem['start']);
        $last = $this->svc->monday(min($date, $sem['end']) > Carbon::today()->toDateString() ? Carbon::today()->toDateString() : min($date, $sem['end']));
        $total = $this->svc->slots($c->id)->count();

        $agg = DB::table('sm_ll_entries')->where('class_id', $c->id)->where('status', 'submitted')->whereBetween('entry_date', [$first->toDateString(), $last->copy()->addDays(5)->toDateString()])
            ->selectRaw("DATE_SUB(entry_date, INTERVAL WEEKDAY(entry_date) DAY) AS wk, COUNT(*) AS n, AVG(CASE rating WHEN 'tot' THEN 4 WHEN 'kha' THEN 3 WHEN 'tb' THEN 2 ELSE 1 END) AS avg")
            ->groupBy('wk')->get()->keyBy('wk');
        $weeks = DB::table('sm_ll_weeks')->where('class_id', $c->id)->get()->keyBy('week_start');

        $out = [];
        for ($w = $last->copy(); $w->gte($first); $w->subWeek()) {
            $k = $w->toDateString();
            $a = $agg->get($k);
            $rv = $weeks->get($k);
            $out[] = [
                'week_start' => $k, 'iso' => $w->isoWeek(), 'label' => 'Tuần ' . $w->isoWeek() . ' (' . $w->format('d/m') . ' – ' . $w->copy()->addDays(5)->format('d/m') . ')',
                'total' => $total, 'filled' => $a ? (int) $a->n : 0, 'rate' => $total ? round(($a ? (int) $a->n : 0) / $total * 100) : null,
                'avg_rating' => $a ? round((float) $a->avg, 2) : null, 'status' => $rv->status ?? 'open', 'homeroom_comment' => $rv->homeroom_comment ?? null,
                'signed_by_name' => $rv->signed_by_name ?? null, 'signed_at' => $rv->signed_at ?? null, 'bgh_note' => $rv->bgh_note ?? null, 'bgh_by_name' => $rv->bgh_by_name ?? null,
            ];
        }
        return response()->json(['semester' => $sem, 'data' => $out]);
    }

    /** GVCN ký tuần */
    public function sign(Request $r): JsonResponse
    {
        $u = $r->user();
        $v = $r->validate(['class_id' => 'required|integer|exists:sm_classes,id', 'week_start' => 'required|date_format:Y-m-d', 'comment' => 'nullable|string|max:1500', 'force' => 'nullable|boolean']);
        $c = $this->svc->classOrFail((int) $v['class_id'], $u);
        abort_unless($this->svc->isHomeroom($u, $c), 403, 'Chỉ giáo viên chủ nhiệm của lớp mới được ký sổ tuần.');
        $m = $this->monday($r);
        $w = $this->row($c, $m);
        abort_unless(in_array($w->status, ['open', 'returned'], true), 409, 'Tuần này đã được ký.');

        $st = $this->svc->weekStats($c->id, $m);
        if ($st['missing'] > 0 && empty($v['force'])) {
            return response()->json(['message' => "Còn {$st['missing']} tiết chưa ký sổ. Hãy hoàn thành trước khi ký tuần.", 'missing' => $st['missing']], 409);
        }
        DB::table('sm_ll_weeks')->where('id', $w->id)->update(['status' => 'signed', 'homeroom_comment' => $v['comment'] ?? null,
            'signed_by_name' => $u->name, 'signed_at' => now()->toDateTimeString(), 'updated_at' => now()->toDateTimeString()]);
        $this->svc->log($u, $c->id, 'week_sign', 'GVCN ký sổ tuần ' . $m->isoWeek() . ' gửi Ban Giám hiệu');
        return response()->json(['message' => 'Đã ký sổ tuần ' . $m->isoWeek() . ' và gửi Ban Giám hiệu.']);
    }

    /** GVCN rút lại khi BGH chưa duyệt */
    public function reopen(Request $r): JsonResponse
    {
        $u = $r->user();
        $r->validate(['class_id' => 'required|integer|exists:sm_classes,id', 'week_start' => 'required|date_format:Y-m-d']);
        $c = $this->svc->classOrFail((int) $r->input('class_id'), $u);
        abort_unless($this->svc->isHomeroom($u, $c), 403, 'Chỉ giáo viên chủ nhiệm mới được mở lại sổ tuần.');
        $m = $this->monday($r);
        $n = DB::table('sm_ll_weeks')->where('class_id', $c->id)->where('week_start', $m->toDateString())->where('status', 'signed')
            ->update(['status' => 'open', 'updated_at' => now()->toDateTimeString()]);
        abort_unless($n, 409, 'Chỉ mở lại được tuần đã ký và chưa được Ban Giám hiệu duyệt.');
        $this->svc->log($u, $c->id, 'week_reopen', 'GVCN mở lại sổ tuần ' . $m->isoWeek());
        return response()->json(['message' => 'Đã mở lại sổ tuần để chỉnh sửa.']);
    }

    /** Ban Giám hiệu duyệt / trả lại */
    public function decide(Request $r): JsonResponse
    {
        $u = $r->user();
        $v = $r->validate(['class_id' => 'required|integer|exists:sm_classes,id', 'week_start' => 'required|date_format:Y-m-d', 'decision' => 'required|in:approve,return', 'note' => 'nullable|string|max:500']);
        abort_if($v['decision'] === 'return' && mb_strlen(trim((string) ($v['note'] ?? ''))) < 5, 422, 'Nhập lý do trả lại (tối thiểu 5 ký tự).');
        $c = $this->svc->classOrFail((int) $v['class_id'], $u);
        $m = $this->monday($r);
        $ok = $v['decision'] === 'approve';
        $n = DB::table('sm_ll_weeks')->where('class_id', $c->id)->where('week_start', $m->toDateString())->where('status', 'signed')
            ->update(['status' => $ok ? 'approved' : 'returned', 'bgh_note' => $v['note'] ?? null, 'bgh_by_name' => $u->name, 'bgh_at' => now()->toDateTimeString(), 'updated_at' => now()->toDateTimeString()]);
        abort_unless($n, 409, 'Chỉ xử lý được sổ tuần đã được giáo viên chủ nhiệm ký.');
        $this->svc->log($u, $c->id, $ok ? 'week_approve' : 'week_return', ($ok ? 'BGH duyệt' : 'BGH trả lại') . ' sổ tuần ' . $m->isoWeek() . ' lớp ' . $c->name);
        return response()->json(['message' => $ok ? 'Đã duyệt sổ tuần.' : 'Đã trả lại sổ tuần cho giáo viên chủ nhiệm.']);
    }

    /** Toàn trường theo tuần (chỉ BGH): tiến độ ghi sổ của 18 lớp */
    public function school(Request $r): JsonResponse
    {
        $year = $this->svc->year((int) $r->query('year_id') ?: null);
        abort_if(!$year, 404, 'Chưa có năm học.');
        $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $r->query('date')) ? $r->query('date') : $this->svc->defaultDate($year);
        $m = $this->svc->monday($date);
        $s = $m->toDateString();
        $e = $m->copy()->addDays(5)->toDateString();

        $classes = DB::table('sm_classes as c')->leftJoin('sm_teachers as t', 't.id', '=', 'c.homeroom_teacher_id')->where('c.school_year_id', $year->id)->where('c.status', 'active')
            ->orderBy('c.grade')->orderBy('c.name')->get(['c.id', 'c.name', 'c.grade', 't.full_name as homeroom_name']);
        $filled = DB::table('sm_ll_entries')->where('status', 'submitted')->whereBetween('entry_date', [$s, $e])->selectRaw('class_id, COUNT(*) AS n')->groupBy('class_id')->pluck('n', 'class_id');
        $att = DB::table('sm_att_lessons')->whereBetween('att_date', [$s, $e])->where('status', '<>', 'present')
            ->selectRaw("class_id, COALESCE(SUM(status='unexcused'),0) AS un, COALESCE(SUM(status='excused'),0) AS ex")->groupBy('class_id')->get()->keyBy('class_id');
        $notes = DB::table('sm_ll_notes')->whereBetween('note_date', [$s, $e])
            ->selectRaw("class_id, COALESCE(SUM(kind='praise'),0) AS p, COALESCE(SUM(kind='violation'),0) AS v")->groupBy('class_id')->get()->keyBy('class_id');
        $reviews = DB::table('sm_ll_weeks')->where('week_start', $s)->get()->keyBy('class_id');
        $total = DB::table('sm_timetable')->selectRaw('class_id, COUNT(*) AS n')->groupBy('class_id')->pluck('n', 'class_id');

        $rows = $classes->map(function ($c) use ($filled, $att, $notes, $reviews, $total) {
            $t = (int) ($total[$c->id] ?? 0);
            $f = (int) ($filled[$c->id] ?? 0);
            return ['id' => (int) $c->id, 'name' => $c->name, 'grade' => (int) $c->grade, 'homeroom_name' => $c->homeroom_name, 'total' => $t, 'filled' => $f,
                'rate' => $t ? round($f / $t * 100) : null, 'unexcused' => (int) ($att[$c->id]->un ?? 0), 'excused' => (int) ($att[$c->id]->ex ?? 0),
                'praise' => (int) ($notes[$c->id]->p ?? 0), 'violation' => (int) ($notes[$c->id]->v ?? 0), 'status' => $reviews[$c->id]->status ?? 'open'];
        })->values();

        return response()->json([
            'week' => ['start' => $s, 'end' => $e, 'label' => 'Tuần ' . $m->isoWeek() . ' (' . $m->format('d/m') . ' – ' . Carbon::parse($e)->format('d/m/Y') . ')'],
            'summary' => ['classes' => $rows->count(), 'signed' => $rows->whereIn('status', ['signed', 'approved'])->count(), 'approved' => $rows->where('status', 'approved')->count(),
                'pending' => $rows->where('status', 'signed')->count(), 'avg_rate' => $rows->count() ? round($rows->avg('rate')) : null],
            'data' => $rows,
        ]);
    }
}
