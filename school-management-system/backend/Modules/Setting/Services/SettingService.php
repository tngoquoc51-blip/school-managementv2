<?php

namespace Modules\Setting\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Đọc / ghi cấu hình hệ thống (bảng sys_settings) + ghi nhật ký kiểm toán (sm_audit_logs).
 * SCHEMA = danh sách khóa hợp lệ của từng nhóm + quy tắc validate (whitelist, chống ghi khóa lạ).
 */
class SettingService
{
    public const SECRETS = ['smtp_password', 'sms_api_key'];

    public const SCHEMA = [
        'general' => [
            'school_name'       => 'required|string|max:160',
            'school_short_name' => 'nullable|string|max:80',
            'school_code'       => 'nullable|string|max:30',
            'address'           => 'nullable|string|max:255',
            'phone'             => 'nullable|string|max:30',
            'email'             => 'nullable|email|max:120',
            'website'           => 'nullable|string|max:160',
            'principal_name'    => 'nullable|string|max:120',
            'tax_code'          => 'nullable|string|max:30',
            'established_year'  => 'nullable|integer|min:1800|max:2100',
            'timezone'          => 'required|timezone',
            'date_format'       => 'required|in:d/m/Y,d-m-Y,Y-m-d',
        ],
        'appearance' => [
            'primary_color'     => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'accent_color'      => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'theme_mode'        => 'required|in:light,dark,auto',
            'logo_url'          => 'nullable|string|max:255',
            'favicon_url'       => 'nullable|string|max:255',
            'login_banner_text' => 'nullable|string|max:160',
            'footer_text'       => 'nullable|string|max:255',
            'compact_mode'      => 'required|in:0,1',
        ],
        'security' => [
            'min_password_length'      => 'required|integer|min:4|max:64',
            'require_uppercase'        => 'required|in:0,1',
            'require_number'           => 'required|in:0,1',
            'require_special'          => 'required|in:0,1',
            'password_expire_days'     => 'required|integer|min:0|max:730',
            'max_login_attempts'       => 'required|integer|min:3|max:20',
            'lockout_minutes'          => 'required|integer|min:1|max:1440',
            'session_timeout_minutes'  => 'required|integer|min:5|max:43200',
            'force_change_first_login' => 'required|in:0,1',
            'admin_ip_whitelist'       => 'nullable|string|max:1000',
        ],
        'mail' => [
            'mail_enabled'    => 'required|in:0,1',
            'smtp_host'       => 'nullable|string|max:120',
            'smtp_port'       => 'nullable|integer|min:1|max:65535',
            'smtp_encryption' => 'required|in:tls,ssl,none',
            'smtp_username'   => 'nullable|string|max:160',
            'smtp_password'   => 'nullable|string|max:255',
            'from_address'    => 'nullable|email|max:160',
            'from_name'       => 'nullable|string|max:120',
        ],
        'notification' => [
            'notify_new_account'     => 'required|in:0,1',
            'notify_grade_published' => 'required|in:0,1',
            'notify_absence_parent'  => 'required|in:0,1',
            'notify_fee_due'         => 'required|in:0,1',
            'channel_inapp'          => 'required|in:0,1',
            'channel_email'          => 'required|in:0,1',
            'channel_sms'            => 'required|in:0,1',
            'sms_provider'           => 'required|in:none,esms,speedsms,twilio',
            'sms_api_key'            => 'nullable|string|max:255',
            'digest_hour'            => 'required|integer|min:0|max:23',
        ],
        'academic' => [
            'grade_scale'        => 'required|in:10,100',
            'score_decimals'     => 'required|integer|min:0|max:2',
            'pass_score'         => 'required|numeric|min:0|max:100',
            'good_score'         => 'required|numeric|min:0|max:100',
            'excellent_score'    => 'required|numeric|min:0|max:100',
            'max_absent_percent' => 'required|integer|min:0|max:100',
            'grade_lock_days'    => 'required|integer|min:0|max:365',
            'periods_per_day'    => 'required|integer|min:1|max:15',
            'lesson_minutes'     => 'required|integer|min:20|max:120',
            'class_max_students' => 'required|integer|min:10|max:100',
        ],
        'audit' => [
            'retention_days'  => 'required|integer|min:30|max:3650',
            'mask_ip'         => 'required|in:0,1',
            'export_max_rows' => 'required|integer|min:100|max:500000',
        ],
        'maintenance' => [
            'maintenance_on'      => 'required|in:0,1',
            'maintenance_message' => 'nullable|string|max:255',
        ],
    ];

    public static function groupExists(string $g): bool
    {
        return isset(self::SCHEMA[$g]);
    }

    /** Toàn bộ giá trị của nhóm (đã giải mã). Dùng nội bộ, KHÔNG trả thẳng ra API. */
    public function raw(string $group): array
    {
        return Cache::rememberForever("sys_settings.$group", function () use ($group) {
            $out = [];
            foreach (DB::table('sys_settings')->where('grp', $group)->get() as $r) {
                $v = $r->svalue;
                if ($r->is_secret && $v !== null && $v !== '') {
                    try { $v = Crypt::decryptString($v); } catch (\Throwable) { $v = ''; }
                }
                $out[$r->skey] = $v;
            }
            return $out;
        });
    }

    public function get(string $group, string $key, $default = null)
    {
        $v = $this->raw($group)[$key] ?? null;
        return ($v === null || $v === '') ? $default : $v;
    }

    /** Dữ liệu an toàn cho giao diện: mật khẩu/khóa bí mật bị ẩn, chỉ báo "đã đặt". */
    public function forUi(string $group): array
    {
        $raw = $this->raw($group);
        $values = [];
        $secrets = [];
        foreach (array_keys(self::SCHEMA[$group]) as $k) {
            if (in_array($k, self::SECRETS, true)) {
                $secrets[$k] = ! empty($raw[$k]);
                $values[$k] = '';
            } else {
                $values[$k] = $raw[$k] ?? '';
            }
        }
        $meta = DB::table('sys_settings')->where('grp', $group)->selectRaw('MAX(updated_at) as at, MAX(updated_by) as by_id')->first();
        return ['values' => $values, 'secrets' => $secrets, 'updated_at' => $meta->at ?? null];
    }

    /** Lưu nhóm; trả về danh sách khóa thay đổi (để ghi nhật ký). */
    public function save(string $group, array $input, ?int $userId): array
    {
        $changed = [];
        $old = $this->raw($group);

        DB::transaction(function () use ($group, $input, $userId, $old, &$changed) {
            foreach (self::SCHEMA[$group] as $key => $_rule) {
                if (! array_key_exists($key, $input)) continue;
                $val = is_bool($input[$key]) ? ($input[$key] ? '1' : '0') : (string) ($input[$key] ?? '');
                $secret = in_array($key, self::SECRETS, true);

                if ($secret) {
                    if ($val === '') continue;                 // để trống = giữ nguyên
                    if ($val === '__CLEAR__') $val = '';       // xóa khóa
                    $stored = $val === '' ? '' : Crypt::encryptString($val);
                    $changed[] = $key;
                } else {
                    if (($old[$key] ?? '') === $val) continue;
                    $stored = $val;
                    $changed[] = $key;
                }

                DB::table('sys_settings')->updateOrInsert(
                    ['grp' => $group, 'skey' => $key],
                    ['svalue' => $stored, 'is_secret' => $secret ? 1 : 0, 'updated_by' => $userId, 'updated_at' => now()]
                );
            }
        });

        Cache::forget("sys_settings.$group");
        if ($group === 'maintenance') Cache::forget('sys_maintenance_flag');
        return $changed;
    }

    /** Ghi 1 dòng vào sm_audit_logs (bảng nhật ký kiểm toán đã có sẵn trong DB). */
    public function audit(?object $user, string $action, string $summary, array $extra = []): void
    {
        try {
            $req = request();
            DB::table('sm_audit_logs')->insert([
                'request_id'   => (string) \Illuminate\Support\Str::uuid(),
                'occurred_at'  => now()->format('Y-m-d H:i:s.v'),
                'actor_type'   => $user ? 'staff' : 'system',
                'actor_id'     => $user->id ?? null,
                'actor_name'   => $user->name ?? null,
                'actor_role'   => $user && method_exists($user, 'getRoleNames') ? ($user->getRoleNames()->first()) : null,
                'module'       => 'system',
                'action'       => $action,
                'entity_type'  => $extra['entity_type'] ?? 'setting',
                'entity_id'    => $extra['entity_id'] ?? null,
                'entity_label' => $extra['entity_label'] ?? null,
                'severity'     => $extra['severity'] ?? 'notice',
                'status'       => $extra['status'] ?? 'success',
                'summary'      => mb_substr($summary, 0, 255),
                'old_values'   => isset($extra['old']) ? json_encode($extra['old'], JSON_UNESCAPED_UNICODE) : null,
                'new_values'   => isset($extra['new']) ? json_encode($extra['new'], JSON_UNESCAPED_UNICODE) : null,
                'ip'           => $req?->ip(),
                'user_agent'   => $req ? mb_substr((string) $req->userAgent(), 0, 255) : null,
                'method'       => $req?->method(),
                'path'         => $req ? mb_substr($req->path(), 0, 255) : null,
            ]);
        } catch (\Throwable $e) {
            report($e); // không để lỗi nhật ký làm hỏng thao tác chính
        }
    }
}
