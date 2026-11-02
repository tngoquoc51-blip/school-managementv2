<?php

namespace App\Services\SystemLog;

use App\Support\AuditLogger;
use App\Support\SystemLog\Clock;
use Illuminate\Support\Facades\DB;

/** Quy tắc cảnh báo + sự cố (xem, thêm, sửa, xóa, xác nhận, đóng). */
class AlertService
{
    public function rules(): array
    {
        $rows = DB::select(
            "SELECT r.*, (SELECT COUNT(*) FROM system_log_incidents i WHERE i.rule_id = r.id AND i.status <> 'resolved') AS open_incidents
             FROM system_log_rules r ORDER BY r.enabled DESC, r.id"
        );
        $ev = new AlertEvaluator();

        return array_map(function ($r) use ($ev) {
            return $this->ruleRow($r) + ['open_incidents' => (int) $r->open_incidents, 'matching_now' => $ev->countMatches($r)];
        }, $rows);
    }

    private function ruleRow(object $r): array
    {
        $names = array_flip(AuditLogger::LEVELS);

        return [
            'id' => (int) $r->id, 'name' => $r->name, 'description' => $r->description, 'category' => $r->category,
            'action_pattern' => $r->action_pattern, 'min_level' => $names[(int) $r->min_level_no] ?? 'info', 'min_level_no' => (int) $r->min_level_no,
            'threshold' => (int) $r->threshold, 'window_minutes' => (int) $r->window_minutes, 'cooldown_minutes' => (int) $r->cooldown_minutes,
            'severity' => $r->severity, 'enabled' => (bool) $r->enabled, 'last_triggered_at' => Clock::iso($r->last_triggered_at),
        ];
    }

    /** @return array rule đã lưu | ném DomainException nếu trùng tên */
    public function saveRule(?int $id, array $d, ?int $uid): array
    {
        $levelNo = AuditLogger::levelNo((string) ($d['min_level'] ?? 'info'));
        $vals = [
            mb_substr((string) $d['name'], 0, 120), $d['description'] ?? null, $d['category'] ?? null, $d['action_pattern'] ?? null,
            $levelNo, (int) $d['threshold'], (int) $d['window_minutes'], (int) ($d['cooldown_minutes'] ?? 30), $d['severity'], ! empty($d['enabled']) ? 1 : 0,
        ];
        $dup = DB::selectOne('SELECT id FROM system_log_rules WHERE name = ? AND id <> ?', [$vals[0], $id ?? 0]);
        if ($dup) {
            throw new \DomainException('Đã có quy tắc cùng tên.');
        }

        if ($id) {
            DB::update('UPDATE system_log_rules SET name=?, description=?, category=?, action_pattern=?, min_level_no=?, threshold=?, window_minutes=?, cooldown_minutes=?, severity=?, enabled=? WHERE id=?', [...$vals, $id]);
        } else {
            DB::insert('INSERT INTO system_log_rules (name, description, category, action_pattern, min_level_no, threshold, window_minutes, cooldown_minutes, severity, enabled, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [...$vals, $uid]);
            $id = (int) DB::getPdo()->lastInsertId();
        }
        AuditLogger::log(['level' => 'notice', 'category' => 'admin', 'action' => $d['_new'] ?? false ? 'admin.alert_rule_created' : 'admin.alert_rule_saved', 'actor_type' => 'admin', 'actor_id' => $uid,
            'subject_type' => 'system_log_rules', 'subject_id' => $id, 'summary' => 'Lưu quy tắc cảnh báo: ' . $vals[0], 'skip_alerts' => true]);

        return $this->ruleRow(DB::selectOne('SELECT * FROM system_log_rules WHERE id = ?', [$id]));
    }

    public function deleteRule(int $id, ?int $uid): bool
    {
        $r = DB::selectOne('SELECT name FROM system_log_rules WHERE id = ?', [$id]);
        if (! $r) {
            return false;
        }
        DB::delete('DELETE FROM system_log_rules WHERE id = ?', [$id]);
        AuditLogger::log(['level' => 'notice', 'category' => 'admin', 'action' => 'admin.alert_rule_deleted', 'actor_type' => 'admin', 'actor_id' => $uid, 'summary' => 'Xóa quy tắc cảnh báo: ' . $r->name, 'skip_alerts' => true]);

        return true;
    }

    /** Chạy thử quy tắc (chưa lưu): trả về số sự kiện đang khớp. */
    public function testRule(array $d): array
    {
        $rule = (object) [
            'window_minutes' => (int) $d['window_minutes'], 'min_level_no' => AuditLogger::levelNo((string) ($d['min_level'] ?? 'info')),
            'category' => $d['category'] ?? null, 'action_pattern' => $d['action_pattern'] ?? null,
        ];
        $n = (new AlertEvaluator())->countMatches($rule);

        return ['matching' => $n, 'would_trigger' => $n >= (int) $d['threshold'], 'threshold' => (int) $d['threshold']];
    }

    public function evaluateNow(): int
    {
        (new LegacyLogImporter())->sync();

        return (new AlertEvaluator())->evaluateAll();
    }

    /* ---------------- sự cố ---------------- */

    public function incidents(array $f): array
    {
        $status = $f['status'] ?? '';
        $w = '1=1';
        $b = [];
        if (in_array($status, ['open', 'acknowledged', 'resolved'], true)) {
            $w = 'i.status = ?';
            $b[] = $status;
        } elseif ($status === 'active') {
            $w = "i.status <> 'resolved'";
        }
        $per = max(5, min((int) ($f['per_page'] ?? 15), 50));
        $page = max(1, (int) ($f['page'] ?? 1));
        $off = ($page - 1) * $per;

        $total = (int) DB::selectOne("SELECT COUNT(*) AS c FROM system_log_incidents i WHERE {$w}", $b)->c;
        $rows = DB::select(
            "SELECT i.*, r.name AS rule_name, ua.name AS ack_name, ur.name AS res_name
             FROM system_log_incidents i
             LEFT JOIN system_log_rules r ON r.id = i.rule_id
             LEFT JOIN users ua ON ua.id = i.acknowledged_by
             LEFT JOIN users ur ON ur.id = i.resolved_by
             WHERE {$w} ORDER BY FIELD(i.status,'open','acknowledged','resolved'), i.triggered_at DESC LIMIT {$per} OFFSET {$off}", $b
        );
        $counts = ['open' => 0, 'acknowledged' => 0, 'resolved' => 0];
        foreach (DB::select('SELECT status, COUNT(*) AS c FROM system_log_incidents GROUP BY status') as $r) {
            $counts[$r->status] = (int) $r->c;
        }

        return [
            'items' => array_map(fn ($r) => [
                'id' => (int) $r->id, 'rule_id' => $r->rule_id !== null ? (int) $r->rule_id : null, 'rule_name' => $r->rule_name, 'status' => $r->status, 'severity' => $r->severity,
                'title' => $r->title, 'detail' => $r->detail, 'matched_count' => (int) $r->matched_count, 'last_log_id' => $r->last_log_id !== null ? (int) $r->last_log_id : null,
                'triggered_at' => Clock::iso($r->triggered_at), 'acknowledged_by' => $r->ack_name, 'acknowledged_at' => Clock::iso($r->acknowledged_at),
                'resolved_by' => $r->res_name, 'resolved_at' => Clock::iso($r->resolved_at), 'note' => $r->note,
            ], $rows),
            'counts' => $counts,
            'meta' => ['total' => $total, 'current_page' => $page, 'per_page' => $per, 'last_page' => max(1, (int) ceil($total / $per))],
        ];
    }

    public function acknowledge(int $id, int $uid): bool
    {
        $n = DB::update("UPDATE system_log_incidents SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = ? WHERE id = ? AND status = 'open'", [$uid, Clock::fmt(Clock::now()), $id]);
        if ($n) {
            AuditLogger::log(['level' => 'info', 'category' => 'admin', 'action' => 'system.incident_acknowledged', 'actor_type' => 'admin', 'actor_id' => $uid, 'subject_type' => 'system_log_incidents', 'subject_id' => $id, 'summary' => "Xác nhận đã nhận sự cố #{$id}", 'skip_alerts' => true]);
        }

        return $n > 0;
    }

    public function resolve(int $id, int $uid, ?string $note): bool
    {
        $n = DB::update("UPDATE system_log_incidents SET status = 'resolved', resolved_by = ?, resolved_at = ?, note = ? WHERE id = ? AND status <> 'resolved'", [$uid, Clock::fmt(Clock::now()), $note !== null ? mb_substr($note, 0, 500) : null, $id]);
        if ($n) {
            AuditLogger::log(['level' => 'info', 'category' => 'admin', 'action' => 'system.incident_resolved', 'actor_type' => 'admin', 'actor_id' => $uid, 'subject_type' => 'system_log_incidents', 'subject_id' => $id, 'summary' => "Đóng sự cố #{$id}", 'skip_alerts' => true]);
        }

        return $n > 0;
    }
}
