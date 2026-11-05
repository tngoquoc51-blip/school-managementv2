<?php

namespace Modules\Logs\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logs\Repositories\LogRepository;
use Modules\Logs\Support\AuditLogger;
use Modules\Logs\Support\Clock;

class LogService
{
    public function __construct(private LogRepository $repo) {}

    public function repo(): LogRepository
    {
        return $this->repo;
    }

    /* ----------------------------------------------------------- đọc */

    public function detail(int $id): ?array
    {
        $row = $this->repo->find($id);
        if (! $row) {
            return null;
        }
        $diff = [];
        $keys = array_unique(array_merge(array_keys($row->old_values ?? []), array_keys($row->new_values ?? [])));
        foreach ($keys as $k) {
            $o = $row->old_values[$k] ?? null;
            $n = $row->new_values[$k] ?? null;
            $diff[] = ['field' => $k, 'old' => $o, 'new' => $n, 'changed' => $o !== $n];
        }
        return ['log' => $row, 'diff' => $diff, 'related' => $this->repo->related($row)];
    }

    /* ------------------------------------------------------- xuất CSV */

    public function exportCsv(array $filters, array $actor)
    {
        $max = (int) ($this->repo->settings()['export_max_rows'] ?? 50000);
        $q = $this->repo->applyFilters(DB::table('sm_audit_logs'), $filters)->orderByDesc('occurred_at');
        $count = min($max, (clone $q)->count());

        AuditLogger::log([
            'module' => 'security', 'action' => 'logs.export', 'severity' => 'notice',
            'summary' => "{$actor['full_name']} xuất {$count} dòng nhật ký (CSV)",
            'meta' => ['filters' => $filters, 'rows' => $count],
        ]);

        $name = 'nhat-ky-' . Clock::now()->format('Ymd-His') . '.csv';

        return response()->streamDownload(function () use ($q, $max) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM để Excel đọc đúng tiếng Việt
            fputcsv($out, ['ID', 'Thời gian', 'Người thực hiện', 'Vai trò', 'Phân hệ', 'Hành động', 'Đối tượng',
                'Mức độ', 'Trạng thái', 'Mô tả', 'IP', 'Method', 'Đường dẫn']);
            $n = 0;
            foreach ($q->cursor() as $r) {
                if ($n++ >= $max) break;
                fputcsv($out, [$r->id, $r->occurred_at, $r->actor_name, $r->actor_role, $r->module, $r->action,
                    trim(($r->entity_type ?? '') . ' ' . ($r->entity_label ?? $r->entity_id ?? '')),
                    $r->severity, $r->status, $r->summary, $r->ip, $r->method, $r->path]);
            }
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /* ----------------------------------------------- toàn vẹn dữ liệu */

    public function verifyChain(array $actor): array
    {
        $prev = str_repeat('0', 64);
        $checked = 0; $broken = null; $unchained = 0; $first = true;

        DB::table('sm_audit_logs')->orderBy('id')->chunk(1000, function ($rows) use (&$prev, &$checked, &$broken, &$unchained, &$first) {
            foreach ($rows as $r) {
                if (! $r->row_hash) { $unchained++; continue; }
                $arr = (array) $r;
                // Sau khi xoá bản ghi cũ theo chính sách lưu trữ, dòng đầu tiên còn lại là mốc bắt đầu chuỗi
                if ($first) { $prev = $r->prev_hash; $first = false; }
                $arr['prev_hash'] = $prev;
                if ($r->prev_hash !== $prev || AuditLogger::hash($arr) !== $r->row_hash) {
                    $broken = (int) $r->id;
                    return false;
                }
                $prev = $r->row_hash;
                $checked++;
            }
        });

        $result = ['ok' => $broken === null, 'checked' => $checked, 'unchained' => $unchained, 'first_broken_id' => $broken,
            'verified_at' => Clock::nowSql()];

        $this->setting('last_verify_at', $result['verified_at'], $actor['full_name']);
        $this->setting('last_verify_result', $result['ok'] ? 'ok' : 'broken:' . $broken, $actor['full_name']);

        AuditLogger::log([
            'module' => 'security', 'action' => 'logs.verify', 'status' => $result['ok'] ? 'success' : 'failed',
            'severity' => $result['ok'] ? 'info' : 'critical',
            'summary' => $result['ok'] ? "Kiểm tra toàn vẹn: {$checked} bản ghi hợp lệ"
                : "PHÁT HIỆN nhật ký bị can thiệp tại bản ghi #{$broken}",
            'meta' => $result,
        ]);

        return $result;
    }

    /* ---------------------------------------------- nhập log cũ vào */

    public function importLegacy(array $actor): array
    {
        $sources = [
            'sm_fee_audit' => fn ($r) => [
                'module' => 'finance', 'action' => 'fee.' . $r->action, 'entity_type' => 'fee_item', 'entity_id' => $r->fee_item_id,
                'summary' => 'Khoản thu: ' . $r->action . ($r->detail ? ' ' . mb_substr($r->detail, 0, 180) : ''),
                'actor_type' => $r->actor_id ? 'staff' : 'system', 'actor_id' => $r->actor_id, 'ip' => $r->ip, 'at' => $r->created_at,
                'severity' => 'notice',
            ],
            'sm_fee_period_log' => fn ($r) => [
                'module' => 'finance', 'action' => 'period.' . $r->action, 'entity_type' => 'fee_period', 'entity_id' => $r->period_id,
                'summary' => 'Đợt thu: ' . $r->action . ($r->detail ? ' — ' . $r->detail : ''),
                'actor_type' => 'staff', 'actor_name' => $r->actor, 'at' => $r->created_at, 'severity' => 'info',
            ],
            'sm_payment_log' => fn ($r) => [
                'module' => 'finance', 'action' => 'payment.' . $r->action, 'entity_type' => 'payment', 'entity_id' => $r->payment_id,
                'summary' => 'Phiếu thu: ' . $r->action . ($r->detail ? ' — ' . $r->detail : ''),
                'actor_type' => 'staff', 'actor_name' => $r->actor, 'at' => $r->created_at,
                'severity' => in_array($r->action, ['reject', 'void'], true) ? 'warning' : 'info',
            ],
            'sm_security_audit' => fn ($r) => [
                'module' => 'security', 'action' => $r->action, 'entity_type' => $r->target_table, 'entity_id' => $r->target_id,
                'summary' => 'Bảo mật: ' . $r->action . ($r->target_table ? " ({$r->target_table})" : ''),
                'actor_type' => $r->actor_type, 'actor_id' => $r->actor_id, 'ip' => $r->ip, 'at' => $r->created_at,
                'meta' => $r->meta_json ? json_decode($r->meta_json, true) : null, 'severity' => 'notice',
            ],
            'sm_staff_activity' => fn ($r) => [
                'module' => 'system', 'action' => 'staff.activity', 'summary' => $r->action . ($r->detail ? ' — ' . $r->detail : ''),
                'actor_type' => 'staff', 'actor_id' => $r->user_id, 'ip' => $r->ip, 'at' => $r->created_at, 'severity' => 'info',
            ],
        ];

        $staffNames = DB::table('sm_staff_accounts')->pluck('full_name', 'id');
        $report = [];

        foreach ($sources as $table => $map) {
            $done = DB::table('sm_audit_logs')->where('src_table', $table)->pluck('src_id')->flip();
            $n = 0;

            DB::table($table)->orderBy('id')->chunk(500, function ($rows) use ($table, $map, $done, $staffNames, &$n) {
                foreach ($rows as $r) {
                    if (isset($done[$r->id])) continue;
                    $e = $map($r);
                    $e['actor_name'] ??= $e['actor_id'] ? ($staffNames[$e['actor_id']] ?? null) : 'Hệ thống';
                    $e['occurred_at'] = Carbon::parse($e['at'])->format('Y-m-d H:i:s') . '.000';
                    unset($e['at']);
                    $e['src_table'] = $table; $e['src_id'] = $r->id;
                    $e['no_alert'] = true; $e['request_id'] = null;
                    $e['ip'] = $e['ip'] ?? null; $e['user_agent'] = null; $e['method'] = null; $e['path'] = null;
                    AuditLogger::log($e);
                    $n++;
                }
            });
            $report[$table] = $n;
        }

        AuditLogger::log([
            'module' => 'security', 'action' => 'logs.import_legacy', 'severity' => 'notice',
            'summary' => 'Nhập nhật ký cũ vào hệ thống nhật ký trung tâm: ' . array_sum($report) . ' dòng',
            'meta' => $report,
        ]);

        return $report;
    }

    /* ------------------------------------------------------ cấu hình */

    public function setting(string $k, ?string $v, string $by): void
    {
        DB::table('sm_log_settings')->updateOrInsert(['k' => $k], ['v' => $v, 'updated_by' => $by, 'updated_at' => Clock::nowSql()]);
    }
}
