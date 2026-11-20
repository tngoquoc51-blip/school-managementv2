<?php

namespace Modules\Auth\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Modules\Setting\Services\SettingService;
use Modules\User\Models\User;
use Modules\User\Models\UserLoginHistory;
use Modules\User\Support\ActivityLogger;

class AuthController extends Controller
{
    public function login(Request $request, SettingService $set)
    {
        $request->validate([
            'email' => 'required|string',
            'password' => 'required|string',
        ]);

        // [CÀI ĐẶT HỆ THỐNG > Bảo mật] khóa tạm khi sai quá số lần cho phép
        $max  = (int) $set->get('security', 'max_login_attempts', 5);
        $lock = (int) $set->get('security', 'lockout_minutes', 15);
        $key  = 'login_fail:' . sha1(mb_strtolower(trim($request->email)) . '|' . $request->ip());

        if ((int) Cache::get($key, 0) >= $max) {
            return response()->json(['message' => "Sai quá $max lần. Tài khoản bị khóa tạm thời $lock phút."], 429);
        }

        $user = User::where('email', $request->email)
                    ->orWhere('username', $request->email)
                    ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            Cache::put($key, (int) Cache::get($key, 0) + 1, now()->addMinutes($lock));

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

        Cache::forget($key);

        // [CÀI ĐẶT HỆ THỐNG > Bảo mật] thời hạn phiên đăng nhập (phút)
        $minutes = (int) $set->get('security', 'session_timeout_minutes', 480);
        $newToken = $user->createToken('auth-token', ['*'], now()->addMinutes($minutes));
        $token = $newToken->plainTextToken;

        // [PROFILE] lưu thiết bị/IP gắn với token + nhật ký hoạt động
        UserLoginHistory::record($user->id, $request, 'success', $newToken->accessToken->id);
        ActivityLogger::log($user->id, 'login', 'Đăng nhập hệ thống', $request);

        // Lấy tất cả vai trò của user
        $roles = $user->getRoleNames(); // Spatie

        return response()->json([
            'token' => $token,
            'expires_in_minutes' => $minutes,
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
