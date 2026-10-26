<?php

namespace App\Http\Middleware;

use App\Support\FeePeriodRepo;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Xác thực nhân viên khu Kế toán (Kế toán / Hiệu trưởng / Phó hiệu trưởng / Quản trị) bằng Bearer token.
 * Token lấy từ POST /api/kt/login, lưu ở bảng sm_staff_tokens (dùng chung với khu Giáo vụ).
 */
class FeeStaffToken
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        $staff = (new FeePeriodRepo(DB::connection()->getPdo()))->authenticate($token);

        if (!$staff) {
            return response()->json(['message' => 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'], 401);
        }

        $request->attributes->set('kt_staff', $staff);
        $request->attributes->set('kt_token', $token);

        return $next($request);
    }
}
