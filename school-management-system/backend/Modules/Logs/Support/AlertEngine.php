<?php

namespace Modules\Logs\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Đánh giá luật cảnh báo mỗi khi có log mới. Chống trùng: cùng luật + cùng đối tượng
 * chỉ sinh 1 cảnh báo đang mở trong cửa sổ thời gian của luật.
 */
class AlertEngine
{
    public static function evaluate(int $logId, array $row): void
    {
        try {
            $rules = DB::table('sm_log_alert_rules')->where('enabled', 1)->get();

            foreach ($rules as $rule) {
                switch ($rule->rule_type) {
                    case 'failed_logins':
                        self::failedLogins($rule, $logId, $row);
                        break;
                    case 'critical_event':
                        if ($row['severity'] === 'critical') {
                            self::raise($rule, "log:$logId", $logId, $row,
                                'Sự kiện nghiêm trọng: ' . $row['action'], $row['summary']);
                        }
                        break;
                    case 'off_hours_login':
                        self::offHours($rule, $logId, $row);
                        break;
                    case 'mass_action':
                        self::massAction($rule, $logId, $row);
                        break;
                }
            }
        } catch (\Throwable $ex) {
            Log::error('AlertEngine failed: ' . $ex->getMessage());
        }
    }

    private static function failedLogins(object $rule, int $logId, array $row): void
    {
        if ($row['action'] !== 'login_failed') {
            return;
        }
        $since = Clock::now()->subMinutes(max(1, (int) $rule->window_minutes))->format('Y-m-d H:i:s');

        foreach (['ip' => $row['ip'], 'actor_name' => $row['actor_name']] as $col => $val) {
            if (! $val) {
                continue;
            }
            $n = DB::table('sm_audit_logs')->where('action', 'login_failed')
                ->where($col, $val)->where('occurred_at', '>=', $since)->count();

            if ($n >= $rule->threshold) {
                $label = $col === 'ip' ? "IP {$val}" : "tài khoản {$val}";
                self::raise($rule, "{$col}:{$val}", $logId, $row,
                    "Đăng nhập sai {$n} lần từ {$label}",
                    "{$n} lần thất bại trong {$rule->window_minutes} phút gần nhất.");
            }
        }
    }

    private static function offHours(object $rule, int $logId, array $row): void
    {
        if ($row['action'] !== 'login' || $row['status'] !== 'success' || $row['actor_type'] !== 'staff') {
            return;
        }
        $h = (int) substr($row['occurred_at'], 11, 2);
        if ($h >= 6 && $h < 22) {
            return;
        }
        self::raise($rule, 'actor:' . $row['actor_id'] . ':' . substr($row['occurred_at'], 0, 10), $logId, $row,
            'Đăng nhập ngoài giờ: ' . ($row['actor_name'] ?? 'không rõ'),
            'Đăng nhập lúc ' . substr($row['occurred_at'], 11, 5) . ' từ IP ' . ($row['ip'] ?? '?'));
    }

    private static function massAction(object $rule, int $logId, array $row): void
    {
        $prefix = (string) $rule->match_action;
        if ($prefix === '' || ! $row['actor_id'] || ! str_starts_with($row['action'], $prefix)) {
            return;
        }
        $since = Clock::now()->subMinutes(max(1, (int) $rule->window_minutes))->format('Y-m-d H:i:s');
        $n = DB::table('sm_audit_logs')->where('actor_type', $row['actor_type'])->where('actor_id', $row['actor_id'])
            ->where('action', 'like', $prefix . '%')->where('occurred_at', '>=', $since)->count();

        if ($n >= $rule->threshold) {
            self::raise($rule, 'actor:' . $row['actor_id'], $logId, $row,
                $rule->name . ': ' . ($row['actor_name'] ?? 'không rõ'),
                "{$n} thao tác \"{$prefix}*\" trong {$rule->window_minutes} phút.");
        }
    }

    private static function raise(object $rule, string $key, int $logId, array $row, string $title, string $detail): void
    {
        $window = max(1, (int) $rule->window_minutes ?: 60);
        $since = Clock::now()->subMinutes($window)->format('Y-m-d H:i:s');

        $exists = DB::table('sm_log_alerts')->where('rule_id', $rule->id)->where('dedup_key', $key)
            ->where('status', 'open')->where('created_at', '>=', $since)->exists();
        if ($exists) {
            return;
        }

        DB::table('sm_log_alerts')->insert([
            'rule_id'     => $rule->id,
            'dedup_key'   => mb_substr($key, 0, 120),
            'severity'    => $rule->severity,
            'title'       => mb_substr($title, 0, 160),
            'detail'      => mb_substr($detail, 0, 500),
            'ref_log_id'  => $logId,
            'actor_label' => $row['actor_name'] ?? null,
            'ip'          => $row['ip'] ?? null,
            'status'      => 'open',
            'created_at'  => Clock::nowSql(),
        ]);
    }
}
