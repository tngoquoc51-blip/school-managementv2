<?php

namespace App\Services\SystemLog;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Gom nhật ký từ 5 bảng CÓ SẴN của dự án vào bảng trung tâm `system_logs`,
 * nên code cũ (thu học phí, đợt thu, bảo mật…) tự xuất hiện trên trang Nhật ký
 * mà KHÔNG phải sửa lại controller. Chỉ nhập phần mới (theo mốc id đã lưu).
 */
class LegacyLogImporter
{
    private const BATCH = 2000;

    private const COLS = '(occurred_at, level, level_no, category, action, actor_type, actor_id, actor_name, subject_type, subject_id, summary, ip_address, source, source_ref)';

    /** [bảng => [alias, câu SELECT khớp thứ tự COLS]] */
    private function sources(): array
    {
        return [
            'sm_fee_audit' => ['a', "SELECT COALESCE(a.created_at, NOW()), 'info', 20, 'finance', CONCAT('fee.', a.action), 'staff', a.actor_id, s.full_name, 'fee_item', a.fee_item_id,
                LEFT(CONCAT('Khoản thu: ', a.action, IF(a.detail IS NULL, '', CONCAT(' — ', a.detail))), 500), a.ip, 'import:sm_fee_audit', a.id
                FROM sm_fee_audit a LEFT JOIN sm_staff_accounts s ON s.id = a.actor_id"],
            'sm_fee_period_log' => ['l', "SELECT l.created_at, IF(l.action IN ('cancel','reopen'),'warning','info'), IF(l.action IN ('cancel','reopen'),40,20), 'finance', CONCAT('period.', l.action),
                IF(l.actor = 'Hệ thống','system','staff'), NULL, l.actor, 'fee_period', l.period_id,
                LEFT(CONCAT('Đợt thu #', l.period_id, ': ', l.action, IF(l.detail IS NULL, '', CONCAT(' — ', l.detail))), 500), NULL, 'import:sm_fee_period_log', l.id
                FROM sm_fee_period_log l"],
            'sm_payment_log' => ['p', "SELECT p.created_at, IF(p.action IN ('void','reject'),'warning','info'), IF(p.action IN ('void','reject'),40,20), 'finance', CONCAT('payment.', p.action),
                'staff', NULL, p.actor, 'payment', p.payment_id,
                LEFT(CONCAT('Thanh toán #', p.payment_id, ': ', p.action, IF(p.detail IS NULL, '', CONCAT(' — ', p.detail))), 500), NULL, 'import:sm_payment_log', p.id
                FROM sm_payment_log p"],
            'sm_security_audit' => ['x', "SELECT x.created_at, IF(x.action LIKE 'export%' OR x.action LIKE 'encrypt%','notice','info'), IF(x.action LIKE 'export%' OR x.action LIKE 'encrypt%',30,20), IF(x.action = 'login','auth','security'), IF(x.action = 'login','auth.login',x.action),
                x.actor_type, x.actor_id, NULL, x.target_table, x.target_id,
                LEFT(CONCAT('Bảo mật: ', x.action, IF(x.target_table IS NULL, '', CONCAT(' trên ', x.target_table, IF(x.target_id IS NULL, '', CONCAT(' #', x.target_id))))), 500), x.ip, 'import:sm_security_audit', x.id
                FROM sm_security_audit x"],
            'sm_staff_activity' => ['t', "SELECT t.created_at, 'info', 20, 'academic', LEFT(CONCAT('staff.', t.action), 80), 'staff', t.user_id, u.name, NULL, NULL,
                LEFT(CONCAT(t.action, IF(t.detail IS NULL, '', CONCAT(' — ', t.detail))), 500), t.ip, 'import:sm_staff_activity', t.id
                FROM sm_staff_activity t LEFT JOIN users u ON u.id = t.user_id"],
        ];
    }

    /** Nhập phần mới, tối đa mỗi 20 giây một lần. @return int số dòng đã nhập */
    public function syncThrottled(): int
    {
        try {
            if (! Cache::add('syslog.sync.lock', 1, 20)) {
                return 0;
            }
        } catch (\Throwable $e) {
            // cache lỗi thì vẫn chạy
        }

        return $this->sync();
    }

    public function sync(): int
    {
        $imported = 0;
        foreach ($this->sources() as $table => [$alias, $select]) {
            try {
                if (! Schema::hasTable($table)) {
                    continue;
                }
                $key = "import.{$table}.last_id";
                $last = (int) (DB::selectOne('SELECT setting_value AS v FROM system_log_settings WHERE setting_key = ?', [$key])->v ?? 0);

                $max = DB::selectOne("SELECT MAX(id) AS m FROM (SELECT id FROM {$table} WHERE id > ? ORDER BY id LIMIT " . self::BATCH . ') q', [$last])->m ?? null;
                if (! $max) {
                    continue;
                }

                $imported += DB::affectingStatement(
                    'INSERT IGNORE INTO system_logs ' . self::COLS . ' ' . $select . " WHERE {$alias}.id > ? AND {$alias}.id <= ?",
                    [$last, (int) $max]
                );

                DB::statement('INSERT INTO system_log_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [$key, (string) $max]);
            } catch (\Throwable $e) {
                report($e); // một bảng lỗi không được làm hỏng các bảng còn lại
            }
        }

        if ($imported > 0) {
            try {
                (new AlertEvaluator())->evaluateAll();
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return $imported;
    }
}
