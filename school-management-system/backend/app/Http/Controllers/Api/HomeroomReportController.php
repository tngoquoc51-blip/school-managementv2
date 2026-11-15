<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HomeroomReport;
use Illuminate\Http\Request;

class HomeroomReportController extends Controller
{
    public function index(Request $request)
    {
        $query = HomeroomReport::where('teacher_id', auth()->id());

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('report_type')) {
            $query->where('report_type', $request->report_type);
        }

        $reports = $query->orderByDesc('created_at')->paginate($request->get('per_page', 20));

        return response()->json($reports);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'class_id'      => 'required|integer',
            'report_type'   => 'required|in:weekly,monthly,semester,yearly,custom',
            'title'         => 'required|string|max:255',
            'period_start'  => 'nullable|date',
            'period_end'    => 'nullable|date',
            'content'       => 'nullable|string',
            'academic_year' => 'nullable|string|max:20',
            'semester'      => 'nullable|integer|in:1,2',
            'summary_json'  => 'nullable|array',
        ]);

        $data['teacher_id'] = auth()->id();
        $data['status'] = 'draft';

        $report = HomeroomReport::create($data);

        return response()->json(['data' => $report, 'message' => 'Tạo báo cáo thành công'], 201);
    }

    public function show($id)
    {
        $report = HomeroomReport::where('teacher_id', auth()->id())
            ->with('sections')
            ->findOrFail($id);

        return response()->json(['data' => $report]);
    }

    public function update(Request $request, $id)
    {
        $report = HomeroomReport::where('teacher_id', auth()->id())->findOrFail($id);

        if ($report->status !== 'draft') {
            return response()->json(['message' => 'Chỉ được sửa báo cáo ở trạng thái nháp'], 403);
        }

        $data = $request->validate([
            'title'         => 'sometimes|string|max:255',
            'period_start'  => 'nullable|date',
            'period_end'    => 'nullable|date',
            'content'       => 'nullable|string',
            'summary_json'  => 'nullable|array',
        ]);

        $report->update($data);

        return response()->json(['data' => $report, 'message' => 'Cập nhật thành công']);
    }

    public function submit($id)
    {
        $report = HomeroomReport::where('teacher_id', auth()->id())->findOrFail($id);

        if ($report->status !== 'draft') {
            return response()->json(['message' => 'Báo cáo đã được gửi trước đó'], 400);
        }

        $report->update([
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);

        return response()->json(['data' => $report, 'message' => 'Đã gửi báo cáo thành công']);
    }

    public function smartAlerts()
    {
        // TODO: Viết logic thật lấy từ bảng điểm / điểm danh / vi phạm
        // Hiện tại trả mock để frontend chạy được
        $alerts = [
            [
                'student_id' => 12,
                'student_name' => 'Nguyễn Văn An',
                'type' => 'academic',
                'message' => 'Điểm Toán giảm 1.5 điểm so với tháng trước',
                'level' => 'warning',
            ],
            [
                'student_id' => 18,
                'student_name' => 'Lê Thị Bình',
                'type' => 'attendance',
                'message' => 'Vắng 4 buổi không phép trong tháng',
                'level' => 'danger',
            ],
        ];

        return response()->json(['data' => $alerts]);
    }

    public function classSummary($classId)
    {
        // TODO: Tính toán thật từ DB
        return response()->json([
            'data' => [
                'total_students' => 42,
                'avg_score' => 7.85,
                'attendance_rate' => 96.2,
                'good_conduct' => 38,
                'violations' => 3,
                'need_attention' => 4,
            ]
        ]);
    }

    public function export($id, $format)
    {
        $report = HomeroomReport::where('teacher_id', auth()->id())->findOrFail($id);

        // TODO: Dùng DomPDF hoặc Maatwebsite/Excel
        return response()->json([
            'message' => "Chức năng xuất {$format} đang được phát triển",
            'report_id' => $report->id,
        ]);
    }
}
