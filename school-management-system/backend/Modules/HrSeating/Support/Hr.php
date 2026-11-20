<?php

namespace Modules\HrSeating\Support;

use Illuminate\Support\Facades\DB;

/** Tiện ích dùng chung của module Sơ đồ & Sĩ số lớp (chỉ dùng SQL thuần). */
final class Hr
{
    public const MANAGER_ROLES = ['principal', 'vice_principal', 'super_admin', 'academic'];

    public const OFFICER_ROLES = [
        'monitor' => 'Lớp trưởng',
        'deputy_study' => 'Lớp phó học tập',
        'deputy_labor' => 'Lớp phó lao động',
        'deputy_culture' => 'Lớp phó văn thể',
        'secretary' => 'Bí thư chi đoàn',
        'treasurer' => 'Thủ quỹ',
    ];

    public static function year(): int
    {
        $row = DB::selectOne('SELECT id FROM sm_school_years WHERE is_current = 1 ORDER BY id DESC LIMIT 1')
            ?? DB::selectOne('SELECT MAX(id) AS id FROM sm_school_years');

        return (int) ($row->id ?? 0);
    }

    public static function semester($v): int
    {
        return (int) $v === 2 ? 2 : 1;
    }

    /** Tên (từ cuối của họ và tên) – người Việt xếp thứ tự theo tên. */
    public static function ten(string $fullName): string
    {
        $parts = preg_split('/\s+/u', trim($fullName));

        return (string) end($parts);
    }

    private static function vn(string $s): string
    {
        static $map = null;
        if ($map === null) {
            $map = [];
            $groups = [
                'a' => 'àáảãạăằắẳẵặâầấẩẫậ', 'e' => 'èéẻẽẹêềếểễệ', 'i' => 'ìíỉĩị', 'o' => 'òóỏõọôồốổỗộơờớởỡợ',
                'u' => 'ùúủũụưừứửữự', 'y' => 'ỳýỷỹỵ',
            ];
            foreach ($groups as $base => $chars) {
                foreach (preg_split('//u', $chars, -1, PREG_SPLIT_NO_EMPTY) as $ch) {
                    $map[$ch] = $base;
                }
            }
            $map['đ'] = 'dz'; // đ đứng sau d, trước e
        }

        return strtr(mb_strtolower($s), $map);
    }

    /** Khóa sắp xếp theo tên rồi đến họ đệm, bỏ dấu, đ sau d. */
    public static function sortKey(string $fullName): string
    {
        return self::vn(self::ten($fullName)) . '|' . self::vn($fullName);
    }

    public static function levelOf($avg, $min): ?string
    {
        if ($avg === null) {
            return null;
        }
        $avg = (float) $avg;
        $min = $min === null ? 10.0 : (float) $min;
        if ($avg >= 8 && $min >= 6.5) {
            return 'Tốt';
        }
        if ($avg >= 6.5 && $min >= 5) {
            return 'Khá';
        }
        if ($avg >= 5 && $min >= 3.5) {
            return 'Đạt';
        }

        return 'Chưa đạt';
    }

    public static function age(string $birth): int
    {
        try {
            return (int) (new \DateTime($birth))->diff(new \DateTime('today'))->y;
        } catch (\Throwable $e) {
            return 0;
        }
    }

    /** Số ngày tới sinh nhật kế tiếp (0 = hôm nay). */
    public static function daysToBirthday(string $birth): int
    {
        try {
            $b = new \DateTime($birth);
            $t = new \DateTime('today');
            $next = new \DateTime($t->format('Y') . '-' . $b->format('m-d'));
            if ($next < $t) {
                $next->modify('+1 year');
            }

            return (int) $t->diff($next)->days;
        } catch (\Throwable $e) {
            return 999;
        }
    }

    public static function key(int $r, int $c, int $p): string
    {
        return $r . '-' . $c . '-' . $p;
    }

    public static function event(int $classId, ?int $layoutId, string $action, ?string $detail, array $actor): void
    {
        DB::insert(
            'INSERT INTO sm_seat_events (class_id, layout_id, action, detail, actor_name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [$classId, $layoutId, mb_substr($action, 0, 40), $detail !== null ? mb_substr($detail, 0, 255) : null, $actor['name'] ?? null, date('Y-m-d H:i:s')]
        );
        // nhật ký chung của hệ thống (nếu bảng có)
        try {
            DB::insert(
                'INSERT INTO sm_staff_activity (user_id, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)',
                [(int) ($actor['id'] ?? 0), 'seating.' . mb_substr($action, 0, 150), $detail !== null ? mb_substr($detail, 0, 255) : null, $actor['ip'] ?? null, date('Y-m-d H:i:s')]
            );
        } catch (\Throwable $e) {
            // bảng nhật ký chung khác cấu trúc: bỏ qua, đã có sm_seat_events
        }
    }

    private static bool $tablesChecked = false;

    public static function ensureTables(): void
    {
        if (self::$tablesChecked) {
            return;
        }
        self::$tablesChecked = true;

        try {
            DB::statement("CREATE TABLE IF NOT EXISTS `sm_seat_layouts` (
              `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
              `class_id` bigint(20) unsigned NOT NULL,
              `school_year_id` bigint(20) unsigned NOT NULL,
              `semester` tinyint(3) unsigned NOT NULL DEFAULT 1,
              `name` varchar(100) NOT NULL,
              `room_label` varchar(60) DEFAULT NULL,
              `rows_n` tinyint(3) unsigned NOT NULL DEFAULT 5,
              `cols_n` tinyint(3) unsigned NOT NULL DEFAULT 4,
              `seats_per_desk` tinyint(3) unsigned NOT NULL DEFAULT 2,
              `blocked` longtext DEFAULT NULL,
              `status` varchar(20) NOT NULL DEFAULT 'draft',
              `is_active` tinyint(1) NOT NULL DEFAULT 0,
              `version` int(10) unsigned NOT NULL DEFAULT 1,
              `published_at` datetime DEFAULT NULL,
              `note` text DEFAULT NULL,
              `created_by` bigint(20) unsigned DEFAULT NULL,
              `created_by_name` varchar(120) DEFAULT NULL,
              `created_at` timestamp NULL DEFAULT NULL,
              `updated_at` timestamp NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `sm_seat_layouts_class_id_is_active_index` (`class_id`,`is_active`),
              KEY `sm_seat_layouts_class_id_school_year_id_index` (`class_id`,`school_year_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            DB::statement("CREATE TABLE IF NOT EXISTS `sm_seat_assignments` (
              `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
              `layout_id` bigint(20) unsigned NOT NULL,
              `seat_row` tinyint(3) unsigned NOT NULL,
              `seat_col` tinyint(3) unsigned NOT NULL,
              `seat_pos` tinyint(3) unsigned NOT NULL DEFAULT 0,
              `student_id` bigint(20) unsigned NOT NULL,
              `locked` tinyint(1) NOT NULL DEFAULT 0,
              `note` varchar(255) DEFAULT NULL,
              `created_at` timestamp NULL DEFAULT NULL,
              `updated_at` timestamp NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uq_seat_slot` (`layout_id`,`seat_row`,`seat_col`,`seat_pos`),
              KEY `sm_seat_assignments_layout_id_student_id_index` (`layout_id`,`student_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            DB::statement("CREATE TABLE IF NOT EXISTS `sm_seat_events` (
              `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
              `class_id` bigint(20) unsigned NOT NULL,
              `layout_id` bigint(20) unsigned DEFAULT NULL,
              `action` varchar(60) NOT NULL,
              `detail` text DEFAULT NULL,
              `actor_name` varchar(120) DEFAULT NULL,
              `created_at` timestamp NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `sm_seat_events_class_id_id_index` (`class_id`,`id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            DB::statement("CREATE TABLE IF NOT EXISTS `sm_student_seat_flags` (
              `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
              `student_id` bigint(20) unsigned NOT NULL,
              `school_year_id` bigint(20) unsigned NOT NULL,
              `vision` tinyint(1) NOT NULL DEFAULT 0,
              `hearing` tinyint(1) NOT NULL DEFAULT 0,
              `tall` tinyint(1) NOT NULL DEFAULT 0,
              `front_required` tinyint(1) NOT NULL DEFAULT 0,
              `avoid_ids` longtext DEFAULT NULL,
              `note` varchar(255) DEFAULT NULL,
              `updated_at` timestamp NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uq_student_flag_year` (`student_id`,`school_year_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            DB::statement("CREATE TABLE IF NOT EXISTS `sm_class_groups` (
              `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
              `class_id` bigint(20) unsigned NOT NULL,
              `school_year_id` bigint(20) unsigned NOT NULL,
              `number` tinyint(3) unsigned NOT NULL,
              `name` varchar(60) NOT NULL,
              `color` varchar(20) NOT NULL DEFAULT '#1d6fe0',
              `leader_student_id` bigint(20) unsigned DEFAULT NULL,
              `created_at` timestamp NULL DEFAULT NULL,
              `updated_at` timestamp NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uq_class_group_num` (`class_id`,`school_year_id`,`number`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            DB::statement("CREATE TABLE IF NOT EXISTS `sm_class_group_members` (
              `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
              `group_id` bigint(20) unsigned NOT NULL,
              `student_id` bigint(20) unsigned NOT NULL,
              `created_at` timestamp NULL DEFAULT NULL,
              `updated_at` timestamp NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uq_group_member` (`group_id`,`student_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            DB::statement("CREATE TABLE IF NOT EXISTS `sm_class_officers` (
              `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
              `class_id` bigint(20) unsigned NOT NULL,
              `school_year_id` bigint(20) unsigned NOT NULL,
              `role` varchar(40) NOT NULL,
              `student_id` bigint(20) unsigned NOT NULL,
              `created_at` timestamp NULL DEFAULT NULL,
              `updated_at` timestamp NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uq_class_officer_role` (`class_id`,`school_year_id`,`role`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
        } catch (\Throwable $e) {
            // bỏ qua nếu csdl chưa sẵn sàng
        }
    }
}
