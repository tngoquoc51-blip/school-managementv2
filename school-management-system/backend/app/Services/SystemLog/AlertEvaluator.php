<?php

namespace App\Services\SystemLog;

use App\Support\AuditLogger;
use App\Support\SystemLog\Clock;
use Illuminate\Support\Facades\DB;

/**
 * Đánh giá quy tắc cảnh báo: nếu số sự kiện khớp trong khung thời gian >= ngưỡng
 * thì mở một "sự cố" (incident). Chạy ngay sau khi ghi sự kiện, sau khi nhập dữ liệu,
 * và định kỳ qua lệnh `php artisan logs:sync`.
 */
class AlertEvaluator
{
    public static function onEvent(array $event): void
    {
        try {
            $rules = DB::select(
                'SELECT * FROM system_log_rules WHERE enabled = 1 AND (category IS NULL OR category = ?) AND min_level_no <= ?',
                [(string) ($event['category'] ?? ''), (int) ($event['level_no'] ?? 20)]
            );
            $self = new self();
            foreach ($rules as $r) {
                $self->evaluateRule($r);
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /** @return int số sự cố mới mở */
    public function evaluateAll(): int
    {
        $opened = 0;
        foreach (DB::select('SELECT * FROM system_log_rules WHERE enabled = 1') as $r) {
            if ($this->evaluateRule($r)) {
                $opened++;
            }
        }

        return $opened;
    }

    /** @return array{0:string,1:array} */
    private function matchSql(object $r): array
    {
        $w = "occurred_at >= ? AND level_no >= ? AND action <> 'system.incident_opened'";
        $b = [Clock::fmt(Clock::ago((int) $r->window_minutes . ' minutes')), (int) $r->min_level_no];
        if ($r->category) {
            $w .= ' AND category = ?';
            $b[] = $r->category;
        }
        if ($r->action_pattern) {
            $w .= ' AND action LIKE ?';
            $b[] = $r->action_pattern;
        }

        return [$w, $b];
    }

    public function countMatches(object $r): int
    {
        [$w, $b] = $this->matchSql($r);

        return (int) DB::selectOne("SELECT COUNT(*) AS c FROM system_logs WHERE {$w}", $b)->c;
    }

    public function evaluateRule(object $r): ?int
    {
        $count = $this->countMatches($r);
        if ($count < (int) $r->threshold) {
            return null;
        }

        // "Chiếm" quyền mở sự cố một cách nguyên tử để không mở trùng khi nhiều request cùng lúc
        $claimed = DB::update(
            'UPDATE system_log_rules SET last_triggered_at = ? WHERE id = ? AND (last_triggered_at IS NULL OR last_triggered_at < ?)',
            [Clock::fmt(Clock::now()), $r->id, Clock::fmt(Clock::ago((int) $r->cooldown_minutes . ' minutes'))]
        );
        if (! $claimed) {
            return null;
        }

        [$w, $b] = $this->matchSql($r);
        $lastId = DB::selectOne("SELECT MAX(id) AS m FROM system_logs WHERE {$w}", $b)->m ?? null;
        $title = "{$r->name}: {$count} sự kiện trong {$r->window_minutes} phút";

        DB::insert(
            'INSERT INTO system_log_incidents (rule_id, status, severity, title, detail, matched_count, last_log_id, triggered_at) VALUES (?,?,?,?,?,?,?,?)',
            [$r->id, 'open', $r->severity, mb_substr($title, 0, 200), $r->description, $count, $lastId, Clock::fmt(Clock::now())]
        );
        $incidentId = (int) DB::getPdo()->lastInsertId();

        AuditLogger::log([
            'level' => in_array($r->severity, ['warning', 'error', 'critical'], true) ? $r->severity : 'warning',
            'category' => 'system',
            'action' => 'system.incident_opened',
            'actor_type' => 'system',
            'summary' => $title,
            'meta' => ['rule_id' => (int) $r->id, 'incident_id' => $incidentId, 'matched' => $count],
            'skip_alerts' => true,
        ]);

        return $incidentId;
    }
}
