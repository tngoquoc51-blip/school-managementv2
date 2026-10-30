<?php

namespace Modules\User\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Modules\User\Models\User;
use Modules\User\Models\UserActivityLog;
use Modules\User\Models\UserLoginHistory;
use Modules\User\Models\UserProfile;
use Modules\User\Models\UserSetting;
use Modules\User\Support\ActivityLogger;

class ProfileService
{
    private const PROFILE_FIELDS = [
        'gender', 'birth_date', 'id_number', 'address', 'job_title', 'department',
        'employee_code', 'joined_at', 'bio',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
    ];

    private const DEFAULT_PREFS = [
        'email' => true, 'inapp' => true, 'security' => true, 'grades' => true,
        'finance' => true, 'system' => true, 'digest' => 'instant',
        'quiet_enabled' => false, 'quiet_from' => '22:00', 'quiet_to' => '06:00',
    ];

    private const ROLE_LABELS = [
        'super_admin' => 'Quản trị hệ thống', 'principal' => 'Hiệu trưởng',
        'vice_principal' => 'Phó hiệu trưởng', 'teacher' => 'Giáo viên',
        'homeroom_teacher' => 'Giáo viên chủ nhiệm', 'department_head' => 'Tổ trưởng chuyên môn',
        'academic' => 'Phòng đào tạo', 'accountant' => 'Kế toán', 'librarian' => 'Thư viện',
        'medical' => 'Y tế học đường', 'supervisor' => 'Giám thị', 'student' => 'Học sinh',
        'parent' => 'Phụ huynh', 'giao_vu' => 'Giáo vụ', 'staff' => 'Nhân viên',
    ];

    /* ------------------------------------------------------------------ */
    /*  Hồ sơ                                                              */
    /* ------------------------------------------------------------------ */

    public function bundle(User $user): array
    {
        $profile = $this->profileOf($user);

        return [
            'account' => $this->account($user),
            'profile' => $this->profileArray($profile),
            'roles' => $this->roles($user),
            'completeness' => $this->completeness($user, $profile),
            'settings' => $this->settingsArray($this->settingsOf($user)),
        ];
    }

    public function update(User $user, array $data, $request = null): array
    {
        DB::transaction(function () use ($user, $data) {
            $user->fill([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
            ])->save();

            $profile = $this->profileOf($user);
            $profile->fill(array_intersect_key($data, array_flip(self::PROFILE_FIELDS)))->save();
        });

        ActivityLogger::log($user->id, 'profile_update', 'Cập nhật thông tin cá nhân', $request);

        return $this->bundle($user->fresh());
    }

    public function storeAvatar(User $user, UploadedFile $file, $request = null): array
    {
        $this->deleteLocalAvatar($user->avatar);

        $path = $file->storeAs('avatars', $user->id . '_' . time() . '.' . $file->extension(), 'public');
        $user->forceFill(['avatar' => $path])->save();

        ActivityLogger::log($user->id, 'avatar_update', 'Thay ảnh đại diện', $request);

        return $this->bundle($user->fresh());
    }

    public function removeAvatar(User $user, $request = null): array
    {
        $this->deleteLocalAvatar($user->avatar);
        $user->forceFill(['avatar' => null])->save();

        ActivityLogger::log($user->id, 'avatar_remove', 'Xóa ảnh đại diện', $request);

        return $this->bundle($user->fresh());
    }

    /* ------------------------------------------------------------------ */
    /*  Bảo mật                                                            */
    /* ------------------------------------------------------------------ */

    /** @return bool false nếu mật khẩu hiện tại sai */
    public function changePassword(User $user, string $current, string $new, bool $logoutOthers, $currentTokenId, $request = null): bool
    {
        if (! Hash::check($current, $user->password)) {
            return false;
        }

        $user->password = $new; // cast 'hashed' trong model sẽ tự băm
        $user->save();

        $settings = $this->settingsOf($user);
        $settings->password_changed_at = now();
        $settings->save();

        $revoked = 0;
        if ($logoutOthers) {
            $revoked = $user->tokens()->when($currentTokenId, fn ($q) => $q->where('id', '!=', $currentTokenId))->delete();
        }

        ActivityLogger::log($user->id, 'password_change', 'Đổi mật khẩu đăng nhập', $request, ['revoked_sessions' => $revoked]);

        return true;
    }

    public function sessions(User $user, $currentTokenId): array
    {
        $tokens = $user->tokens()
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->orderByDesc('last_used_at')->orderByDesc('id')
            ->get();

        $histories = UserLoginHistory::whereIn('token_id', $tokens->pluck('id'))->get()->keyBy('token_id');

        return $tokens->map(function ($t) use ($histories, $currentTokenId) {
            $h = $histories->get($t->id);

            return [
                'id' => $t->id,
                'device' => $h->device ?? 'Không rõ',
                'browser' => $h->browser ?? 'Không rõ',
                'platform' => $h->platform ?? 'Không rõ',
                'ip_address' => $h->ip_address ?? null,
                'created_at' => optional($t->created_at)->toIso8601String(),
                'last_used_at' => optional($t->last_used_at ?? $t->created_at)->toIso8601String(),
                'is_current' => (int) $t->id === (int) $currentTokenId,
            ];
        })->values()->all();
    }

    /** @return int số phiên đã thu hồi */
    public function revokeSession(User $user, int $tokenId, $request = null): int
    {
        $n = $user->tokens()->where('id', $tokenId)->delete();
        if ($n) {
            ActivityLogger::log($user->id, 'session_revoke', 'Đăng xuất một thiết bị khỏi tài khoản', $request, ['token_id' => $tokenId]);
        }

        return $n;
    }

    public function revokeOtherSessions(User $user, $currentTokenId, $request = null): int
    {
        $n = $user->tokens()->when($currentTokenId, fn ($q) => $q->where('id', '!=', $currentTokenId))->delete();
        if ($n) {
            ActivityLogger::log($user->id, 'session_revoke', "Đăng xuất {$n} thiết bị khác khỏi tài khoản", $request, ['count' => $n]);
        }

        return $n;
    }

    public function loginHistory(User $user, int $limit = 10): array
    {
        return UserLoginHistory::where('user_id', $user->id)
            ->orderByDesc('created_at')->orderByDesc('id')->limit($limit)->get()
            ->map(fn ($h) => [
                'id' => $h->id,
                'status' => $h->status,
                'ip_address' => $h->ip_address,
                'device' => $h->device,
                'browser' => $h->browser,
                'platform' => $h->platform,
                'created_at' => optional($h->created_at)->toIso8601String(),
            ])->all();
    }

    /* ------------------------------------------------------------------ */
    /*  Nhật ký hoạt động                                                  */
    /* ------------------------------------------------------------------ */

    public function activity(User $user, array $f): array
    {
        $perPage = max(5, min((int) ($f['per_page'] ?? 10), 100));

        $q = UserActivityLog::where('user_id', $user->id)
            ->when(! empty($f['action']), fn ($q) => $q->where('action', $f['action']))
            ->when(! empty($f['search']), fn ($q) => $q->where('description', 'like', '%' . $f['search'] . '%'))
            ->when(! empty($f['from']), fn ($q) => $q->where('created_at', '>=', $f['from'] . ' 00:00:00'))
            ->when(! empty($f['to']), fn ($q) => $q->where('created_at', '<=', $f['to'] . ' 23:59:59'))
            ->orderByDesc('created_at')->orderByDesc('id');

        $page = $q->paginate($perPage);

        return [
            'items' => collect($page->items())->map(fn ($a) => $this->activityArray($a))->all(),
            'meta' => [
                'total' => $page->total(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
            ],
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Tổng quan                                                          */
    /* ------------------------------------------------------------------ */

    public function overview(User $user, $currentTokenId): array
    {
        $since = now()->subDays(30);
        $base = UserLoginHistory::where('user_id', $user->id)->where('created_at', '>=', $since);
        $loginsOk = (clone $base)->where('status', 'success')->count();
        $loginsFailed = (clone $base)->where('status', 'failed')->count();
        $failed7 = UserLoginHistory::where('user_id', $user->id)->where('status', 'failed')
            ->where('created_at', '>=', now()->subDays(7))->count();

        $last = UserLoginHistory::where('user_id', $user->id)->where('status', 'success')
            ->orderByDesc('created_at')->orderByDesc('id')->first();

        $sessions = $user->tokens()->count();

        // Hoạt động 14 ngày gần nhất
        $from = now()->subDays(13)->startOfDay();
        $perDay = UserActivityLog::where('user_id', $user->id)->where('created_at', '>=', $from)
            ->selectRaw('DATE(created_at) as d, COUNT(*) as c')->groupBy('d')->pluck('c', 'd');
        $chart = [];
        for ($i = 13; $i >= 0; $i--) {
            $day = now()->subDays($i)->toDateString();
            $chart[] = ['date' => $day, 'count' => (int) ($perDay[$day] ?? 0)];
        }

        $settings = $this->settingsOf($user);
        $prefs = $this->prefs($settings);
        $changedAt = $settings->password_changed_at;

        $checks = [
            ['key' => 'password', 'label' => 'Mật khẩu được đổi trong 90 ngày qua', 'ok' => $changedAt && $changedAt->gt(now()->subDays(90)),
                'hint' => 'Đổi mật khẩu định kỳ giúp hạn chế rủi ro lộ thông tin.'],
            ['key' => 'phone', 'label' => 'Đã cập nhật số điện thoại liên hệ', 'ok' => ! empty($user->phone),
                'hint' => 'Cần để nhận mã xác thực và liên hệ khẩn.'],
            ['key' => 'alerts', 'label' => 'Bật cảnh báo bảo mật', 'ok' => (bool) $prefs['security'],
                'hint' => 'Bật trong mục Thông báo để biết ngay khi có đăng nhập lạ.'],
            ['key' => 'sessions', 'label' => 'Không quá 3 thiết bị đang đăng nhập', 'ok' => $sessions <= 3,
                'hint' => 'Đăng xuất các thiết bị không còn sử dụng.'],
            ['key' => 'failed', 'label' => 'Không có đăng nhập sai trong 7 ngày', 'ok' => $failed7 === 0,
                'hint' => 'Kiểm tra lịch sử đăng nhập nếu bạn không phải người nhập sai.'],
        ];
        $score = (int) round(collect($checks)->where('ok', true)->count() / count($checks) * 100);

        $recent = UserActivityLog::where('user_id', $user->id)
            ->orderByDesc('created_at')->orderByDesc('id')->limit(6)->get()
            ->map(fn ($a) => $this->activityArray($a))->all();

        return [
            'stats' => [
                'logins_30d' => $loginsOk,
                'failed_30d' => $loginsFailed,
                'active_sessions' => $sessions,
                'activities_7d' => UserActivityLog::where('user_id', $user->id)->where('created_at', '>=', now()->subDays(7))->count(),
            ],
            'last_login' => $last ? [
                'at' => optional($last->created_at)->toIso8601String(),
                'ip_address' => $last->ip_address,
                'device' => trim(($last->browser ?? '') . ' · ' . ($last->platform ?? ''), ' ·'),
            ] : null,
            'security' => ['score' => $score, 'checks' => array_map(fn ($c) => [...$c, 'ok' => (bool) $c['ok']], $checks)],
            'activity_chart' => $chart,
            'recent_activity' => $recent,
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Cài đặt                                                            */
    /* ------------------------------------------------------------------ */

    public function settings(User $user): array
    {
        return $this->settingsArray($this->settingsOf($user));
    }

    public function updateSettings(User $user, array $data, $request = null): array
    {
        $s = $this->settingsOf($user);

        foreach (['theme', 'language', 'timezone', 'date_format', 'density'] as $k) {
            if (array_key_exists($k, $data)) {
                $s->{$k} = $data[$k];
            }
        }
        if (isset($data['notifications']) && is_array($data['notifications'])) {
            $s->notification_prefs = array_merge($this->prefs($s), $data['notifications']);
        }
        $s->save();

        ActivityLogger::log($user->id, 'settings_update', 'Cập nhật cài đặt cá nhân', $request);

        return $this->settingsArray($s->fresh());
    }

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                            */
    /* ------------------------------------------------------------------ */

    private function profileOf(User $user): UserProfile
    {
        return UserProfile::firstOrCreate(['user_id' => $user->id]);
    }

    private function settingsOf(User $user): UserSetting
    {
        $s = UserSetting::firstOrCreate(['user_id' => $user->id], ['notification_prefs' => self::DEFAULT_PREFS]);

        return $s->wasRecentlyCreated ? $s->refresh() : $s;
    }

    private function prefs(UserSetting $s): array
    {
        return array_merge(self::DEFAULT_PREFS, $s->notification_prefs ?? []);
    }

    private function account(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'username' => $u->username,
            'phone' => $u->phone,
            'avatar_url' => $this->avatarUrl($u->avatar),
            'status' => $u->status,
            'created_at' => optional($u->created_at)->toIso8601String(),
        ];
    }

    private function profileArray(UserProfile $p): array
    {
        $out = [];
        foreach (self::PROFILE_FIELDS as $f) {
            $v = $p->{$f};
            $out[$f] = $v instanceof \DateTimeInterface ? $v->format('Y-m-d') : $v;
        }

        return $out;
    }

    private function settingsArray(UserSetting $s): array
    {
        return [
            'theme' => $s->theme ?? 'light',
            'language' => $s->language ?? 'vi',
            'timezone' => $s->timezone ?? 'Asia/Ho_Chi_Minh',
            'date_format' => $s->date_format ?? 'DD/MM/YYYY',
            'density' => $s->density ?? 'comfortable',
            'notifications' => $this->prefs($s),
            'password_changed_at' => optional($s->password_changed_at)->toIso8601String(),
        ];
    }

    private function roles(User $user): array
    {
        // Hỗ trợ cả hai kiểu model_type đang tồn tại trong database
        return DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('model_has_roles.model_id', $user->id)
            ->whereIn('model_has_roles.model_type', [User::class, 'App\\Models\\User'])
            ->pluck('roles.name')->unique()->values()
            ->map(fn ($n) => ['name' => $n, 'label' => self::ROLE_LABELS[$n] ?? $n])->all();
    }

    private function completeness(User $user, UserProfile $p): array
    {
        $items = [
            'avatar' => ['Ảnh đại diện', ! empty($user->avatar)],
            'phone' => ['Số điện thoại', ! empty($user->phone)],
            'gender' => ['Giới tính', ! empty($p->gender)],
            'birth_date' => ['Ngày sinh', ! empty($p->birth_date)],
            'address' => ['Địa chỉ liên hệ', ! empty($p->address)],
            'job_title' => ['Chức vụ', ! empty($p->job_title)],
            'department' => ['Phòng ban / Bộ phận', ! empty($p->department)],
            'bio' => ['Giới thiệu bản thân', ! empty($p->bio)],
            'emergency' => ['Liên hệ khẩn cấp', ! empty($p->emergency_contact_name) && ! empty($p->emergency_contact_phone)],
        ];

        $missing = [];
        foreach ($items as $key => [$label, $ok]) {
            if (! $ok) {
                $missing[] = ['key' => $key, 'label' => $label];
            }
        }

        return ['percent' => (int) round((count($items) - count($missing)) / count($items) * 100), 'missing' => $missing];
    }

    private function activityArray($a): array
    {
        return [
            'id' => $a->id,
            'action' => $a->action,
            'description' => $a->description,
            'ip_address' => $a->ip_address,
            'created_at' => optional($a->created_at)->toIso8601String(),
        ];
    }

    private function avatarUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        return str_starts_with($path, 'http') ? $path : Storage::disk('public')->url($path);
    }

    private function deleteLocalAvatar(?string $path): void
    {
        if ($path && ! str_starts_with($path, 'http')) {
            Storage::disk('public')->delete($path);
        }
    }
}
