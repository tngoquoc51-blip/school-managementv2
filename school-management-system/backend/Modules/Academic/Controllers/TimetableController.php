<?php

namespace Modules\Academic\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Academic\Services\TimetableService;

class TimetableController extends Controller
{
    use ApiResponse;

    public function __construct(private TimetableService $service) {}

    /** GET /api/v1/academic/timetable/class/{classId} */
    public function byClass(Request $request, int $classId)
    {
        $data = $this->service->forClass(
            $classId,
            $request->query('year'),
            $request->query('semester') ? (int) $request->query('semester') : null
        );

        return $this->success($data);
    }

    /** GET /api/v1/academic/timetable/me */
    public function me(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Chưa đăng nhập', 401);
        }

        $data = $this->service->forStudent(
            (int) $user->id,
            $request->query('year'),
            $request->query('semester') ? (int) $request->query('semester') : null
        );

        return $this->success($data);
    }

    /** GET /api/v1/academic/timetable/student/{userId} */
    public function byStudent(Request $request, int $userId)
    {
        $data = $this->service->forStudent(
            $userId,
            $request->query('year'),
            $request->query('semester') ? (int) $request->query('semester') : null
        );

        return $this->success($data);
    }

    /** POST /api/v1/academic/timetable */
    public function store(Request $request)
    {
        $data = $request->validate([
            'class_id'       => 'required|integer',
            'subject_id'     => 'required|integer',
            'teacher_name'   => 'required|string|max:150',
            'teacher_id'     => 'nullable|integer',
            'day_of_week'    => 'required|integer|min:1|max:6',
            'period'         => 'required|integer|min:1|max:10',
            'room'           => 'nullable|string|max:50',
            'academic_year'  => 'nullable|string|max:20',
            'semester'       => 'nullable|integer|min:1|max:2',
            'note'           => 'nullable|string|max:255',
        ]);

        $slot = $this->service->upsert($data);

        return $this->success($slot->load('subject'), 'Đã lưu thời khóa biểu', 201);
    }

    /** DELETE /api/v1/academic/timetable/{id} */
    public function destroy(int $id)
    {
        $this->service->destroy($id);

        return $this->success(null, 'Đã xóa ô lịch');
    }
}
