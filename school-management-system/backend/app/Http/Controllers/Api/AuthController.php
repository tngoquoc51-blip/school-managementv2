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

        $token = method_exists($user, 'createToken')
            ? $user->createToken('web')->plainTextToken
            : base64_encode($user->id . '|' . $user->email . '|' . time());

        // 1) Ưu tiên role Spatie
        $roles = [];
        if (method_exists($user, 'getRoleNames')) {
            try {
                $roles = $user->getRoleNames()->values()->all();
            } catch (\Throwable $e) {
                $roles = [];
            }
        }

        // 2) Fallback theo username / email nếu chưa có Spatie
        if (empty($roles)) {
            $uname = strtolower((string) ($user->username ?? ''));
            $email = strtolower((string) ($user->email ?? ''));

            if (
                str_starts_with($uname, 'hs')
                || preg_match('/^hs\d+/i', $uname)
                || str_contains($email, '@student.')
            ) {
                $roles = ['student'];
            } elseif (
                in_array($uname, ['giaovu', 'academic'], true)
                || str_contains($email, 'giaovu')
                || str_contains($email, 'academic')
            ) {
                $roles = ['academic'];
            } elseif (
                in_array($uname, ['admin', 'superadmin'], true)
                || str_contains($email, 'admin@')
            ) {
                $roles = ['super_admin'];
            } elseif (
                str_starts_with($uname, 'gv')
                || str_contains($email, 'teacher')
                || str_contains($email, '@gv.')
            ) {
                $roles = ['teacher'];
            } elseif (
                str_contains($uname, 'hieutruong')
                || str_contains($uname, 'bgh')
                || str_contains($email, 'hieutruong')
            ) {
                $roles = ['principal'];
            } else {
                $roles = ['student'];
            }
        }

        // 3) Role chính (ưu tiên quyền cao)
        $priority = [
            'super_admin', 'admin', 'principal', 'vice_principal',
            'academic', 'giao_vu', 'teacher', 'homeroom_teacher',
            'accountant', 'parent', 'student',
        ];
                $primary = $roles[0] ?? 'student';
                foreach ($priority as $r) {
                    if (in_array($r, $roles, true)) {
                        $primary = $r;
                        break;
                    }
                }

                // ===== THÊM MỚI: cảnh báo đăng nhập cho tài khoản quản trị / BGH =====
                if (array_intersect($roles, ['super_admin', 'admin', 'principal', 'vice_principal'])) {
                    try {
                        \App\Support\AdminNotifier::loginAlert($user, $request);
                    } catch (\Throwable $e) {
                        // Lỗi thông báo không được làm hỏng đăng nhập
                    }
                }
                // =====================================================================

                return response()->json([
                    'success' => true,
                    'token'   => $token,
            'user'    => [
                'id'       => $user->id,
                'name'     => $user->name,
                'email'    => $user->email,
                'username' => $user->username,
            ],
            'roles' => array_values($roles),
            'role'  => $primary,
        ]);
    }
}
