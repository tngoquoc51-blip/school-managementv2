<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Chi cho phep quan tri he thong (dang nhap Sanctum + vai tro trong bang Spatie).
 * Dung cung cach kiem tra voi Modules\Academic\Middleware\AcademicStaff.
 * Dat SAU auth:sanctum.
 */
class AdminAccess
{
    public const ROLES = ['super_admin', 'admin', 'system_admin'];

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
                'message' => 'Chi quan tri he thong moi duoc phep truy cap chuc nang nay.',
            ], 403);
        }

        return $next($request);
    }
}