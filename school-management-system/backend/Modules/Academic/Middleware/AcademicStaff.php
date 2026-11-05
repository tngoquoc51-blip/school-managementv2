<?php

namespace Modules\Academic\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Chỉ cho phép super_admin / principal / vice_principal / academic quản lý lớp học. */
class AcademicStaff
{
    public const ROLES = ['super_admin', 'principal', 'vice_principal', 'academic'];

    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        $allowed = $user && DB::table('model_has_roles as mr')
            ->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->where('mr.model_id', $user->id)
            ->whereIn('r.name', self::ROLES)
            ->exists();

        if (! $allowed) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền truy cập chức năng quản lý lớp học.',
                'errors'  => null,
            ], 403);
        }

        return $next($request);
    }
}
