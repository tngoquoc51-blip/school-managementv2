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
        $request->validate([
            'identifier' => 'required|string',
            'password' => 'required|string',
        ]);

        $id = trim($request->identifier);

        $user = User::with('roles')
            ->where('email', $id)
            ->orWhere('username', $id)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Mã đăng nhập hoặc mật khẩu không đúng',
            ], 401);
        }

        if (($user->status ?? 'active') === 'locked') {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản đã bị khóa',
            ], 403);
        }

        if (($user->status ?? 'active') === 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản chưa được kích hoạt',
            ], 403);
        }

        $token = $user->createToken('web')->plainTextToken;
        $roles = $user->roles->pluck('name')->values();

        return response()->json([
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
            ],
            'roles' => $roles,
        ]);
    }
}
