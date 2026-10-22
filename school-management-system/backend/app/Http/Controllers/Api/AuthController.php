<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $login = trim((string) (
            $request->input('identifier')
            ?? $request->input('login')
            ?? $request->input('email')
            ?? $request->input('username')
            ?? ''
        ));
        $password = (string) $request->input('password', '');

        if ($login === '' || $password === '') {
            return response()->json([
                'success' => false,
                'message' => 'Vui lòng nhập mã đăng nhập và mật khẩu',
            ], 422);
        }

        $user = User::query()
            ->where('username', $login)
            ->orWhere('email', $login)
            ->orWhere('email', $login . '@thpt.edu.vn')
            ->first();

        if (!$user || !Hash::check($password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Mã đăng nhập hoặc mật khẩu không đúng',
            ], 401);
        }

        if (($user->status ?? 'active') !== 'active') {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản đã bị khóa',
            ], 403);
        }

        // Có Laravel Sanctum: dùng token thật
        $token = method_exists($user, 'createToken')
            ? $user->createToken('web')->plainTextToken
            : base64_encode($user->id . '|' . $user->email . '|' . time());

        // Role: nếu chưa có bảng roles → mặc định theo prefix email/username
        $roles = ['student'];
        if (str_starts_with(strtolower($user->username ?? ''), 'hs')
            || str_contains(strtolower($user->email ?? ''), '@student.')
            || preg_match('/^hs\d+/i', $user->username ?? '')
            || preg_match('/^hs\d+/i', $user->email ?? '')) {
            $roles = ['student'];
        }

        return response()->json([
            'success' => true,
            'token'   => $token,
            'user'    => [
                'id'       => $user->id,
                'name'     => $user->name,
                'email'    => $user->email,
                'username' => $user->username,
            ],
            'roles' => $roles,
            'role'  => $roles[0] ?? 'student',
        ]);
    }
}
