<?php

namespace App\Http\Middleware;

use App\Support\AcademicRepo;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Xác thực nhân viên nhà trường (Giáo vụ / Hiệu trưởng / Phó HT / Quản trị) bằng Bearer token.
 * Dùng:  StaffToken::class  (mọi vai trò được phép, xem AcademicRepo::ROLES)
 */
class StaffToken
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        $staff = (new AcademicRepo(DB::connection()->getPdo()))->authenticate($token);

        if (!$staff) {
            return response()->json(['message' => 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'], 401);
        }

        $request->attributes->set('sm_staff', $staff);
        $request->attributes->set('sm_staff_token', $token);

        return $next($request);
    }
}
