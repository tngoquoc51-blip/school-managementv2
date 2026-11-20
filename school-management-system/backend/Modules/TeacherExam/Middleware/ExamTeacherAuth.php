<?php

namespace Modules\TeacherExam\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Chạy SAU StaffToken (đã đặt $request->attributes['sm_staff']).
 * Chuẩn hóa thành "exam_actor": id, name, role, teacher_id.
 */
class ExamTeacherAuth
{
    public function handle(Request $request, Closure $next)
    {
        $staff = $request->attributes->get('sm_staff');
        if (! $staff) {
            return response()->json(['success' => false, 'message' => 'Chưa đăng nhập.'], 401);
        }
        $staff = (array) $staff;
        $id = $staff['id'] ?? null;
        $row = $id ? DB::table('sm_staff_accounts')->where('id', $id)->first(['id', 'full_name', 'role', 'teacher_id']) : null;
        $teacherId = $row->teacher_id ?? ($staff['teacher_id'] ?? null);

        $request->attributes->set('exam_actor', [
            'id' => $id ? (int) $id : null,
            'name' => $row->full_name ?? ($staff['full_name'] ?? $staff['name'] ?? 'Giáo viên'),
            'role' => $row->role ?? ($staff['role'] ?? ''),
            'teacher_id' => $teacherId ? (int) $teacherId : null,
        ]);

        return $next($request);
    }
}
