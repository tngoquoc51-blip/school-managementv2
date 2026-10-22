<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class GvAuthController extends Controller
{
    private array $allowed = ['academic', 'super_admin', 'principal', 'vice_principal'];

    private array $labels = [
        'academic' => 'Giáo vụ',
        'super_admin' => 'Quản trị',
        'principal' => 'Hiệu trưởng',
        'vice_principal' => 'Phó hiệu trưởng',
    ];

    /** POST /api/gv/login */
    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $id = trim($request->username);

        $user = User::with('roles')
            ->where('username', $id)
            ->orWhere('email', $id)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Sai tên đăng nhập hoặc mật khẩu.'], 401);
        }

        if (($user->status ?? 'active') === 'locked') {
            return response()->json(['message' => 'Tài khoản đã bị khóa.'], 403);
        }

        $roles = $user->roles->pluck('name')->all();
        $role = collect($roles)->first(fn ($r) => in_array($r, $this->allowed, true));

        if (!$role) {
            return response()->json(['message' => 'Tài khoản không có quyền Giáo vụ.'], 403);
        }

        $token = $user->createToken('gv-web')->plainTextToken;

        return response()->json([
            'data' => [
                'token' => $token,
                'staff' => [
                    'id' => $user->id,
                    'username' => $user->username ?? $user->email,
                    'name' => $user->name,
                    'role' => $role,
                    'role_label' => $this->labels[$role] ?? $role,
                ],
            ],
        ]);
    }

    /** GET /api/gv/me */
    public function me(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Chưa đăng nhập'], 401);
        }
        $user->load('roles');
        $roles = $user->roles->pluck('name')->all();
        $role = collect($roles)->first(fn ($r) => in_array($r, $this->allowed, true)) ?? ($roles[0] ?? 'academic');

        return response()->json([
            'data' => [
                'id' => $user->id,
                'username' => $user->username ?? $user->email,
                'name' => $user->name,
                'role' => $role,
                'role_label' => $this->labels[$role] ?? $role,
            ],
        ]);
    }
}
