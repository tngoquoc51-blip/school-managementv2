<?php

namespace Modules\Emulation\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Chạy SAU middleware StaffToken của dự án (StaffToken đã xác thực Bearer token
 * và đặt thông tin nhân viên vào $request->attributes['sm_staff']).
 * Ở đây chỉ chuẩn hóa thành "actor" cho module: id, name, role, teacher_id.
 */
class EmulationAuth
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

        $request->attributes->set('emu_actor', [
            'id' => $id ? (int) $id : null,
            'name' => $row->full_name ?? ($staff['full_name'] ?? $staff['name'] ?? 'Giáo viên'),
            'role' => $row->role ?? ($staff['role'] ?? ''),
            'teacher_id' => $teacherId ? (int) $teacherId : null,
        ]);

        return $next($request);
    }
}
