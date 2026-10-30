<?php

namespace Modules\Auth\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Modules\User\Models\User;
use Modules\User\Models\UserLoginHistory;
use Modules\User\Support\ActivityLogger;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)
                    ->orWhere('username', $request->email)
                    ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            // [PROFILE] ghi nhận đăng nhập sai để hiển thị trong "Thiết bị & đăng nhập"
            if ($user) {
                UserLoginHistory::record($user->id, $request, 'failed');
            }

            throw ValidationException::withMessages([
                'email' => ['Thông tin đăng nhập không chính xác.'],
            ]);
        }

        if ($user->status !== 'active') {
            return response()->json(['message' => 'Tài khoản đã bị khóa'], 403);
        }

        $newToken = $user->createToken('auth-token');
        $token = $newToken->plainTextToken;

        // [PROFILE] lưu thiết bị/IP gắn với token + nhật ký hoạt động
        UserLoginHistory::record($user->id, $request, 'success', $newToken->accessToken->id);
        ActivityLogger::log($user->id, 'login', 'Đăng nhập hệ thống', $request);

        // Lấy tất cả vai trò của user
        $roles = $user->getRoleNames(); // Spatie

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar' => $user->avatar,
            ],
            'roles' => $roles,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Đăng xuất thành công']);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'user' => $user,
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ]);
    }
}
