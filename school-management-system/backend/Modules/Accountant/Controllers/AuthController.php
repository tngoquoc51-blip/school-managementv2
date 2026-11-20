<?php

namespace Modules\Accountant\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Modules\Accountant\Middleware\StaffTokenAuth;

class AuthController extends BaseController
{
    private const MAX_FAILED = 5;
    private const LOCK_MINUTES = 15;
    private const TOKEN_HOURS = 12;

    public function login(Request $request)
    {
        $data = $this->validated($request, [
            'username' => 'required|string|max:50',
            'password' => 'required|string|max:100',
        ]);

        $acc = DB::table('sm_staff_accounts')->where('username', trim($data['username']))->first();
        $now = now();

        if (! $acc || $acc->status !== 'active') {
            return $this->fail('Sai tài khoản hoặc mật khẩu.', 401);
        }
        if ($acc->locked_until && $acc->locked_until > $now->format('Y-m-d H:i:s')) {
            return $this->fail('Tài khoản đang bị khóa tạm thời do nhập sai nhiều lần. Vui lòng thử lại sau.', 423);
        }
        if (! Hash::check($data['password'], $acc->password_hash)) {
            $failed = (int) $acc->failed_attempts + 1;
            $upd = ['failed_attempts' => $failed];
            if ($failed >= self::MAX_FAILED) {
                $upd['failed_attempts'] = 0;
                $upd['locked_until'] = $now->copy()->addMinutes(self::LOCK_MINUTES)->format('Y-m-d H:i:s');
            }
            DB::table('sm_staff_accounts')->where('id', $acc->id)->update($upd);
            return $this->fail('Sai tài khoản hoặc mật khẩu.', 401);
        }
        if (! in_array($acc->role, StaffTokenAuth::READ_ROLES, true)) {
            return $this->fail('Tài khoản này không thuộc bộ phận Kế toán / Ban giám hiệu.', 403);
        }

        $token = Str::random(64);
        DB::table('sm_staff_tokens')->insert([
            'staff_id'   => $acc->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => $now->copy()->addHours(self::TOKEN_HOURS)->format('Y-m-d H:i:s'),
            'created_at' => $now->format('Y-m-d H:i:s'),
        ]);
        DB::table('sm_staff_accounts')->where('id', $acc->id)->update([
            'failed_attempts' => 0, 'locked_until' => null, 'last_login_at' => $now->format('Y-m-d H:i:s'),
        ]);
        // dọn token đã hết hạn của chính tài khoản này
        DB::table('sm_staff_tokens')->where('staff_id', $acc->id)
            ->where('expires_at', '<', $now->format('Y-m-d H:i:s'))->delete();

        return $this->ok([
            'token' => $token,
            'expires_in' => self::TOKEN_HOURS * 3600,
            'user' => $this->userPayload($acc),
        ], 'Đăng nhập thành công');
    }

    public function me(Request $request)
    {
        return $this->ok($this->userPayload($this->staff($request)));
    }

    public function logout(Request $request)
    {
        if ($token = $request->bearerToken()) {
            DB::table('sm_staff_tokens')->where('token_hash', hash('sha256', $token))->delete();
        }
        return $this->ok(null, 'Đã đăng xuất');
    }

    private function userPayload(object $s): array
    {
        return [
            'id' => (int) $s->id,
            'username' => $s->username,
            'full_name' => $s->full_name,
            'role' => $s->role,
            'can_write' => in_array($s->role, StaffTokenAuth::WRITE_ROLES, true),
        ];
    }
}
