<?php

namespace Modules\Academic\Support;

use Illuminate\Support\Facades\DB;

/**
 * Tiện ích dùng chung cho khu vực Chuyên môn – Ban Giám hiệu.
 * Chỉ dùng SQL thuần (DB::select/insert/...) để dễ kiểm thử và tối ưu chỉ mục.
 */
final class Bgh
{
    /** Vai trò được phép vào khu vực BGH. */
    public const ROLES = ['principal', 'vice_principal', 'super_admin'];

    public const LEVELS = ['Tốt', 'Khá', 'Đạt', 'Chưa đạt'];

    /** Năm học: ưu tiên tham số, nếu không có thì lấy năm học hiện tại. */
    public static function year(?int $id = null): int
    {
        if ($id) {
            return $id;
        }
        $row = DB::selectOne('SELECT id FROM sm_school_years WHERE is_current = 1 ORDER BY id DESC LIMIT 1')
            ?? DB::selectOne('SELECT MAX(id) AS id FROM sm_school_years');

        return (int) ($row->id ?? 0);
    }

    public static function semester($value): int
    {
        return (int) $value === 2 ? 2 : 1;
    }

    /** Định mức tiết/tuần của giáo viên (cấu hình qua sm_system_settings.teacher_quota_periods). */
    public static function quota(): int
    {
        $row = DB::selectOne("SELECT setting_value FROM sm_system_settings WHERE setting_key = 'teacher_quota_periods'");
        $v = (int) ($row->setting_value ?? 0);

        return $v > 0 ? $v : 17;
    }

    /** Ghi nhật ký thao tác vào sm_staff_activity. */
    public static function audit(array $actor, string $action, ?string $detail = null): void
    {
        DB::insert(
            'INSERT INTO sm_staff_activity (user_id, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)',
            [
                (int) ($actor['id'] ?? 0),
                mb_substr($action, 0, 180),
                $detail !== null ? mb_substr($detail, 0, 255) : null,
                $actor['ip'] ?? null,
                date('Y-m-d H:i:s'),
            ]
        );
    }

    /** Tạo thông báo hệ thống (hiện trên chuông thông báo của cán bộ). */
    public static function notify(array $actor, string $title, string $body, string $type = 'academic', string $priority = 'normal'): void
    {
        DB::insert(
            'INSERT INTO sm_notifications (title, body, type, priority, audience, sender_id, sender_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [mb_substr($title, 0, 255), $body, $type, $priority, 'staff', $actor['id'] ?? null, $actor['name'] ?? null, date('Y-m-d H:i:s')]
        );
    }

    public static function ratingFromScore(float $score): string
    {
        return $score >= 8 ? 'Tốt' : ($score >= 6.5 ? 'Khá' : ($score >= 5 ? 'Đạt' : 'Chưa đạt'));
    }
}
