<?php

namespace App\Http\Controllers\Api\Homeroom;

use App\Http\Controllers\Controller;
use App\Models\AwardPeriod;
use App\Models\AwardTitle;
use App\Models\AwardProposal;
use Illuminate\Http\Request;

class AwardController extends Controller
{
    // Lấy danh sách đợt thi đua
    public function periods()
    {
        $periods = AwardPeriod::where('status', 'open')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $periods
        ]);
    }

    // Lấy danh sách danh hiệu
    public function titles()
    {
        $titles = AwardTitle::where('is_active', 1)->get();

        return response()->json([
            'success' => true,
            'data' => $titles
        ]);
    }

    // Lấy danh sách đề xuất + thống kê
    public function proposals(Request $request)
    {
        $query = AwardProposal::with(['period', 'title'])
            ->whereNull('deleted_at');

        // Lọc theo lớp
        if ($request->class_id) {
            $query->where('class_id', $request->class_id);
        }

        // Lọc theo đợt
        if ($request->period_id) {
            $query->where('period_id', $request->period_id);
        }

        // Lọc theo trạng thái
        if ($request->status && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Lọc theo loại danh hiệu
        if ($request->title_id) {
            $query->where('title_id', $request->title_id);
        }

        // Tìm kiếm
        if ($request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('student_name', 'like', "%{$search}%")
                  ->orWhere('student_code', 'like', "%{$search}%");
            });
        }

        $proposals = $query->orderByDesc('created_at')->get();

        // Thống kê
        $statsQuery = AwardProposal::whereNull('deleted_at');
        if ($request->class_id) {
            $statsQuery->where('class_id', $request->class_id);
        }
        if ($request->period_id) {
            $statsQuery->where('period_id', $request->period_id);
        }

        $stats = [
            'total'     => (clone $statsQuery)->count(),
            'draft'     => (clone $statsQuery)->where('status', 'draft')->count(),
            'submitted' => (clone $statsQuery)->where('status', 'submitted')->count(),
            'approved'  => (clone $statsQuery)->where('status', 'approved')->count(),
            'rejected'  => (clone $statsQuery)->where('status', 'rejected')->count(),
            'returned'  => (clone $statsQuery)->where('status', 'returned')->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $proposals,
            'stats' => $stats
        ]);
    }

    // Tạo đề xuất mới
    public function store(Request $request)
    {
        $data = $request->validate([
            'period_id'     => 'required|exists:award_periods,id',
            'class_id'      => 'required',
            'student_id'    => 'required',
            'student_code'  => 'nullable|string',
            'student_name'  => 'required|string',
            'title_id'      => 'required|exists:award_titles,id',
            'reason'        => 'nullable|string',
            'status'        => 'in:draft,submitted',
        ]);

        $data['proposed_by'] = auth()->id() ?? 2;
        $data['status'] = $data['status'] ?? 'draft';

        $proposal = AwardProposal::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Tạo đề xuất thành công',
            'data' => $proposal->load(['period', 'title'])
        ], 201);
    }

    // Cập nhật đề xuất
    public function update(Request $request, $id)
    {
        $proposal = AwardProposal::findOrFail($id);

        $data = $request->validate([
            'title_id' => 'sometimes|exists:award_titles,id',
            'reason'   => 'nullable|string',
            'status'   => 'sometimes|in:draft,submitted,approved,rejected,returned',
            'review_note' => 'nullable|string',
        ]);

        if (isset($data['status']) && in_array($data['status'], ['approved', 'rejected', 'returned'])) {
            $data['reviewed_by'] = auth()->id();
            $data['reviewed_at'] = now();
        }

        $proposal->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật thành công',
            'data' => $proposal->fresh(['period', 'title'])
        ]);
    }

    // Gửi duyệt
    public function submit($id)
    {
        $proposal = AwardProposal::findOrFail($id);
        $proposal->update(['status' => 'submitted']);

        return response()->json([
            'success' => true,
            'message' => 'Đã gửi duyệt',
            'data' => $proposal
        ]);
    }

    // Xóa đề xuất
    public function destroy($id)
    {
        $proposal = AwardProposal::findOrFail($id);
        $proposal->delete();

        return response()->json([
            'success' => true,
            'message' => 'Đã xóa đề xuất'
        ]);
    }
}
