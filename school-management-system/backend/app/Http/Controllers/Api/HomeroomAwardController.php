<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class HomeroomAwardController extends Controller
{
    private function uid(Request $r): int
    {
        return (int) ($r->user()?->id
            ?? $r->attributes->get('staff_id')
            ?? $r->attributes->get('user_id')
            ?? 0);
    }

    private function classOfTeacher(int $userId): ?object
    {
        if ($userId > 0 && Schema::hasTable('sm_class_teachers')) {
            $row = DB::table('sm_class_teachers as ct')
                ->join('sm_classes as c', 'c.id', '=', 'ct.class_id')
                ->where('ct.user_id', $userId)
                ->where(function ($q) {
                    $q->where('ct.is_homeroom', 1)->orWhere('ct.role', 'homeroom');
                })
                ->select('c.id', 'c.name', 'c.grade')
                ->orderByDesc('ct.id')
                ->first();
            if ($row) {
                return $row;
            }
        }
        if ($userId > 0 && Schema::hasTable('classes') && Schema::hasColumn('classes', 'homeroom_user_id')) {
            $row = DB::table('classes')->where('homeroom_user_id', $userId)
                ->select('id', 'name', 'grade')->first();
            if ($row) {
                return $row;
            }
        }
        // Dev fallback: lấy lớp đầu tiên để UI vẫn chạy khi chưa map GVCN
        if (Schema::hasTable('sm_classes')) {
            return DB::table('sm_classes')->orderBy('id')->select('id', 'name', 'grade')->first();
        }
        if (Schema::hasTable('classes')) {
            return DB::table('classes')->orderBy('id')->select('id', 'name', 'grade')->first();
        }
        return null;
    }

    public function overview(Request $r)
    {
        $cls = $this->classOfTeacher($this->uid($r));
        if (!$cls) {
            return response()->json(['success' => false, 'message' => 'Chưa gán lớp chủ nhiệm'], 422);
        }
        $period = DB::table('sm_award_periods')->where('status', 'open')->orderByDesc('id')->first();
        $q = DB::table('sm_award_nominations')->where('class_id', $cls->id);
        if ($period) {
            $q->where('period_id', $period->id);
        }
        $by = (clone $q)->select('status', DB::raw('COUNT(*) as c'))->groupBy('status')->pluck('c', 'status');

        return response()->json([
            'success' => true,
            'data' => [
                'class' => ['id' => $cls->id, 'name' => $cls->name, 'grade' => $cls->grade ?? null],
                'period' => $period,
                'kpi' => [
                    'draft' => (int) ($by['draft'] ?? 0),
                    'submitted' => (int) ($by['submitted'] ?? 0),
                    'approved' => (int) ($by['approved'] ?? 0),
                    'rejected' => (int) (($by['rejected'] ?? 0) + ($by['returned'] ?? 0)),
                    'total' => (int) array_sum($by->toArray()),
                ],
            ],
        ]);
    }

    public function types()
    {
        return response()->json([
            'success' => true,
            'data' => DB::table('sm_award_types')->where('is_active', 1)->orderBy('sort_order')->get(),
        ]);
    }

    public function periods()
    {
        return response()->json([
            'success' => true,
            'data' => DB::table('sm_award_periods')->orderByDesc('id')->limit(30)->get(),
        ]);
    }

    public function students(Request $r)
    {
        $cls = $this->classOfTeacher($this->uid($r));
        if (!$cls) {
            return response()->json(['success' => false, 'message' => 'Chưa gán lớp'], 422);
        }
        $q = trim((string) $r->query('q', ''));

        // 1) students.class_id
        $sql = DB::table('students as s')
            ->where('s.class_id', $cls->id)
            ->where(function ($w) {
                $w->where('s.status', 'active')->orWhereNull('s.status');
            })
            ->select('s.id', 's.code', 's.full_name as name')
            ->orderBy('s.full_name');

        if ($q !== '') {
            $sql->where(function ($w) use ($q) {
                $w->where('s.full_name', 'like', "%{$q}%")
                  ->orWhere('s.code', 'like', "%{$q}%");
            });
        }

        $list = $sql->limit(100)->get();

        // 2) Fallback: class_students.user_id → students.user_id
        if ($list->isEmpty() && Schema::hasTable('class_students')) {
            $sql2 = DB::table('class_students as cs')
                ->join('students as s', 's.user_id', '=', 'cs.user_id')
                ->where('cs.class_id', $cls->id)
                ->where('cs.is_current', 1)
                ->whereNull('cs.deleted_at')
                ->select('s.id', 's.code', 's.full_name as name')
                ->orderBy('s.full_name');
            if ($q !== '') {
                $sql2->where(function ($w) use ($q) {
                    $w->where('s.full_name', 'like', "%{$q}%")
                      ->orWhere('s.code', 'like', "%{$q}%");
                });
            }
            $list = $sql2->limit(100)->get();
        }

        return response()->json(['success' => true, 'data' => $list]);
    }

    public function index(Request $r)
    {
        $cls = $this->classOfTeacher($this->uid($r));
        if (!$cls) {
            return response()->json(['success' => false, 'message' => 'Chưa gán lớp'], 422);
        }

        $q = DB::table('sm_award_nominations as n')
            ->leftJoin('sm_award_types as t', 't.id', '=', 'n.type_id')
            ->leftJoin('sm_award_periods as p', 'p.id', '=', 'n.period_id')
            // Ưu tiên bảng students (đúng schema máy bạn)
            ->leftJoin('students as st', 'st.id', '=', 'n.student_id')
            ->leftJoin('sm_students as ss', 'ss.id', '=', 'n.student_id')
            ->leftJoin('users as u', 'u.id', '=', 'n.student_id')
            ->where('n.class_id', $cls->id)
            ->select([
                'n.*',
                't.code as type_code',
                't.name as type_name',
                't.group_code',
                'p.name as period_name',
                DB::raw("COALESCE(st.code, ss.code, u.username, CONCAT('HS', n.student_id)) as student_code"),
                DB::raw("COALESCE(st.full_name, ss.full_name, u.name, CONCAT('Học sinh #', n.student_id)) as student_name"),
            ])
            ->orderByDesc('n.updated_at');

        if ($pid = (int) $r->query('period_id', 0)) {
            $q->where('n.period_id', $pid);
        }
        if ($st = $r->query('status')) {
            $q->where('n.status', $st);
        }
        if ($tid = (int) $r->query('type_id', 0)) {
            $q->where('n.type_id', $tid);
        }

        return response()->json(['success' => true, 'data' => $q->get()]);
    }

    public function store(Request $r)
    {
        $uid = $this->uid($r);
        $cls = $this->classOfTeacher($uid);
        if (!$cls) {
            return response()->json(['success' => false, 'message' => 'Chưa gán lớp'], 422);
        }

        $data = $r->validate([
            'period_id' => 'required|integer',
            'type_id' => 'required|integer',
            'student_id' => 'required|integer',
            'score' => 'nullable|numeric|min:0|max:10',
            'reason' => 'nullable|string|max:2000',
            'evidence' => 'nullable|string|max:2000',
            'submit' => 'nullable|boolean',
        ]);

        $now = now();
        $status = !empty($data['submit']) ? 'submitted' : 'draft';
        $id = DB::table('sm_award_nominations')->insertGetId([
            'period_id' => $data['period_id'],
            'type_id' => $data['type_id'],
            'class_id' => $cls->id,
            'student_id' => $data['student_id'],
            'nominated_by' => $uid ?: 0,
            'score' => $data['score'] ?? null,
            'reason' => $data['reason'] ?? null,
            'evidence' => $data['evidence'] ?? null,
            'status' => $status,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json(['success' => true, 'data' => ['id' => $id, 'status' => $status]]);
    }

    public function submit(Request $r, int $id)
    {
        $uid = $this->uid($r);
        $row = DB::table('sm_award_nominations')->where('id', $id)->first();
        if (!$row) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy'], 404);
        }
        if ($uid && (int) $row->nominated_by !== $uid && (int) $row->nominated_by !== 0) {
            return response()->json(['success' => false, 'message' => 'Không có quyền'], 403);
        }
        if (!in_array($row->status, ['draft', 'returned'], true)) {
            return response()->json(['success' => false, 'message' => 'Không thể gửi'], 422);
        }
        DB::table('sm_award_nominations')->where('id', $id)->update(['status' => 'submitted', 'updated_at' => now()]);
        return response()->json(['success' => true]);
    }

    public function destroy(Request $r, int $id)
    {
        $uid = $this->uid($r);
        $row = DB::table('sm_award_nominations')->where('id', $id)->first();
        if (!$row) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy'], 404);
        }
        if ($row->status !== 'draft') {
            return response()->json(['success' => false, 'message' => 'Chỉ xóa bản nháp'], 422);
        }
        if ($uid && (int) $row->nominated_by !== $uid && (int) $row->nominated_by !== 0) {
            return response()->json(['success' => false, 'message' => 'Không có quyền'], 403);
        }
        DB::table('sm_award_nominations')->where('id', $id)->delete();
        return response()->json(['success' => true]);
    }
}
