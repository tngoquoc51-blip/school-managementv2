<?php

namespace App\Services\SystemLog;

use App\Support\AuditLogger;
use App\Support\SystemLog\Anomaly;
use App\Support\SystemLog\Clock;
use App\Support\SystemLog\Diff;
use App\Support\SystemLog\Health;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Truy vấn nhật ký hệ thống. Toàn bộ là SQL thuần + tham số ràng buộc (an toàn SQL injection),
 * chạy được trên MySQL 8 (Laragon) và MariaDB.
 */
class SystemLogService
{
    public const CATEGORIES = [
        'auth' => 'Đăng nhập', 'security' => 'Bảo mật', 'data' => 'Dữ liệu', 'finance' => 'Tài chính',
        'academic' => 'Học vụ', 'student' => 'Học sinh', 'admin' => 'Quản trị', 'system' => 'Hệ thống', 'api' => 'API',
    ];

    private const LIST_COLS = 'l.id, l.occurred_at, l.level, l.level_no, l.category, l.action, l.actor_type, l.actor_id, l.actor_name,
        l.subject_type, l.subject_id, l.summary, l.ip_address, l.http_method, l.route, l.status_code, l.duration_ms, l.request_id, l.source';

    /* ===================================================================== */
    /*  Tiện ích                                                              */
    /* ===================================================================== */

    private function rangeStart(string $r, DateTimeImmutable $now): DateTimeImmutable
    {
        return match ($r) {
            '1h' => $now->modify('-1 hour'),
            '7d' => $now->modify('-7 days'),
            '30d' => $now->modify('-30 days'),
            '90d' => $now->modify('-90 days'),
            default => $now->modify('-24 hours'),
        };
    }

    private function parseDate(string $v, bool $endOfDay): string
    {
        $d = (new DateTimeImmutable($v))->setTimezone(new DateTimeZone(date_default_timezone_get()));
        if (strlen($v) <= 10) {
            $d = $endOfDay ? $d->setTime(23, 59, 59) : $d->setTime(0, 0, 0);
        }

        return Clock::fmt($d);
    }

    private function csv(mixed $v): array
    {
        $arr = is_array($v) ? $v : explode(',', (string) $v);

        return array_values(array_filter(array_map('trim', $arr), fn ($x) => $x !== ''));
    }

    private function like(string $v): string
    {
        return '%' . addcslashes($v, '%_\\') . '%';
    }

    private function decode(?string $json): mixed
    {
        return $json === null || $json === '' ? null : json_decode($json, true);
    }

    /** @return array{0:string,1:array} */
    private function where(array $f, ?int $uid): array
    {
        $w = ['1=1'];
        $b = [];
        $now = Clock::now();

        if (! empty($f['from'])) {
            $w[] = 'l.occurred_at >= ?';
            $b[] = $this->parseDate($f['from'], false);
        } elseif (! empty($f['range']) && $f['range'] !== 'all') {
            $w[] = 'l.occurred_at >= ?';
            $b[] = Clock::fmt($this->rangeStart((string) $f['range'], $now));
        }
        if (! empty($f['to'])) {
            $w[] = 'l.occurred_at <= ?';
            $b[] = $this->parseDate($f['to'], true);
        }
        foreach (['level' => 'l.level', 'category' => 'l.category', 'actor_type' => 'l.actor_type'] as $key => $col) {
            $vals = $this->csv($f[$key] ?? null);
            if ($vals) {
                $w[] = "{$col} IN (" . implode(',', array_fill(0, count($vals), '?')) . ')';
                array_push($b, ...$vals);
            }
        }
        if (! empty($f['min_level'])) {
            $w[] = 'l.level_no >= ?';
            $b[] = AuditLogger::levelNo((string) $f['min_level']);
        }
        if (! empty($f['action'])) {
            $w[] = 'l.action LIKE ?';
            $b[] = str_replace('*', '%', (string) $f['action']);
        }
        if (! empty($f['actor'])) {
            $a = trim((string) $f['actor']);
            $w[] = '(l.actor_name LIKE ? OR l.actor_id = ?)';
            $b[] = $this->like($a);
            $b[] = ctype_digit($a) ? (int) $a : -1;
        }
        if (! empty($f['ip'])) {
            $w[] = 'l.ip_address LIKE ?';
            $b[] = $this->like(trim((string) $f['ip']));
        }
        if (! empty($f['source'])) {
            $w[] = 'l.source LIKE ?';
            $b[] = trim((string) $f['source']) . '%';
        }
        if (! empty($f['request_id'])) {
            $w[] = 'l.request_id = ?';
            $b[] = (string) $f['request_id'];
        }
        if (! empty($f['subject_type'])) {
            $w[] = 'l.subject_type = ?';
            $b[] = (string) $f['subject_type'];
        }
        if (! empty($f['subject_id'])) {
            $w[] = 'l.subject_id = ?';
            $b[] = (string) $f['subject_id'];
        }
        if (! empty($f['status']) && preg_match('/^([2-5])xx$/', (string) $f['status'], $m)) {
            $w[] = 'l.status_code BETWEEN ? AND ?';
            $b[] = $m[1] * 100;
            $b[] = $m[1] * 100 + 99;
        }
        if (! empty($f['q'])) {
            $like = $this->like(trim((string) $f['q']));
            $w[] = '(l.summary LIKE ? OR l.action LIKE ? OR l.actor_name LIKE ? OR l.ip_address LIKE ? OR l.route LIKE ? OR l.subject_id LIKE ?)';
            array_push($b, $like, $like, $like, $like, $like, $like);
        }
        if (! empty($f['pinned']) && $uid) {
            $w[] = 'EXISTS (SELECT 1 FROM system_log_pins pp WHERE pp.log_id = l.id AND pp.user_id = ?)';
            $b[] = $uid;
        }

        return [implode(' AND ', $w), $b];
    }

    private function row(object $r): array
    {
        return [
            'id' => (int) $r->id,
            'occurred_at' => Clock::iso($r->occurred_at),
            'level' => $r->level,
            'level_no' => (int) $r->level_no,
            'category' => $r->category,
            'action' => $r->action,
            'actor' => ['type' => $r->actor_type, 'id' => $r->actor_id !== null ? (int) $r->actor_id : null, 'name' => $r->actor_name],
            'subject' => ['type' => $r->subject_type, 'id' => $r->subject_id],
            'summary' => $r->summary,
            'ip_address' => $r->ip_address,
            'http_method' => $r->http_method,
            'route' => $r->route,
            'status_code' => $r->status_code !== null ? (int) $r->status_code : null,
            'duration_ms' => $r->duration_ms !== null ? (int) $r->duration_ms : null,
            'request_id' => $r->request_id,
            'source' => $r->source,
            'pinned' => ! empty($r->pinned),
            'has_diff' => ! empty($r->has_diff),
        ];
    }

    /* ===================================================================== */
    /*  Danh sách / chi tiết / luồng trực tiếp / xuất                         */
    /* ===================================================================== */

    public function list(array $f, ?int $uid): array
    {
        [$where, $b] = $this->where($f, $uid);
        $per = max(5, min((int) ($f['per_page'] ?? 25), 200));
        $page = max(1, (int) ($f['page'] ?? 1));
        $off = ($page - 1) * $per;

        $total = (int) DB::selectOne("SELECT COUNT(*) AS c FROM system_logs l WHERE {$where}", $b)->c;
        $sortCol = ['occurred_at' => 'l.occurred_at', 'level_no' => 'l.level_no', 'duration_ms' => 'l.duration_ms', 'id' => 'l.id'][$f['sort'] ?? ''] ?? 'l.occurred_at';
        $dir = (($f['dir'] ?? 'desc') === 'asc') ? 'ASC' : 'DESC';

        $rows = DB::select(
            'SELECT ' . self::LIST_COLS . ',
                EXISTS (SELECT 1 FROM system_log_pins p WHERE p.log_id = l.id AND p.user_id = ?) AS pinned,
                (l.old_values IS NOT NULL OR l.new_values IS NOT NULL) AS has_diff
             FROM system_logs l WHERE ' . $where . " ORDER BY {$sortCol} {$dir}, l.id DESC LIMIT {$per} OFFSET {$off}",
            array_merge([$uid ?? 0], $b)
        );

        return [
            'items' => array_map(fn ($r) => $this->row($r), $rows),
            'meta' => ['total' => $total, 'current_page' => $page, 'per_page' => $per, 'last_page' => max(1, (int) ceil($total / $per))],
        ];
    }

    public function show(int $id, ?int $uid): ?array
    {
        $r = DB::selectOne(
            'SELECT l.*, (l.old_values IS NOT NULL OR l.new_values IS NOT NULL) AS has_diff,
                    p.note AS pin_note, (p.id IS NOT NULL) AS pinned
             FROM system_logs l LEFT JOIN system_log_pins p ON p.log_id = l.id AND p.user_id = ? WHERE l.id = ?',
            [$uid ?? 0, $id]
        );
        if (! $r) {
            return null;
        }

        $event = $this->row($r) + [
            'user_agent' => $r->user_agent,
            'old_values' => $this->decode($r->old_values),
            'new_values' => $this->decode($r->new_values),
            'meta' => $this->decode($r->meta),
            'pin_note' => $r->pin_note,
            'diff' => Diff::compute($this->decode($r->old_values), $this->decode($r->new_values)),
        ];

        $cols = self::LIST_COLS;
        $related = ['same_request' => [], 'same_actor' => [], 'same_ip' => []];

        if ($r->request_id) {
            $related['same_request'] = DB::select("SELECT {$cols} FROM system_logs l WHERE l.request_id = ? AND l.id <> ? ORDER BY l.occurred_at, l.id LIMIT 20", [$r->request_id, $id]);
        }
        $t0 = (new DateTimeImmutable($r->occurred_at));
        $from = Clock::fmt($t0->modify('-10 minutes'));
        $to = Clock::fmt($t0->modify('+10 minutes'));
        if ($r->actor_id !== null && $r->actor_type) {
            $related['same_actor'] = DB::select(
                "SELECT {$cols} FROM system_logs l WHERE l.actor_type = ? AND l.actor_id = ? AND l.id <> ? AND l.occurred_at BETWEEN ? AND ? ORDER BY l.occurred_at LIMIT 15",
                [$r->actor_type, $r->actor_id, $id, $from, $to]
            );
        }
        if ($r->ip_address) {
            $related['same_ip'] = DB::select(
                "SELECT {$cols} FROM system_logs l WHERE l.ip_address = ? AND l.id <> ? AND l.occurred_at BETWEEN ? AND ? ORDER BY l.occurred_at LIMIT 15",
                [$r->ip_address, $id, $from, $to]
            );
        }
        foreach ($related as $k => $rows) {
            $related[$k] = array_map(fn ($x) => $this->row($x), $rows);
        }

        return ['event' => $event, 'related' => $related];
    }

    /** Luồng trực tiếp: sự kiện mới hơn $afterId, theo cùng bộ lọc. */
    public function stream(int $afterId, array $f, ?int $uid): array
    {
        (new LegacyLogImporter())->syncThrottled();
        [$where, $b] = $this->where($f, $uid);
        $rows = DB::select(
            'SELECT ' . self::LIST_COLS . ', 0 AS pinned, 0 AS has_diff FROM system_logs l WHERE l.id > ? AND ' . $where . ' ORDER BY l.id ASC LIMIT 100',
            array_merge([$afterId], $b)
        );
        $last = (int) (DB::selectOne('SELECT MAX(id) AS m FROM system_logs')->m ?? 0);

        return ['items' => array_map(fn ($r) => $this->row($r), $rows), 'last_id' => $last];
    }

    /** Tối đa 5.000 dòng cho xuất CSV/JSON. */
    public function exportRows(array $f, ?int $uid): array
    {
        [$where, $b] = $this->where($f, $uid);
        $rows = DB::select(
            'SELECT l.*, 0 AS pinned, 0 AS has_diff FROM system_logs l WHERE ' . $where . ' ORDER BY l.occurred_at DESC, l.id DESC LIMIT 5000',
            $b
        );

        return array_map(fn ($r) => $this->row($r) + ['user_agent' => $r->user_agent, 'old_values' => $this->decode($r->old_values), 'new_values' => $this->decode($r->new_values), 'meta' => $this->decode($r->meta)], $rows);
    }

    /* ===================================================================== */
    /*  Tổng quan                                                             */
    /* ===================================================================== */

    public function overview(string $range): array
    {
        (new LegacyLogImporter())->syncThrottled();
        $range = in_array($range, ['24h', '7d', '30d'], true) ? $range : '24h';
        $now = Clock::now();
        $start = $this->rangeStart($range, $now);
        $spanSec = $now->getTimestamp() - $start->getTimestamp();
        $prevStart = $start->modify("-{$spanSec} seconds");
        $future = Clock::fmt($now->modify('+1 minute'));

        $kpi = function (DateTimeImmutable $from, string $to): array {
            $r = DB::selectOne(
                "SELECT COUNT(*) AS total, COALESCE(SUM(level_no >= 50),0) AS errors, COALESCE(SUM(level_no = 40),0) AS warnings,
                        COALESCE(SUM(level_no >= 60),0) AS critical, COALESCE(SUM(action = 'auth.login_failed'),0) AS failed_logins,
                        COALESCE(SUM(action = 'auth.login'),0) AS logins, COUNT(DISTINCT actor_type, actor_id) AS actors, COUNT(DISTINCT ip_address) AS ips
                 FROM system_logs WHERE occurred_at >= ? AND occurred_at < ?",
                [Clock::fmt($from), $to]
            );

            return array_map('intval', (array) $r);
        };
        $cur = $kpi($start, $future);
        $prev = $kpi($prevStart, Clock::fmt($start));
        $delta = fn (int $c, int $p) => $p > 0 ? (int) round(($c - $p) / $p * 100) : null;
        $kpis = [];
        foreach (['total', 'errors', 'warnings', 'failed_logins', 'actors', 'ips', 'critical', 'logins'] as $k) {
            $kpis[$k] = ['value' => $cur[$k], 'previous' => $prev[$k], 'delta' => $delta($cur[$k], $prev[$k])];
        }

        // ----- chuỗi thời gian -----
        [$expr, $stepSec, $align] = match ($range) {
            '24h' => ["DATE_FORMAT(occurred_at, '%Y-%m-%d %H:00:00')", 3600, fn ($d) => $d->setTime((int) $d->format('H'), 0)],
            '7d' => ["CONCAT(DATE(occurred_at), ' ', LPAD(FLOOR(HOUR(occurred_at) / 6) * 6, 2, '0'), ':00:00')", 21600, fn ($d) => $d->setTime((int) floor((int) $d->format('H') / 6) * 6, 0)],
            default => ["CONCAT(DATE(occurred_at), ' 00:00:00')", 86400, fn ($d) => $d->setTime(0, 0)],
        };
        $bStart = $align($start);
        $bucketRows = DB::select(
            "SELECT {$expr} AS b, COALESCE(SUM(level_no < 40),0) AS ok, COALESCE(SUM(level_no = 40),0) AS warning, COALESCE(SUM(level_no >= 50),0) AS error
             FROM system_logs WHERE occurred_at >= ? GROUP BY b ORDER BY b",
            [Clock::fmt($bStart)]
        );
        $byB = [];
        foreach ($bucketRows as $r) {
            $byB[$r->b] = $r;
        }
        $series = [];
        for ($t = $bStart->getTimestamp(); $t <= $now->getTimestamp(); $t += $stepSec) {
            $k = date('Y-m-d H:i:s', $t);
            $r = $byB[$k] ?? null;
            $series[] = ['t' => date(DATE_ATOM, $t), 'ok' => (int) ($r->ok ?? 0), 'warning' => (int) ($r->warning ?? 0), 'error' => (int) ($r->error ?? 0)];
        }

        $fromS = Clock::fmt($start);
        $byCategory = array_map(fn ($r) => ['key' => $r->category, 'label' => self::CATEGORIES[$r->category] ?? $r->category, 'count' => (int) $r->c, 'issues' => (int) $r->issues],
            DB::select('SELECT category, COUNT(*) AS c, COALESCE(SUM(level_no >= 40),0) AS issues FROM system_logs WHERE occurred_at >= ? GROUP BY category ORDER BY c DESC', [$fromS]));
        $byLevel = array_map(fn ($r) => ['key' => $r->level, 'count' => (int) $r->c],
            DB::select('SELECT level, COUNT(*) AS c FROM system_logs WHERE occurred_at >= ? GROUP BY level ORDER BY MAX(level_no) DESC', [$fromS]));
        $topActors = array_map(fn ($r) => ['type' => $r->actor_type, 'id' => $r->actor_id !== null ? (int) $r->actor_id : null, 'name' => $r->actor_name, 'count' => (int) $r->c, 'issues' => (int) $r->issues],
            DB::select('SELECT actor_type, actor_id, actor_name, COUNT(*) AS c, COALESCE(SUM(level_no >= 40),0) AS issues FROM system_logs
                        WHERE occurred_at >= ? AND (actor_id IS NOT NULL OR actor_name IS NOT NULL) GROUP BY actor_type, actor_id, actor_name ORDER BY c DESC LIMIT 8', [$fromS]));
        $topIps = array_map(fn ($r) => ['ip' => $r->ip_address, 'count' => (int) $r->c, 'failed' => (int) $r->failed],
            DB::select("SELECT ip_address, COUNT(*) AS c, COALESCE(SUM(action = 'auth.login_failed'),0) AS failed FROM system_logs
                        WHERE occurred_at >= ? AND ip_address IS NOT NULL GROUP BY ip_address ORDER BY c DESC LIMIT 8", [$fromS]));

        // ----- bản đồ nhiệt: giờ × thứ, 30 ngày gần nhất -----
        $heat = array_fill(0, 7, array_fill(0, 24, 0));
        foreach (DB::select('SELECT (DAYOFWEEK(occurred_at) + 5) % 7 AS d, HOUR(occurred_at) AS h, COUNT(*) AS c FROM system_logs WHERE occurred_at >= ? GROUP BY d, h', [Clock::fmt($now->modify('-30 days'))]) as $r) {
            $heat[(int) $r->d][(int) $r->h] = (int) $r->c;
        }

        // ----- bất thường: giờ hiện tại so với cùng khung giờ 7 ngày trước -----
        $hourly = ['all' => [], 'errors' => []];
        foreach (DB::select("SELECT category, DATE_FORMAT(occurred_at, '%Y-%m-%d %H') AS k, COUNT(*) AS c, COALESCE(SUM(level_no >= 50),0) AS e
                             FROM system_logs WHERE occurred_at >= ? GROUP BY category, k", [Clock::fmt($now->modify('-8 days'))]) as $r) {
            $hourly[$r->category][$r->k] = (int) $r->c;
            $hourly['all'][$r->k] = ($hourly['all'][$r->k] ?? 0) + (int) $r->c;
            $hourly['errors'][$r->k] = ($hourly['errors'][$r->k] ?? 0) + (int) $r->e;
        }
        $labels = ['all' => 'Tất cả sự kiện', 'errors' => 'Lỗi (Error trở lên)'] + self::CATEGORIES;
        $anomalies = array_map(fn ($a) => $a + ['label' => $labels[$a['scope']] ?? $a['scope']], Anomaly::detect($hourly, $now));

        // ----- sự cố + sức khỏe -----
        $open = ['warning' => 0, 'error' => 0, 'critical' => 0];
        foreach (DB::select("SELECT severity, COUNT(*) AS c FROM system_log_incidents WHERE status = 'open' GROUP BY severity") as $r) {
            $open[$r->severity] = (int) $r->c;
        }
        $health = Health::score([
            'total' => $cur['total'], 'errors' => $cur['errors'], 'critical' => $cur['critical'],
            'failed_logins' => $cur['failed_logins'], 'logins' => $cur['logins'],
            'open_warning' => $open['warning'], 'open_error' => $open['error'], 'open_critical' => $open['critical'],
        ]);

        // ----- API + nguồn dữ liệu -----
        $api = null;
        $n = (int) DB::selectOne('SELECT COUNT(*) AS c FROM system_logs WHERE duration_ms IS NOT NULL AND occurred_at >= ?', [$fromS])->c;
        if ($n > 0) {
            $avg = (float) DB::selectOne('SELECT AVG(duration_ms) AS a FROM system_logs WHERE duration_ms IS NOT NULL AND occurred_at >= ?', [$fromS])->a;
            $p95 = (int) (DB::selectOne('SELECT duration_ms AS d FROM system_logs WHERE duration_ms IS NOT NULL AND occurred_at >= ? ORDER BY duration_ms LIMIT 1 OFFSET ' . (int) max(0, floor($n * 0.95) - ($n > 1 ? 1 : 0)), [$fromS])->d ?? 0);
            $api = ['count' => $n, 'avg_ms' => (int) round($avg), 'p95_ms' => $p95];
        }
        $sources = array_map(fn ($r) => ['source' => $r->source, 'count' => (int) $r->c, 'last_at' => Clock::iso($r->last_at)],
            DB::select('SELECT source, COUNT(*) AS c, MAX(occurred_at) AS last_at FROM system_logs GROUP BY source ORDER BY c DESC'));
        $recentSevere = array_map(fn ($r) => $this->row($r),
            DB::select('SELECT ' . self::LIST_COLS . ', 0 AS pinned, 0 AS has_diff FROM system_logs l WHERE l.level_no >= 50 ORDER BY l.occurred_at DESC, l.id DESC LIMIT 5'));

        return [
            'range' => $range,
            'kpis' => $kpis,
            'series' => $series,
            'by_category' => $byCategory,
            'by_level' => $byLevel,
            'top_actors' => $topActors,
            'top_ips' => $topIps,
            'heatmap' => $heat,
            'anomalies' => $anomalies,
            'health' => $health,
            'open_incidents' => $open,
            'api' => $api,
            'sources' => $sources,
            'recent_severe' => $recentSevere,
            'generated_at' => date(DATE_ATOM),
        ];
    }

    /* ===================================================================== */
    /*  Bảo mật                                                               */
    /* ===================================================================== */

    public function security(): array
    {
        (new LegacyLogImporter())->syncThrottled();
        $now = Clock::now();
        $d1 = Clock::fmt($now->modify('-24 hours'));
        $d7 = Clock::fmt($now->modify('-7 days'));
        $d30 = Clock::fmt($now->modify('-30 days'));

        // đăng nhập sai theo giờ (24h)
        $start = $now->modify('-23 hours');
        $start = $start->setTime((int) $start->format('H'), 0);
        $by = [];
        foreach (DB::select("SELECT DATE_FORMAT(occurred_at, '%Y-%m-%d %H:00:00') AS b, COUNT(*) AS c FROM system_logs WHERE action = 'auth.login_failed' AND occurred_at >= ? GROUP BY b", [Clock::fmt($start)]) as $r) {
            $by[$r->b] = (int) $r->c;
        }
        $timeline = [];
        for ($t = $start->getTimestamp(); $t <= $now->getTimestamp(); $t += 3600) {
            $timeline[] = ['t' => date(DATE_ATOM, $t), 'count' => $by[date('Y-m-d H:i:s', $t)] ?? 0];
        }

        $suspicious = array_map(function ($r) {
            return [
                'ip' => $r->ip_address,
                'failed' => (int) $r->failed,
                'success' => (int) $r->ok,
                'targets' => (int) $r->targets,
                'last_at' => Clock::iso($r->last_fail),
                // đăng nhập thành công SAU các lần thất bại → nghi ngờ đã dò ra mật khẩu
                'ok_after_fail' => $r->last_ok !== null && $r->last_fail !== null && $r->last_ok > $r->last_fail,
            ];
        }, DB::select(
            "SELECT ip_address, SUM(action = 'auth.login_failed') AS failed, SUM(action = 'auth.login') AS ok,
                    COUNT(DISTINCT COALESCE(actor_name, actor_id)) AS targets,
                    MAX(CASE WHEN action = 'auth.login_failed' THEN occurred_at END) AS last_fail,
                    MAX(CASE WHEN action = 'auth.login' THEN occurred_at END) AS last_ok
             FROM system_logs WHERE ip_address IS NOT NULL AND action IN ('auth.login_failed','auth.login') AND occurred_at >= ?
             GROUP BY ip_address HAVING failed >= 3 ORDER BY failed DESC LIMIT 10", [$d1]
        ));

        $cols = 'l.id, l.occurred_at, l.actor_name, l.actor_type, l.ip_address';
        $offHours = array_map(fn ($r) => $this->mini($r), DB::select(
            "SELECT {$cols} FROM system_logs l WHERE l.action = 'auth.login' AND l.occurred_at >= ? AND (HOUR(l.occurred_at) >= 22 OR HOUR(l.occurred_at) < 5) ORDER BY l.occurred_at DESC LIMIT 15", [$d7]
        ));
        $newIps = array_map(fn ($r) => $this->mini($r), DB::select(
            "SELECT {$cols} FROM system_logs l
             WHERE l.action = 'auth.login' AND l.occurred_at >= ? AND l.ip_address IS NOT NULL AND l.actor_id IS NOT NULL
               AND EXISTS (SELECT 1 FROM system_logs q WHERE q.action = 'auth.login' AND q.actor_type = l.actor_type AND q.actor_id = l.actor_id AND q.occurred_at < l.occurred_at)
               AND NOT EXISTS (SELECT 1 FROM system_logs p WHERE p.action = 'auth.login' AND p.actor_type = l.actor_type AND p.actor_id = l.actor_id
                               AND p.ip_address = l.ip_address AND p.occurred_at < l.occurred_at AND p.occurred_at >= DATE_SUB(l.occurred_at, INTERVAL 30 DAY))
             ORDER BY l.occurred_at DESC LIMIT 15", [$d7]
        ));

        $locked = [];
        try {
            if (Schema::hasTable('sm_staff_accounts')) {
                $locked = array_map(fn ($r) => [
                    'id' => (int) $r->id, 'username' => $r->username, 'full_name' => $r->full_name, 'role' => $r->role,
                    'failed_attempts' => (int) $r->failed_attempts, 'locked_until' => Clock::iso($r->locked_until),
                    'is_locked' => $r->locked_until !== null && $r->locked_until > Clock::fmt($now),
                ], DB::select('SELECT id, username, full_name, role, failed_attempts, locked_until FROM sm_staff_accounts
                               WHERE (locked_until IS NOT NULL AND locked_until > ?) OR failed_attempts >= 3 ORDER BY failed_attempts DESC LIMIT 20', [Clock::fmt($now)]));
            }
        } catch (\Throwable $e) {
            report($e);
        }

        $sum = DB::selectOne(
            "SELECT COALESCE(SUM(action = 'auth.login_failed' AND occurred_at >= ?),0) AS failed24,
                    COALESCE(SUM(action = 'auth.login' AND occurred_at >= ?),0) AS ok24,
                    COALESCE(SUM(action LIKE 'export%' AND occurred_at >= ?),0) AS exports7,
                    COALESCE(SUM(action = 'security.access_denied' AND occurred_at >= ?),0) AS denied24
             FROM system_logs WHERE occurred_at >= ?", [$d1, $d1, $d7, $d1, $d7]
        );

        return [
            'summary' => ['failed_24h' => (int) $sum->failed24, 'success_24h' => (int) $sum->ok24, 'exports_7d' => (int) $sum->exports7, 'denied_24h' => (int) $sum->denied24],
            'failed_timeline' => $timeline,
            'suspicious_ips' => $suspicious,
            'off_hours_logins' => $offHours,
            'new_ip_logins' => $newIps,
            'locked_accounts' => $locked,
            'since_30d' => $d30,
        ];
    }

    private function mini(object $r): array
    {
        return ['id' => (int) $r->id, 'occurred_at' => Clock::iso($r->occurred_at), 'actor_name' => $r->actor_name, 'actor_type' => $r->actor_type, 'ip' => $r->ip_address];
    }

    /** Mở khóa tài khoản cán bộ (đặt lại số lần sai + bỏ thời gian khóa). */
    public function unlockStaff(int $id, ?int $uid, ?string $byName): bool
    {
        $acc = DB::selectOne('SELECT id, username, full_name FROM sm_staff_accounts WHERE id = ?', [$id]);
        if (! $acc) {
            return false;
        }
        DB::update('UPDATE sm_staff_accounts SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [$id]);
        AuditLogger::log([
            'level' => 'notice', 'category' => 'security', 'action' => 'security.account_unlocked',
            'actor_type' => 'admin', 'actor_id' => $uid, 'actor_name' => $byName,
            'subject_type' => 'sm_staff_accounts', 'subject_id' => $id,
            'summary' => "Mở khóa tài khoản {$acc->username} ({$acc->full_name})",
        ]);

        return true;
    }

    /* ===================================================================== */
    /*  Kiểm toán dữ liệu (trước / sau)                                       */
    /* ===================================================================== */

    public function audit(array $f): array
    {
        [$where, $b] = $this->where($f, null);
        $where .= " AND (l.category = 'data' OR l.old_values IS NOT NULL OR l.new_values IS NOT NULL)";
        $per = max(5, min((int) ($f['per_page'] ?? 15), 50));
        $page = max(1, (int) ($f['page'] ?? 1));
        $off = ($page - 1) * $per;

        $total = (int) DB::selectOne("SELECT COUNT(*) AS c FROM system_logs l WHERE {$where}", $b)->c;
        $rows = DB::select("SELECT l.*, 0 AS pinned, 1 AS has_diff FROM system_logs l WHERE {$where} ORDER BY l.occurred_at DESC, l.id DESC LIMIT {$per} OFFSET {$off}", $b);

        $items = array_map(function ($r) {
            $old = $this->decode($r->old_values);
            $new = $this->decode($r->new_values);

            return $this->row($r) + ['old_values' => $old, 'new_values' => $new, 'changes' => Diff::compute($old, $new)];
        }, $rows);

        $tables = array_map(fn ($r) => ['table' => $r->subject_type, 'count' => (int) $r->c],
            DB::select("SELECT subject_type, COUNT(*) AS c FROM system_logs WHERE (category = 'data' OR old_values IS NOT NULL OR new_values IS NOT NULL) AND subject_type IS NOT NULL
                        GROUP BY subject_type ORDER BY c DESC LIMIT 30"));

        return [
            'items' => $items,
            'tables' => $tables,
            'meta' => ['total' => $total, 'current_page' => $page, 'per_page' => $per, 'last_page' => max(1, (int) ceil($total / $per))],
        ];
    }

    /* ===================================================================== */
    /*  Bộ lọc đã lưu, ghim & ghi chú                                         */
    /* ===================================================================== */

    public function views(int $uid): array
    {
        return array_map(fn ($r) => ['id' => (int) $r->id, 'name' => $r->name, 'filters' => $this->decode($r->filters) ?? [], 'shared' => (bool) $r->is_shared, 'mine' => (int) $r->user_id === $uid],
            DB::select('SELECT id, user_id, name, filters, is_shared FROM system_log_views WHERE user_id = ? OR is_shared = 1 ORDER BY name', [$uid]));
    }

    public function saveView(int $uid, string $name, array $filters, bool $shared): array
    {
        if ((int) DB::selectOne('SELECT COUNT(*) AS c FROM system_log_views WHERE user_id = ?', [$uid])->c >= 30) {
            throw new \DomainException('Bạn đã lưu tối đa 30 bộ lọc. Hãy xóa bớt trước khi thêm.');
        }
        DB::insert('INSERT INTO system_log_views (user_id, name, filters, is_shared) VALUES (?,?,?,?)', [$uid, mb_substr($name, 0, 80), json_encode($filters, JSON_UNESCAPED_UNICODE), $shared ? 1 : 0]);

        return $this->views($uid);
    }

    public function deleteView(int $uid, int $id): bool
    {
        return DB::delete('DELETE FROM system_log_views WHERE id = ? AND user_id = ?', [$id, $uid]) > 0;
    }

    public function pin(int $logId, int $uid, ?string $note): bool
    {
        if (! DB::selectOne('SELECT id FROM system_logs WHERE id = ?', [$logId])) {
            return false;
        }
        DB::statement('INSERT INTO system_log_pins (log_id, user_id, note) VALUES (?,?,?) ON DUPLICATE KEY UPDATE note = VALUES(note)', [$logId, $uid, $note !== null ? mb_substr($note, 0, 500) : null]);

        return true;
    }

    public function unpin(int $logId, int $uid): void
    {
        DB::delete('DELETE FROM system_log_pins WHERE log_id = ? AND user_id = ?', [$logId, $uid]);
    }

    /* ===================================================================== */
    /*  Siêu dữ liệu, cài đặt, lưu trữ & dọn dẹp                              */
    /* ===================================================================== */

    public function meta(bool $canManage): array
    {
        $actions = array_map(fn ($r) => ['action' => $r->action, 'count' => (int) $r->c],
            DB::select('SELECT action, COUNT(*) AS c FROM system_logs GROUP BY action ORDER BY c DESC LIMIT 80'));
        $sources = array_column(array_map(fn ($r) => (array) $r, DB::select("SELECT DISTINCT SUBSTRING_INDEX(source, ':', 1) AS s FROM system_logs ORDER BY s")), 's');

        return [
            'levels' => array_map(fn ($k, $v) => ['key' => $k, 'no' => $v], array_keys(AuditLogger::LEVELS), array_values(AuditLogger::LEVELS)),
            'categories' => array_map(fn ($k, $v) => ['key' => $k, 'label' => $v], array_keys(self::CATEGORIES), array_values(self::CATEGORIES)),
            'actions' => $actions,
            'sources' => $sources,
            'can_manage' => $canManage,
            'total' => (int) DB::selectOne('SELECT COUNT(*) AS c FROM system_logs')->c,
        ];
    }

    public function settings(): array
    {
        $out = [];
        foreach (DB::select('SELECT setting_key, setting_value FROM system_log_settings') as $r) {
            $out[$r->setting_key] = $r->setting_value;
        }

        return $out;
    }

    public function retention(): array
    {
        $s = $this->settings();
        $out = [];
        foreach (AuditLogger::LEVELS as $lvl => $_) {
            $out[$lvl] = (int) ($s["retention.{$lvl}"] ?? 365);
        }

        return $out;
    }

    /** @param array<string,int|string> $days  ['debug'=>7, ...] */
    public function updateRetention(array $days, ?int $uid, ?string $name): array
    {
        foreach (AuditLogger::LEVELS as $lvl => $_) {
            if (isset($days[$lvl])) {
                $v = max(1, min(3650, (int) $days[$lvl]));
                DB::statement('INSERT INTO system_log_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', ["retention.{$lvl}", (string) $v]);
            }
        }
        AuditLogger::log(['level' => 'notice', 'category' => 'admin', 'action' => 'admin.log_retention_changed', 'actor_type' => 'admin', 'actor_id' => $uid, 'actor_name' => $name,
            'summary' => 'Thay đổi chính sách lưu giữ nhật ký', 'new' => $this->retention()]);

        return $this->retention();
    }

    public function storage(): array
    {
        $ret = $this->retention();
        $levels = [];
        foreach (DB::select('SELECT level, COUNT(*) AS c, MIN(occurred_at) AS oldest, MAX(occurred_at) AS newest FROM system_logs GROUP BY level') as $r) {
            $levels[$r->level] = $r;
        }
        $out = [];
        foreach (AuditLogger::LEVELS as $lvl => $no) {
            $r = $levels[$lvl] ?? null;
            $cut = Clock::fmt(Clock::ago($ret[$lvl] . ' days'));
            $expired = (int) DB::selectOne(
                'SELECT COUNT(*) AS c FROM system_logs l WHERE l.level = ? AND l.occurred_at < ? AND NOT EXISTS (SELECT 1 FROM system_log_pins p WHERE p.log_id = l.id)', [$lvl, $cut]
            )->c;
            $out[] = ['level' => $lvl, 'no' => $no, 'count' => (int) ($r->c ?? 0), 'oldest' => Clock::iso($r->oldest ?? null), 'newest' => Clock::iso($r->newest ?? null), 'retention_days' => $ret[$lvl], 'expired' => $expired];
        }
        $size = DB::selectOne("SELECT COALESCE(SUM(data_length + index_length),0) AS bytes FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'system_log%'");

        return [
            'levels' => $out,
            'total' => array_sum(array_column($out, 'count')),
            'expired_total' => array_sum(array_column($out, 'expired')),
            'bytes' => (int) ($size->bytes ?? 0),
            'pins' => (int) DB::selectOne('SELECT COUNT(*) AS c FROM system_log_pins')->c,
            'retention' => $ret,
        ];
    }

    /** Xóa sự kiện quá hạn lưu giữ (không xóa sự kiện đang được ghim). $dry=true chỉ đếm. */
    public function purge(bool $dry, ?int $uid = null, ?string $name = null): array
    {
        $ret = $this->retention();
        $detail = [];
        $total = 0;
        foreach (AuditLogger::LEVELS as $lvl => $_) {
            $cut = Clock::fmt(Clock::ago($ret[$lvl] . ' days'));
            $where = 'level = ? AND occurred_at < ? AND NOT EXISTS (SELECT 1 FROM system_log_pins p WHERE p.log_id = system_logs.id)';
            $count = (int) DB::selectOne("SELECT COUNT(*) AS c FROM system_logs WHERE {$where}", [$lvl, $cut])->c;
            $deleted = 0;
            if (! $dry && $count > 0) {
                do {
                    $n = DB::delete("DELETE FROM system_logs WHERE {$where} LIMIT 5000", [$lvl, $cut]);
                    $deleted += $n;
                } while ($n === 5000 && $deleted < 1000000);
            }
            $total += $dry ? $count : $deleted;
            $detail[] = ['level' => $lvl, 'days' => $ret[$lvl], 'matched' => $count, 'deleted' => $deleted];
        }
        if (! $dry && $total > 0) {
            AuditLogger::log(['level' => 'notice', 'category' => 'admin', 'action' => 'admin.log_purged', 'actor_type' => $uid ? 'admin' : 'system', 'actor_id' => $uid, 'actor_name' => $name ?? 'Hệ thống',
                'summary' => "Dọn dẹp {$total} sự kiện quá hạn lưu giữ", 'meta' => ['detail' => $detail]]);
        }

        return ['dry_run' => $dry, 'total' => $total, 'detail' => $detail];
    }

    /** Ghi một sự kiện thử để quản trị viên xem luồng trực tiếp / thử quy tắc cảnh báo. */
    public function testEvent(string $level, ?int $uid, ?string $name): int
    {
        return (int) AuditLogger::log([
            'level' => isset(AuditLogger::LEVELS[$level]) ? $level : 'info', 'category' => 'system', 'action' => 'system.test_event',
            'actor_type' => 'admin', 'actor_id' => $uid, 'actor_name' => $name, 'source' => 'manual',
            'summary' => 'Sự kiện thử do quản trị viên tạo (' . strtoupper($level) . ')',
        ]);
    }
}
