<?php

namespace App\Http\Middleware;

use App\Support\SchoolRepo;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Xác thực học sinh bằng token (header  Authorization: Bearer <token>).
 * Token do POST /api/student/login cấp, lưu dạng băm SHA-256 trong bảng sm_api_tokens.
 * Không phụ thuộc Sanctum/Passport nên không ảnh hưởng hệ thống đăng nhập sẵn có của dự án.
 */
class StudentToken
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        $account = (new SchoolRepo(DB::connection()->getPdo()))->authenticate($token);

        if (!$account) {
            return response()->json(['message' => 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'], 401);
        }

        $request->attributes->set('sm_account', $account);
        $request->attributes->set('sm_token', $token);

        return $next($request);
    }
}
