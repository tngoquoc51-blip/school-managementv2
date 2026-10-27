<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\AdminNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;

class AdminProfileController extends Controller
{
    private function profile($u)
    {
        DB::table('admin_profiles')->insertOrIgnore([
            'user_id' => $u->id, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $p = DB::table('admin_profiles')->where('user_id', $u->id)->first();
        $p->avatar_url = $p->avatar ? asset('storage/' . $p->avatar) : null;
        return $p;
    }

    private function log(Request $r, string $action, string $desc): void
    {
        DB::table('admin_activity_logs')->insert([
            'user_id' => $r->user()->id, 'action' => $action, 'description' => $desc,
            'ip' => $r->ip(), 'user_agent' => substr((string) $r->userAgent(), 0, 255),
            'created_at' => now(),
        ]);
    }

    public function show(Request $r)
    {
        $u = $r->user();
        return response()->json([
            'user' => [
                'id' => $u->id, 'name' => $u->name, 'email' => $u->email,
                'username' => $u->username, 'phone' => $u->phone, 'status' => $u->status,
                'created_at' => $u->created_at,
                'roles' => method_exists($u, 'getRoleNames') ? $u->getRoleNames() : [],
            ],
            'profile' => $this->profile($u),
        ]);
    }

    public function update(Request $r)
    {
        $d = $r->validate([
            'name' => 'required|string|max:255',
            'phone' => ['nullable', 'regex:/^0\d{9}$/'],
            'gender' => 'nullable|in:male,female,other',
            'date_of_birth' => 'nullable|date|before:today',
            'address' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:100',
            'department' => 'nullable|string|max:100',
            'bio' => 'nullable|string|max:500',
        ], ['phone.regex' => 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.']);

        $u = $r->user();
        DB::transaction(function () use ($u, $d) {
            DB::table('users')->where('id', $u->id)->update([
                'name' => $d['name'], 'phone' => $d['phone'] ?? null, 'updated_at' => now(),
            ]);
            $this->profile($u);
            DB::table('admin_profiles')->where('user_id', $u->id)->update([
                'gender' => $d['gender'] ?? null, 'date_of_birth' => $d['date_of_birth'] ?? null,
                'address' => $d['address'] ?? null, 'position' => $d['position'] ?? null,
                'department' => $d['department'] ?? null, 'bio' => $d['bio'] ?? null,
                'updated_at' => now(),
            ]);
        });
        $this->log($r, 'profile.update', 'Cập nhật thông tin cá nhân');
        return $this->show($r->setUserResolver(fn () => $u->fresh()));
    }

    public function avatar(Request $r)
    {
        $r->validate(['avatar' => 'required|image|mimes:jpg,jpeg,png,webp|max:2048'],
            ['avatar.max' => 'Ảnh tối đa 2MB.', 'avatar.image' => 'Tệp phải là ảnh JPG, PNG hoặc WEBP.']);
        $u = $r->user();
        $p = $this->profile($u);
        if ($p->avatar) Storage::disk('public')->delete($p->avatar);
        $path = $r->file('avatar')->store('avatars', 'public');
        DB::table('admin_profiles')->where('user_id', $u->id)->update(['avatar' => $path, 'updated_at' => now()]);
        $this->log($r, 'avatar.update', 'Đổi ảnh đại diện');
        return response()->json(['avatar_url' => asset('storage/' . $path)]);
    }

    public function preferences(Request $r)
    {
        $d = $r->validate([
            'notify_login' => 'required|boolean', 'notify_system' => 'required|boolean',
            'notify_email' => 'required|boolean',
        ]);
        $this->profile($r->user());
        DB::table('admin_profiles')->where('user_id', $r->user()->id)->update($d + ['updated_at' => now()]);
        $this->log($r, 'prefs.update', 'Cập nhật tuỳ chọn thông báo');
        return response()->json(['message' => 'Đã lưu tuỳ chọn.']);
    }

    public function password(Request $r)
    {
        $r->validate([
            'current_password' => 'required|string',
            'password' => ['required', 'confirmed', 'different:current_password', Password::min(8)->mixedCase()->numbers()],
        ], [
            'password.confirmed' => 'Mật khẩu xác nhận không khớp.',
            'password.different' => 'Mật khẩu mới phải khác mật khẩu hiện tại.',
        ]);
        $u = $r->user();
        if (!Hash::check($r->current_password, $u->password)) {
            return response()->json(['message' => 'Mật khẩu hiện tại không đúng.',
                'errors' => ['current_password' => ['Mật khẩu hiện tại không đúng.']]], 422);
        }
        DB::table('users')->where('id', $u->id)->update(['password' => Hash::make($r->password), 'updated_at' => now()]);
        $cur = $u->currentAccessToken()->id ?? 0;
        $u->tokens()->where('id', '!=', $cur)->delete(); // đăng xuất các thiết bị khác
        $this->log($r, 'password.change', 'Đổi mật khẩu và đăng xuất thiết bị khác');
        AdminNotifier::push($u->id, 'security', 'Mật khẩu đã được thay đổi', 'Các thiết bị khác đã bị đăng xuất.', 'success');
        return response()->json(['message' => 'Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.']);
    }

    public function email(Request $r)
    {
        $u = $r->user();
        $r->validate([
            'email' => 'required|email|max:255|unique:users,email,' . $u->id,
            'current_password' => 'required|string',
        ], ['email.unique' => 'Email này đã được dùng cho tài khoản khác.']);
        if (!Hash::check($r->current_password, $u->password)) {
            return response()->json(['message' => 'Mật khẩu hiện tại không đúng.',
                'errors' => ['current_password' => ['Mật khẩu hiện tại không đúng.']]], 422);
        }
        $new = strtolower($r->email);
        DB::table('users')->where('id', $u->id)->update(['email' => $new, 'email_verified_at' => null, 'updated_at' => now()]);
        $this->log($r, 'email.change', "Đổi email đăng nhập từ {$u->email} sang $new");
        AdminNotifier::push($u->id, 'security', 'Email đăng nhập đã thay đổi', "Email mới: $new", 'warning');
        return response()->json(['message' => 'Đã đổi email đăng nhập.', 'email' => $new]);
    }

    public function sessions(Request $r)
    {
        $cur = $r->user()->currentAccessToken()->id ?? 0;
        $rows = $r->user()->tokens()->orderByDesc('last_used_at')->get()->map(fn ($t) => [
            'id' => $t->id, 'name' => $t->name, 'created_at' => $t->created_at,
            'last_used_at' => $t->last_used_at, 'current' => $t->id === $cur,
        ]);
        return response()->json(['data' => $rows]);
    }

    public function revoke(Request $r, int $id)
    {
        if ($id === ($r->user()->currentAccessToken()->id ?? 0)) {
            return response()->json(['message' => 'Không thể thu hồi phiên đang dùng. Hãy đăng xuất.'], 422);
        }
        $n = $r->user()->tokens()->where('id', $id)->delete();
        if (!$n) return response()->json(['message' => 'Không tìm thấy phiên.'], 404);
        $this->log($r, 'session.revoke', 'Thu hồi một phiên đăng nhập');
        return response()->json(['message' => 'Đã thu hồi phiên.']);
    }

    public function revokeOthers(Request $r)
    {
        $cur = $r->user()->currentAccessToken()->id ?? 0;
        $n = $r->user()->tokens()->where('id', '!=', $cur)->delete();
        $this->log($r, 'session.revoke_all', "Đăng xuất $n thiết bị khác");
        return response()->json(['message' => "Đã đăng xuất $n thiết bị khác."]);
    }

    public function activity(Request $r)
    {
        $rows = DB::table('admin_activity_logs')->where('user_id', $r->user()->id)
            ->orderByDesc('id')->limit(min((int) $r->query('limit', 30), 100))->get();
        return response()->json(['data' => $rows]);
    }
}
