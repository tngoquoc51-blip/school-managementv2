<?php

namespace Modules\LessonLog\Controllers;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\LessonLog\Services\LogbookService;

/**
 * Sổ theo dõi nề nếp: khen / vi phạm / ghi chú của lớp.
 * Liên kết:  → Thi đua (sm_rw_records, tự cộng / trừ điểm lớp)
 *            → Khen thưởng & Kỷ luật (sm_rw_awards, đề xuất chờ BGH duyệt; hộp Phê duyệt tự gom)
 */
class NoteController extends Controller
{
    public function __construct(private LogbookService $svc)
    {
    }

    public function index(Request $r): JsonResponse
    {
        $c = $this->svc->classOrFail((int) $r->query('class_id'), $r->user());
        $q = DB::table('sm_ll_notes as n')->leftJoin('sm_students as s', 's.id', '=', 'n.student_id')->where('n.class_id', $c->id);
        if (in_array($r->query('kind'), ['praise', 'violation', 'note'], true)) {
            $q->where('n.kind', $r->query('kind'));
        }
        if ($r->filled('student_id')) {
            $q->where('n.student_id', (int) $r->query('student_id'));
        }
        $ok = fn ($d) => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d);
        if ($ok($r->query('from'))) {
            $q->where('n.note_date', '>=', $r->query('from'));
        }
        if ($ok($r->query('to'))) {
            $q->where('n.note_date', '<=', $r->query('to'));
        }
        $rows = $q->orderByDesc('n.note_date')->orderByDesc('n.id')->limit(300)
            ->get(['n.id', 'n.note_date', 'n.period', 'n.kind', 'n.content', 'n.student_id', 's.full_name as student_name', 's.code as student_code',
                'n.emu_record_id', 'n.award_id', 'n.created_by_name', 'n.created_at']);
        return response()->json(['data' => $rows]);
    }

    public function store(Request $r): JsonResponse
    {
        $u = $r->user();
        abort_if($u->is_bgh, 403, 'Ban Giám hiệu chỉ xem sổ, không ghi thay giáo viên.');
        $v = $r->validate([
            'class_id' => 'required|integer|exists:sm_classes,id', 'student_id' => 'nullable|integer|exists:sm_students,id',
            'note_date' => 'required|date_format:Y-m-d|before_or_equal:today', 'period' => 'nullable|integer|min:1|max:9',
            'kind' => 'required|in:praise,violation,note', 'content' => 'required|string|min:3|max:500',
            'criteria_id' => 'nullable|integer|exists:sm_rw_criteria,id', 'points' => 'nullable|numeric|min:0.5|max:50', 'propose' => 'nullable|boolean',
        ], ['content.required' => 'Nhập nội dung ghi chú.', 'content.min' => 'Nội dung ghi chú quá ngắn.']);

        $c = $this->svc->classOrFail((int) $v['class_id'], $u);
        abort_unless($this->svc->isHomeroom($u, $c) || DB::table('sm_class_subjects')->where('class_id', $c->id)->where('teacher_id', $u->teacher_id)->exists(), 403, 'Bạn không có quyền ghi chú cho lớp này.');

        $student = null;
        if (!empty($v['student_id'])) {
            $student = DB::table('sm_enrollments as e')->join('sm_students as s', 's.id', '=', 'e.student_id')
                ->where('e.class_id', $c->id)->where('e.student_id', $v['student_id'])->first(['s.id', 's.full_name']);
            abort_unless($student, 422, 'Học sinh này không thuộc lớp đang chọn.');
        }

        $noteId = DB::transaction(function () use ($v, $c, $u, $student, &$emuMsg, &$awardMsg) {
            $now = now()->toDateTimeString();
            $emuId = null;
            $awardId = null;

            // → Thi đua: ghi điểm cộng / trừ cho lớp
            if (!empty($v['criteria_id']) && Schema::hasTable('sm_rw_records')) {
                $k = DB::table('sm_rw_criteria')->find($v['criteria_id']);
                $pts = abs((float) ($v['points'] ?? $k->default_points)) * ($k->type === 'minus' ? -1 : 1);
                $emuId = DB::table('sm_rw_records')->insertGetId([
                    'school_year_id' => $c->school_year_id, 'class_id' => $c->id, 'criteria_id' => $k->id, 'points' => $pts, 'record_date' => $v['note_date'],
                    'note' => mb_substr(($student ? $student->full_name . ': ' : '') . $v['content'], 0, 255), 'source' => 'lessonlog',
                    'recorded_by' => $u->id, 'recorded_by_name' => $u->name, 'created_at' => $now,
                ]);
                $emuMsg = ($pts > 0 ? '+' : '') . rtrim(rtrim(number_format($pts, 1, '.', ''), '0'), '.') . ' điểm thi đua cho lớp ' . $c->name;
            }

            // → Khen thưởng / Kỷ luật: đề xuất chờ Ban Giám hiệu duyệt
            if (!empty($v['propose']) && $v['kind'] !== 'note' && Schema::hasTable('sm_rw_awards')) {
                $praise = $v['kind'] === 'praise';
                $awardId = DB::table('sm_rw_awards')->insertGetId([
                    'school_year_id' => $c->school_year_id, 'target_type' => $student ? 'student' : 'class', 'class_id' => $c->id, 'student_id' => $student->id ?? null,
                    'kind' => $praise ? 'khen_thuong' : 'nhac_nho', 'title' => ($praise ? 'Biểu dương: ' : 'Nhắc nhở: ') . ($student->full_name ?? ('Lớp ' . $c->name)),
                    'reason' => $v['content'], 'level' => 'Lớp', 'period_label' => 'Ngày ' . Carbon::parse($v['note_date'])->format('d/m/Y'),
                    'status' => 'pending', 'proposed_by' => $u->id, 'proposed_by_name' => $u->name . ' (GVCN – Sổ đầu bài)', 'created_at' => $now, 'updated_at' => $now,
                ]);
                $awardMsg = 'Đã gửi đề xuất ' . ($praise ? 'khen thưởng' : 'nhắc nhở') . ' tới Ban Giám hiệu';
            }

            return DB::table('sm_ll_notes')->insertGetId([
                'school_year_id' => $c->school_year_id, 'class_id' => $c->id, 'student_id' => $student->id ?? null, 'note_date' => $v['note_date'], 'period' => $v['period'] ?? null,
                'kind' => $v['kind'], 'content' => $v['content'], 'emu_record_id' => $emuId, 'award_id' => $awardId,
                'created_by' => $u->id, 'created_by_name' => $u->name, 'created_at' => $now,
            ]);
        });

        $this->svc->log($u, $c->id, 'note', ['praise' => 'Biểu dương', 'violation' => 'Ghi vi phạm', 'note' => 'Ghi chú'][$v['kind']] . ': ' . ($student->full_name ?? 'cả lớp'));
        $extra = array_values(array_filter([$emuMsg ?? null, $awardMsg ?? null]));
        return response()->json(['message' => 'Đã ghi vào sổ theo dõi.' . ($extra ? ' ' . implode('. ', $extra) . '.' : ''), 'id' => $noteId, 'links' => $extra], 201);
    }

    public function destroy(Request $r, int $id): JsonResponse
    {
        $u = $r->user();
        $n = DB::table('sm_ll_notes')->find($id);
        abort_unless($n, 404, 'Không tìm thấy ghi chú.');
        $c = $this->svc->classOrFail((int) $n->class_id, $u);
        abort_unless(!$u->is_bgh && ($this->svc->isHomeroom($u, $c) || (int) $n->created_by === (int) $u->id), 403, 'Bạn không có quyền xóa ghi chú này.');
        DB::transaction(function () use ($n, $id) {
            if ($n->emu_record_id) {
                DB::table('sm_rw_records')->where('id', $n->emu_record_id)->where('source', 'lessonlog')->delete();
            }
            if ($n->award_id) {
                DB::table('sm_rw_awards')->where('id', $n->award_id)->where('status', 'pending')->delete();
            }
            DB::table('sm_ll_notes')->where('id', $id)->delete();
        });
        $this->svc->log($u, $c->id, 'delete', 'Xóa ghi chú nề nếp ngày ' . Carbon::parse($n->note_date)->format('d/m'));
        return response()->json(['message' => 'Đã xóa ghi chú' . ($n->emu_record_id ? ' và điểm thi đua kèm theo' : '') . '.']);
    }
}
