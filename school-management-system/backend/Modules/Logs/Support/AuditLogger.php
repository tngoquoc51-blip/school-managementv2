<?php

namespace Modules\Logs\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Ghi nhật ký kiểm toán. Dùng được từ BẤT KỲ module nào:
 *
 *   use Modules\Logs\Support\AuditLogger;
 *
 *   AuditLogger::log([
 *       'module'       => 'exam',
 *       'action'       => 'grade.update',
 *       'entity_type'  => 'grade',
 *       'entity_id'    => $grade->id,
 *       'entity_label' => 'Điểm Toán 10A1 - Nguyễn Văn A',
 *       'summary'      => 'Sửa điểm giữa kỳ 1',
 *       'old_values'   => ['score' => 6.5],
 *       'new_values'   => ['score' => 8.0],
 *       'severity'     => 'notice',
 *   ]);
 *
 * Không bao giờ ném exception: lỗi ghi log không được làm hỏng nghiệp vụ chính.
 */
class AuditLogger
{
    public const MODULES = ['auth', 'student', 'teacher', 'academic', 'exam', 'attendance',
        'finance', 'notification', 'report', 'system', 'security'];

    public const SEVERITIES = ['info', 'notice', 'warning', 'critical'];

    public const STATUSES = ['success', 'failed', 'denied'];

    private const SENSITIVE_KEYS = ['password', 'password_confirmation', 'old_password', 'new_password',
        'token', 'api_token', 'access_token', 'refresh_token', 'secret', 'cvv', 'card_number'];

    /** @return int|null id bản ghi vừa tạo */
    public static function log(array $e): ?int
    {
        try {
            $req = app()->bound('request') ? request() : null;
            $actor = empty($e['src_table']) ? $req?->attributes->get('log_actor') : null;
            $g = fn (string $k, $d) => array_key_exists($k, $e) ? $e[$k] : $d;

            $row = [
                'request_id'   => $g('request_id', $req?->attributes->get('log_request_id') ?? (string) Str::uuid()),
                'occurred_at'  => $e['occurred_at'] ?? Clock::nowMs(),
                'actor_type'   => $e['actor_type'] ?? ($actor ? 'staff' : 'system'),
                'actor_id'     => $e['actor_id'] ?? ($actor['id'] ?? null),
                'actor_name'   => self::cut($e['actor_name'] ?? ($actor['full_name'] ?? null), 120),
                'actor_role'   => $e['actor_role'] ?? ($actor['role'] ?? null),
                'module'       => in_array($e['module'] ?? '', self::MODULES, true) ? $e['module'] : 'system',
                'action'       => self::cut($e['action'] ?? 'event', 60),
                'entity_type'  => self::cut($e['entity_type'] ?? null, 40),
                'entity_id'    => isset($e['entity_id']) ? self::cut((string) $e['entity_id'], 64) : null,
                'entity_label' => self::cut($e['entity_label'] ?? null, 160),
                'severity'     => in_array($e['severity'] ?? '', self::SEVERITIES, true) ? $e['severity'] : 'info',
                'status'       => in_array($e['status'] ?? '', self::STATUSES, true) ? $e['status'] : 'success',
                'summary'      => self::cut($e['summary'] ?? ($e['action'] ?? 'event'), 255),
                'old_values'   => self::json($e['old_values'] ?? null),
                'new_values'   => self::json($e['new_values'] ?? null),
                'meta'         => self::json($e['meta'] ?? null),
                'ip'           => $g('ip', $req?->ip()),
                'user_agent'   => self::cut($g('user_agent', $req?->userAgent()), 255),
                'method'       => $g('method', $req?->method()),
                'path'         => self::cut($g('path', $req ? '/' . ltrim($req->path(), '/') : null), 255),
                'duration_ms'  => $e['duration_ms'] ?? null,
                'src_table'    => $e['src_table'] ?? null,
                'src_id'       => $e['src_id'] ?? null,
            ];

            $id = DB::transaction(function () use ($row) {
                $useChain = (string) DB::table('sm_log_settings')->where('k', 'hash_chain')->value('v') !== '0';

                if ($useChain) {
                    $prev = DB::selectOne('SELECT row_hash FROM sm_audit_logs ORDER BY id DESC LIMIT 1 FOR UPDATE');
                    $row['prev_hash'] = $prev->row_hash ?? str_repeat('0', 64);
                    $row['row_hash']  = self::hash($row);
                }

                return DB::table('sm_audit_logs')->insertGetId($row);
            });

            if (empty($e['no_alert'])) {
                AlertEngine::evaluate($id, $row);
            }

            return $id;
        } catch (\Throwable $ex) {
            Log::error('AuditLogger failed: ' . $ex->getMessage());
            return null;
        }
    }

    /** Băm có chuỗi: đổi/xoá/chèn bất kỳ dòng nào sẽ làm hỏng chuỗi phía sau. */
    public static function hash(array $r): string
    {
        $canon = implode('|', [
            $r['prev_hash'] ?? '',
            $r['occurred_at'],
            $r['actor_type'],
            $r['actor_id'] ?? '',
            $r['module'],
            $r['action'],
            $r['entity_type'] ?? '',
            $r['entity_id'] ?? '',
            $r['severity'],
            $r['status'],
            $r['summary'],
            $r['ip'] ?? '',
        ]);

        return hash('sha256', $canon);
    }

    /** Loại mật khẩu / token khỏi dữ liệu trước khi lưu. */
    public static function scrub($data)
    {
        if (! is_array($data)) {
            return $data;
        }
        foreach ($data as $k => $v) {
            if (is_string($k) && in_array(strtolower($k), self::SENSITIVE_KEYS, true)) {
                $data[$k] = '***';
            } elseif (is_array($v)) {
                $data[$k] = self::scrub($v);
            }
        }
        return $data;
    }

    private static function json($v): ?string
    {
        if ($v === null || $v === []) {
            return null;
        }
        return json_encode(self::scrub($v), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private static function cut(?string $s, int $max): ?string
    {
        return $s === null ? null : mb_substr($s, 0, $max);
    }
}
