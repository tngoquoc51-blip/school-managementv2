<?php

namespace App\Support;

use App\Services\SystemLog\AlertEvaluator;
use App\Support\SystemLog\Clock;
use App\Support\SystemLog\Sanitizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * GHI NHẬT KÝ HỆ THỐNG — gọi ở bất cứ đâu trong code:
 *
 *   AuditLogger::info('finance.collect', 'Thu học phí HS 25001', ['subject_type' => 'payment', 'subject_id' => 15]);
 *   AuditLogger::warning('auth.login_failed', 'Sai mật khẩu', ['actor_name' => $username]);
 *   AuditLogger::data('sm_students', 25001, $before, $after, 'Sửa hồ sơ học sinh');   // lưu cả trước/sau
 *
 * Không bao giờ ném lỗi ra ngoài: nếu bảng chưa có thì bỏ qua để không làm hỏng chức năng chính.
 */
class AuditLogger
{
    public const LEVELS = ['debug' => 10, 'info' => 20, 'notice' => 30, 'warning' => 40, 'error' => 50, 'critical' => 60];

    public static function levelNo(string $level): int
    {
        return self::LEVELS[$level] ?? 20;
    }

    public static function log(array $e, ?Request $request = null): ?int
    {
        try {
            $request ??= app()->bound('request') ? request() : null;
            $level = isset(self::LEVELS[$e['level'] ?? '']) ? $e['level'] : 'info';

            $row = [
                'occurred_at' => Clock::fmt(Clock::now()),
                'level' => $level,
                'level_no' => self::LEVELS[$level],
                'category' => mb_substr((string) ($e['category'] ?? 'system'), 0, 20),
                'action' => mb_substr((string) ($e['action'] ?? 'event'), 0, 80),
                'actor_type' => $e['actor_type'] ?? null,
                'actor_id' => $e['actor_id'] ?? null,
                'actor_name' => isset($e['actor_name']) ? mb_substr((string) $e['actor_name'], 0, 120) : null,
                'subject_type' => $e['subject_type'] ?? null,
                'subject_id' => isset($e['subject_id']) ? mb_substr((string) $e['subject_id'], 0, 64) : null,
                'summary' => mb_substr((string) ($e['summary'] ?? $e['action'] ?? 'Sự kiện'), 0, 500),
                'ip_address' => $e['ip_address'] ?? $request?->ip(),
                'user_agent' => $request ? mb_substr((string) $request->userAgent(), 0, 255) : null,
                'http_method' => $e['http_method'] ?? $request?->method(),
                'route' => isset($e['route']) ? mb_substr((string) $e['route'], 0, 190) : null,
                'status_code' => $e['status_code'] ?? null,
                'duration_ms' => $e['duration_ms'] ?? null,
                'request_id' => $e['request_id'] ?? self::requestId($request),
                'source' => $e['source'] ?? 'app',
                'old_values' => Sanitizer::json($e['old'] ?? null),
                'new_values' => Sanitizer::json($e['new'] ?? null),
                'meta' => Sanitizer::json($e['meta'] ?? null),
            ];

            DB::insert(
                'INSERT INTO system_logs (' . implode(',', array_keys($row)) . ') VALUES (' . implode(',', array_fill(0, count($row), '?')) . ')',
                array_values($row)
            );
            $id = (int) DB::getPdo()->lastInsertId();

            if (empty($e['skip_alerts']) && $row['level_no'] >= 20) {
                AlertEvaluator::onEvent($row);
            }

            return $id;
        } catch (\Throwable $ex) {
            report($ex);

            return null;
        }
    }

    public static function debug(string $action, string $summary, array $ctx = []): ?int { return self::log(['level' => 'debug', 'action' => $action, 'summary' => $summary] + $ctx + ['category' => self::guess($action)]); }
    public static function info(string $action, string $summary, array $ctx = []): ?int { return self::log(['level' => 'info', 'action' => $action, 'summary' => $summary] + $ctx + ['category' => self::guess($action)]); }
    public static function notice(string $action, string $summary, array $ctx = []): ?int { return self::log(['level' => 'notice', 'action' => $action, 'summary' => $summary] + $ctx + ['category' => self::guess($action)]); }
    public static function warning(string $action, string $summary, array $ctx = []): ?int { return self::log(['level' => 'warning', 'action' => $action, 'summary' => $summary] + $ctx + ['category' => self::guess($action)]); }
    public static function error(string $action, string $summary, array $ctx = []): ?int { return self::log(['level' => 'error', 'action' => $action, 'summary' => $summary] + $ctx + ['category' => self::guess($action)]); }
    public static function critical(string $action, string $summary, array $ctx = []): ?int { return self::log(['level' => 'critical', 'action' => $action, 'summary' => $summary] + $ctx + ['category' => self::guess($action)]); }

    /** Ghi thay đổi dữ liệu kèm giá trị TRƯỚC / SAU (hiển thị dạng so sánh trong trang Kiểm toán). */
    public static function data(string $table, int|string $id, ?array $old, ?array $new, string $summary, array $ctx = []): ?int
    {
        $action = $ctx['action'] ?? ('data.' . ($old === null ? 'create' : ($new === null ? 'delete' : 'update')));

        return self::log([
            'level' => $new === null ? 'notice' : 'info',
            'category' => 'data',
            'action' => $action,
            'summary' => $summary,
            'subject_type' => $table,
            'subject_id' => $id,
            'old' => $old,
            'new' => $new,
        ] + $ctx);
    }

    private static function guess(string $action): string
    {
        $p = strstr($action, '.', true) ?: $action;

        return in_array($p, ['auth', 'security', 'data', 'finance', 'academic', 'student', 'admin', 'system', 'api'], true) ? $p : 'system';
    }

    private static function requestId(?Request $request): string
    {
        if (! $request) {
            return strtoupper(bin2hex(random_bytes(8)));
        }
        if (! ($id = $request->attributes->get('request_id'))) {
            $id = strtoupper(bin2hex(random_bytes(8)));
            $request->attributes->set('request_id', $id);
        }

        return $id;
    }
}
