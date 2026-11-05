<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Module "Giám sát hệ thống" của cổng Quản trị: /api/gv/monitor/*
 * Bảng: sm_mon_logs, sm_mon_requests, sm_mon_checks, sm_mon_rules, sm_mon_alerts,
 *       sm_mon_announcements, sm_mon_settings.
 * Middleware StaffToken đã xác thực. Quyền:
 *   - Xem: super_admin, principal, vice_principal
 *   - Thao tác (thu hồi phiên, mở khóa, dọn dẹp, sửa cài đặt…): chỉ super_admin
 */
class GvMonitorController extends Controller
{
    private const READ_ROLES = ['super_admin', 'principal', 'vice_principal'];
    private const LEVELS = ['info', 'warn', 'error', 'security'];
    private const SEVERITY = ['warning', 'critical'];
    private const ANN_LEVELS = ['info', 'success', 'warning', 'critical'];
    private const AUDIENCE = ['all', 'staff', 'student'];

    private function db() { return DB::connection(); }
    private function now(): string { return now()->format('Y-m-d H:i:s'); }

    private function fail(string $msg, int $code = 422, array $errors = [])
    {
        $b = ['message' => $msg];
        if ($errors) $b['errors'] = $errors;
        return response()->json($b, $code);
    }

    private function me(Request $r): array
    {
        $s = (array) $r->attributes->get('sm_staff');
        return ['u' => mb_substr((string) ($s['username'] ?? 'staff'), 0, 40), 'n' => mb_substr((string) ($s['name'] ?? 'Quản trị'), 0, 80), 'role' => (string) ($s['role'] ?? '')];
    }

    /** null = được phép; ngược lại trả response 403 */
    private function deny(Request $r, bool $write = false)
    {
        $role = $this->me($r)['role'];
        if ($write) {
            return $role === 'super_admin' ? null : $this->fail('Chỉ tài khoản Quản trị hệ thống mới được thực hiện thao tác này.', 403);
        }
        return in_array($role, self::READ_ROLES, true) ? null : $this->fail('Bạn không có quyền xem khu Giám sát hệ thống.', 403);
    }

    private function setting(string $k, string $def): string
    {
        $r = $this->db()->selectOne('SELECT v FROM sm_mon_settings WHERE k = ?', [$k]);
        return $r ? (string) $r->v : $def;
    }

    private function writeLog(string $level, string $source, string $action, string $msg, ?string $actor = null, ?string $ip = null, ?string $route = null, ?array $ctx = null): void
    {
        $this->db()->insert('INSERT INTO sm_mon_logs (level, source, action, message, actor, ip, route, context, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
            [$level, $source, $action, mb_substr($msg, 0, 500), $actor, $ip, $route, $ctx ? json_encode($ctx, JSON_UNESCAPED_UNICODE) : null, $this->now()]);
    }

    private function rows(array $r): array { return array_map(fn ($x) => (array) $x, $r); }

    private function tableExists(string $t): bool
    {
        return (bool) $this->db()->selectOne('SELECT 1 AS x FROM information_schema.TABLES WHERE table_schema = DATABASE() AND table_name = ?', [$t]);
    }

    // ============================================================ KIỂM TRA DỊCH VỤ
    /** @return array<int,array<string,mixed>> */
    private function runChecks(): array
    {
        $out = [];
        $add = function (string $key, string $name, string $status, string $value, string $detail, int $ms = 0) use (&$out) {
            $out[] = ['key' => $key, 'name' => $name, 'status' => $status, 'value' => $value, 'detail' => $detail, 'ms' => $ms];
        };

        // 1) Cơ sở dữ liệu
        try {
            $t = microtime(true);
            $this->db()->selectOne('SELECT 1 AS ok');
            $ms = (int) round((microtime(true) - $t) * 1000);
            $v = $this->db()->selectOne('SELECT VERSION() AS v')->v ?? '';
            $add('database', 'Cơ sở dữ liệu MySQL', $ms > 500 ? 'fail' : ($ms > 150 ? 'warn' : 'ok'), $ms . ' ms', 'Phiên bản ' . $v, $ms);
        } catch (\Throwable $e) {
            $add('database', 'Cơ sở dữ liệu MySQL', 'fail', 'Mất kết nối', mb_substr($e->getMessage(), 0, 200));
        }

        // 2) Ổ đĩa
        $path = base_path();
        $free = @disk_free_space($path);
        $total = @disk_total_space($path);
        if ($free !== false && $total) {
            $used = round((1 - $free / $total) * 100, 1);
            $add('disk', 'Dung lượng ổ đĩa', $used > 95 ? 'fail' : ($used > 85 ? 'warn' : 'ok'), $used . '% đã dùng', 'Còn trống ' . $this->bytes((float) $free) . ' / ' . $this->bytes((float) $total));
        } else {
            $add('disk', 'Dung lượng ổ đĩa', 'skip', '—', 'Máy chủ không cho đọc dung lượng ổ đĩa.');
        }

        // 3) Thư mục storage ghi được
        $st = storage_path();
        $okW = is_dir($st) && is_writable($st) && is_writable($st . '/logs');
        $add('storage', 'Thư mục storage', $okW ? 'ok' : 'fail', $okW ? 'Ghi được' : 'Không ghi được', $okW ? 'storage/ và storage/logs ghi được.' : 'Laravel không ghi được log/cache. Kiểm tra quyền thư mục storage.');

        // 4) Bộ nhớ đệm
        try {
            $t = microtime(true);
            $k = 'mon_probe_' . bin2hex(random_bytes(3));
            Cache::put($k, 'ok', 30);
            $good = Cache::get($k) === 'ok';
            Cache::forget($k);
            $ms = (int) round((microtime(true) - $t) * 1000);
            $add('cache', 'Bộ nhớ đệm (Cache)', $good ? 'ok' : 'warn', $good ? $ms . ' ms' : 'Không đọc lại được', 'Driver: ' . config('cache.default'), $ms);
        } catch (\Throwable $e) {
            $add('cache', 'Bộ nhớ đệm (Cache)', 'fail', 'Lỗi', mb_substr($e->getMessage(), 0, 200));
        }

        // 5) PHP & extension
        $need = ['pdo_mysql', 'mbstring', 'openssl', 'json', 'ctype', 'fileinfo', 'tokenizer'];
        $miss = array_values(array_filter($need, fn ($e) => !extension_loaded($e)));
        $phpOk = version_compare(PHP_VERSION, '8.1.0', '>=');
        $add('php', 'PHP & phần mở rộng', (!$phpOk || $miss) ? 'fail' : 'ok', 'PHP ' . PHP_VERSION, $miss ? 'Thiếu extension: ' . implode(', ', $miss) : 'Đủ ' . count($need) . ' extension cần thiết.');

        // 6) Chế độ debug
        $env = (string) config('app.env');
        $debug = (bool) config('app.debug');
        $bad = $debug && $env === 'production';
        $add('debug', 'Chế độ môi trường', $bad ? 'warn' : 'ok', $env . ($debug ? ' · debug BẬT' : ' · debug tắt'), $bad ? 'APP_DEBUG đang bật trên production – có thể lộ thông tin lỗi. Hãy đặt APP_DEBUG=false.' : ($debug ? 'Môi trường phát triển – debug bật là bình thường.' : 'Cấu hình an toàn.'));

        // 6b) Cấu hình triển khai (chỉ nghiêm ngặt khi APP_ENV=production)
        $dep = $this->deployIssues();
        if ($env !== 'production') {
            $add('deploy', 'Cấu hình triển khai', 'ok', 'Môi trường ' . $env, 'Chưa phải production nên bỏ qua kiểm tra triển khai. Khi đưa lên máy chủ thật, mục này kiểm tra debug, APP_KEY, https và mật khẩu mặc định.');
        } else {
            $add('deploy', 'Cấu hình triển khai', $dep ? 'warn' : 'ok', $dep ? count($dep) . ' vấn đề' : 'An toàn', $dep ? implode('; ', $dep) . '.' : 'Debug tắt, có APP_KEY, dùng https, không còn mật khẩu mặc định.');
        }

        // 7) Sao lưu
        $bk = $this->lastBackup();
        if ($bk === null) {
            $add('backup', 'Sao lưu dữ liệu', 'skip', 'Chưa có dữ liệu', 'Không đọc được lịch sử sao lưu (hoặc chưa có bản sao lưu nào).');
        } else {
            $h = round((time() - $bk) / 3600, 1);
            $add('backup', 'Sao lưu dữ liệu', $h > 72 ? 'warn' : 'ok', 'Cách đây ' . ($h < 48 ? $h . ' giờ' : round($h / 24, 1) . ' ngày'), 'Bản sao lưu gần nhất lúc ' . date('H:i d/m/Y', $bk) . ' (giờ máy chủ).');
        }

        // 8) Lịch chạy nền: có request ghi nhận gần đây không
        try {
            $last = $this->db()->selectOne('SELECT MAX(created_at) AS t FROM sm_mon_requests');
            if ($last && $last->t) {
                $age = max(0, time() - strtotime($last->t . ' UTC'));
                $add('traffic', 'Luồng truy cập API', $age > 86400 ? 'warn' : 'ok', $age < 120 ? 'Đang hoạt động' : 'Request cuối ' . $this->ago($age), 'Middleware RequestMonitor đang ghi số liệu.');
            } else {
                $add('traffic', 'Luồng truy cập API', 'skip', 'Chưa có số liệu', 'Chưa có request nào được ghi. Hãy bật middleware RequestMonitor (xem HUONG-DAN).');
            }
        } catch (\Throwable $e) {
            $add('traffic', 'Luồng truy cập API', 'fail', 'Lỗi', 'Chưa tạo bảng sm_mon_requests – chạy file SQL M01.');
        }

        return $out;
    }

    /** Số tài khoản nhân viên còn dùng mật khẩu mặc định 123456 (cache 10 phút vì bcrypt chậm) */
    private function defaultPwStaff(): int
    {
        return (int) Cache::remember('mon_default_pw_staff', 600, function () {
            $n = 0;
            foreach ($this->db()->select("SELECT password_hash FROM sm_staff_accounts WHERE status = 'active' LIMIT 50") as $a) {
                if (password_verify('123456', (string) $a->password_hash)) $n++;
            }
            return $n;
        });
    }

    private function deployIssues(): array
    {
        $issues = [];
        if (config('app.env') !== 'production') return $issues;
        if (config('app.debug')) $issues[] = 'APP_DEBUG đang bật';
        if (!config('app.key')) $issues[] = 'APP_KEY chưa đặt';
        if (!str_starts_with((string) config('app.url'), 'https://')) $issues[] = 'APP_URL chưa dùng https://';
        if (($n = $this->defaultPwStaff()) > 0) $issues[] = "$n tài khoản nhân viên còn mật khẩu mặc định";
        return $issues;
    }

    private function lastBackup(): ?int
    {
        foreach (['backups', 'sm_backups', 'db_backups'] as $t) {
            try {
                if (!$this->tableExists($t)) continue;
                $r = $this->db()->selectOne("SELECT MAX(created_at) AS t FROM `$t`");
                if ($r && $r->t) return strtotime($r->t);
            } catch (\Throwable $e) { /* thử bảng khác */ }
        }
        return null;
    }

    private function storeChecks(array $checks): void
    {
        $now = $this->now();
        foreach ($checks as $c) {
            $last = $this->db()->selectOne('SELECT created_at FROM sm_mon_checks WHERE check_key = ? ORDER BY id DESC LIMIT 1', [$c['key']]);
            if ($last && strtotime($last->created_at . ' UTC') > time() - 55) continue; // tối đa 1 lần / phút / dịch vụ
            $this->db()->insert('INSERT INTO sm_mon_checks (check_key, status, value, detail, ms, created_at) VALUES (?,?,?,?,?,?)',
                [$c['key'], $c['status'], mb_substr($c['value'], 0, 120), mb_substr($c['detail'], 0, 300), $c['ms'], $now]);
        }
    }

    private function bytes(float $b): string
    {
        $u = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = 0;
        while ($b >= 1024 && $i < 4) { $b /= 1024; $i++; }
        return round($b, $i > 1 ? 1 : 0) . ' ' . $u[$i];
    }

    private function ago(int $s): string
    {
        if ($s < 60) return $s . ' giây trước';
        if ($s < 3600) return floor($s / 60) . ' phút trước';
        if ($s < 86400) return floor($s / 3600) . ' giờ trước';
        return floor($s / 86400) . ' ngày trước';
    }

    // ============================================================ SỐ LIỆU & CẢNH BÁO
    private function p95(string $where, array $args): int
    {
        $n = (int) ($this->db()->selectOne("SELECT COUNT(*) AS n FROM sm_mon_requests $where", $args)->n ?? 0);
        if ($n === 0) return 0;
        $off = max(0, (int) floor($n * 0.95) - 1);
        $r = $this->db()->selectOne("SELECT ms FROM sm_mon_requests $where ORDER BY ms LIMIT 1 OFFSET $off", $args);
        return (int) ($r->ms ?? 0);
    }

    private function utcAgo(int $seconds): string { return gmdate('Y-m-d H:i:s', time() - $seconds); }

    /** @return array<string,float|int|null> */
    private function metrics(array $checks): array
    {
        $m = [];
        foreach ($checks as $c) {
            if ($c['key'] === 'database') $m['db_ms'] = $c['ms'];
        }
        $free = @disk_free_space(base_path());
        $total = @disk_total_space(base_path());
        $m['disk_used_pct'] = ($free !== false && $total) ? round((1 - $free / $total) * 100, 1) : null;

        $h1 = $this->utcAgo(3600);
        $row = $this->db()->selectOne('SELECT COUNT(*) AS n, SUM(status >= 500) AS e FROM sm_mon_requests WHERE created_at >= ?', [$h1]);
        $n = (int) ($row->n ?? 0);
        $m['error_rate_1h'] = $n >= 20 ? round(((int) $row->e) / $n * 100, 2) : 0;
        $m['p95_ms_1h'] = $this->p95('WHERE created_at >= ?', [$h1]);
        $m['failed_logins_1h'] = (int) $this->db()->selectOne("SELECT COUNT(*) AS n FROM sm_mon_logs WHERE action = 'login_failed' AND created_at >= ?", [$h1])->n;
        $m['errors_24h'] = (int) $this->db()->selectOne("SELECT COUNT(*) AS n FROM sm_mon_logs WHERE level = 'error' AND created_at >= ?", [$this->utcAgo(86400)])->n;
        $m['locked_accounts'] = $this->lockedCount();
        $m['default_pw_staff'] = $this->defaultPwStaff();
        return $m;
    }

    private function lockedCount(): int
    {
        $now = $this->now();
        $a = (int) $this->db()->selectOne('SELECT COUNT(*) AS n FROM sm_staff_accounts WHERE locked_until IS NOT NULL AND locked_until > ?', [$now])->n;
        $b = 0;
        try { $b = (int) $this->db()->selectOne('SELECT COUNT(*) AS n FROM sm_accounts WHERE locked_until IS NOT NULL AND locked_until > ?', [$now])->n; } catch (\Throwable $e) {}
        return $a + $b;
    }

    /** So sánh số liệu với quy tắc, tạo / tự đóng cảnh báo. */
    private function evaluate(array $metrics): void
    {
        $rules = $this->db()->select('SELECT * FROM sm_mon_rules');
        foreach ($rules as $r) {
            $val = $metrics[$r->metric] ?? null;
            $open = $this->db()->selectOne("SELECT id FROM sm_mon_alerts WHERE rule_key = ? AND status IN ('open','ack') ORDER BY id DESC LIMIT 1", [$r->rule_key]);
            $breach = $r->enabled && $val !== null && ($r->op === '>=' ? $val >= (float) $r->threshold : $val > (float) $r->threshold);
            if ($breach && !$open) {
                $this->db()->insert('INSERT INTO sm_mon_alerts (rule_key, severity, title, detail, value, status, created_at) VALUES (?,?,?,?,?,?,?)',
                    [$r->rule_key, $r->severity, $r->name, mb_substr($r->description . " Hiện tại: $val {$r->unit} (ngưỡng {$r->op} " . (float) $r->threshold . " {$r->unit}).", 0, 300), $val, 'open', $this->now()]);
                $this->writeLog($r->severity === 'critical' ? 'error' : 'warn', 'system', 'alert_open', 'Cảnh báo mới: ' . $r->name . " ($val {$r->unit})", 'system');
            } elseif (!$breach && $open) {
                $this->db()->update("UPDATE sm_mon_alerts SET status = 'resolved', resolved_by = 'system', resolved_at = ? WHERE rule_key = ? AND status IN ('open','ack')", [$this->now(), $r->rule_key]);
                $this->writeLog('info', 'system', 'alert_auto_resolved', 'Cảnh báo tự đóng: ' . $r->name, 'system');
            }
        }
    }

    private function purgeIfDue(): void
    {
        $today = gmdate('Y-m-d');
        if ($this->setting('last_purge', '') === $today) return;
        $rd = max(1, (int) $this->setting('retention_requests_days', '14'));
        $ld = max(7, (int) $this->setting('retention_logs_days', '90'));
        $a = $this->db()->delete('DELETE FROM sm_mon_requests WHERE created_at < ?', [$this->utcAgo($rd * 86400)]);
        $b = $this->db()->delete('DELETE FROM sm_mon_logs WHERE created_at < ?', [$this->utcAgo($ld * 86400)]);
        $this->db()->delete('DELETE FROM sm_mon_checks WHERE created_at < ?', [$this->utcAgo(14 * 86400)]);
        $this->db()->statement('INSERT INTO sm_mon_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', ['last_purge', $today]);
        if ($a + $b > 0) $this->writeLog('info', 'system', 'auto_purge', "Tự dọn dữ liệu cũ: $a request, $b dòng nhật ký.", 'system');
    }

    private function score(array $checks, int $crit, int $warn): array
    {
        $s = 100;
        foreach ($checks as $c) $s -= $c['status'] === 'fail' ? 20 : ($c['status'] === 'warn' ? 7 : 0);
        $s -= $crit * 10 + $warn * 4;
        $s = max(0, min(100, $s));
        $label = $s >= 90 ? 'Hoạt động tốt' : ($s >= 70 ? 'Cần chú ý' : ($s >= 40 ? 'Suy giảm' : 'Nghiêm trọng'));
        $tone = $s >= 90 ? 'good' : ($s >= 70 ? 'warn' : 'bad');
        return ['value' => $s, 'label' => $label, 'tone' => $tone];
    }

    private function hourSeries(int $hours): array
    {
        $since = gmdate('Y-m-d H:00:00', time() - ($hours - 1) * 3600);
        $rows = $this->rows($this->db()->select("SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') AS h, COUNT(*) AS n, ROUND(AVG(ms)) AS avg_ms, SUM(status >= 500) AS err
            FROM sm_mon_requests WHERE created_at >= ? GROUP BY h", [$since]));
        $by = [];
        foreach ($rows as $r) $by[$r['h']] = $r;
        $out = [];
        for ($i = $hours - 1; $i >= 0; $i--) {
            $k = gmdate('Y-m-d H:00:00', time() - $i * 3600);
            $r = $by[$k] ?? null;
            $out[] = ['t' => $k, 'n' => (int) ($r['n'] ?? 0), 'avg' => (int) ($r['avg_ms'] ?? 0), 'err' => (int) ($r['err'] ?? 0)];
        }
        return $out;
    }

    // ============================================================ TỔNG QUAN
    public function overview(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        $this->purgeIfDue();

        $checks = $this->runChecks();
        $this->storeChecks($checks);
        $metrics = $this->metrics($checks);
        $this->evaluate($metrics);

        $alerts = $this->rows($this->db()->select("SELECT id, rule_key, severity, title, detail, value, status, created_at FROM sm_mon_alerts WHERE status IN ('open','ack') ORDER BY severity = 'critical' DESC, id DESC LIMIT 10"));
        $crit = count(array_filter($alerts, fn ($a) => $a['severity'] === 'critical'));
        $warn = count($alerts) - $crit;

        $d24 = $this->utcAgo(86400);
        $q = $this->db()->selectOne('SELECT COUNT(*) AS n, ROUND(AVG(ms)) AS avg_ms, SUM(status >= 500) AS e5, SUM(status >= 400 AND status < 500) AS e4 FROM sm_mon_requests WHERE created_at >= ?', [$d24]);
        $n24 = (int) ($q->n ?? 0);

        $now = $this->now();
        $staffSess = (int) $this->db()->selectOne('SELECT COUNT(*) AS n FROM sm_staff_tokens WHERE expires_at > ?', [$now])->n;
        $stuSess = 0;
        try { $stuSess = (int) $this->db()->selectOne('SELECT COUNT(*) AS n FROM sm_api_tokens WHERE expires_at > ?', [$now])->n; } catch (\Throwable $e) {}

        $dbSize = $this->db()->selectOne('SELECT ROUND(SUM(data_length + index_length) / 1048576, 1) AS mb, COUNT(*) AS tables FROM information_schema.TABLES WHERE table_schema = DATABASE()');

        $statusRow = $this->rows($this->db()->select("SHOW GLOBAL STATUS WHERE Variable_name IN ('Uptime')"));
        $uptime = (int) ($statusRow[0]['Value'] ?? 0);

        return response()->json(['data' => [
            'score' => $this->score($checks, $crit, $warn),
            'services' => $checks,
            'kpis' => [
                'requests_24h' => $n24,
                'avg_ms' => (int) ($q->avg_ms ?? 0),
                'p95_ms' => $this->p95('WHERE created_at >= ?', [$d24]),
                'error_rate' => $n24 > 0 ? round(((int) $q->e5) / $n24 * 100, 2) : 0,
                'client_errors' => (int) ($q->e4 ?? 0),
                'sessions_staff' => $staffSess,
                'sessions_student' => $stuSess,
                'errors_24h' => $metrics['errors_24h'],
                'failed_logins_24h' => (int) $this->db()->selectOne("SELECT COUNT(*) AS n FROM sm_mon_logs WHERE action = 'login_failed' AND created_at >= ?", [$d24])->n,
                'locked_accounts' => $metrics['locked_accounts'],
                'db_mb' => (float) ($dbSize->mb ?? 0),
                'db_tables' => (int) ($dbSize->tables ?? 0),
                'db_uptime_s' => $uptime,
            ],
            'series' => $this->hourSeries(24),
            'alerts' => $alerts,
            'recent_logs' => $this->rows($this->db()->select('SELECT id, level, source, action, message, actor, ip, created_at FROM sm_mon_logs ORDER BY id DESC LIMIT 8')),
            'system' => [
                'php' => PHP_VERSION, 'laravel' => app()->version(), 'env' => config('app.env'), 'debug' => (bool) config('app.debug'),
                'timezone' => config('app.timezone'), 'os' => PHP_OS_FAMILY, 'server_time' => gmdate('Y-m-d H:i:s'),
                'memory_limit' => ini_get('memory_limit'), 'upload_max' => ini_get('upload_max_filesize'), 'max_exec' => ini_get('max_execution_time'),
                'refresh_sec' => (int) $this->setting('refresh_sec', '30'),
            ],
        ]]);
    }

    // ============================================================ DỊCH VỤ
    public function checks(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        $hist = [];
        $keys = $this->db()->select('SELECT DISTINCT check_key FROM sm_mon_checks');
        foreach ($keys as $k) {
            $rows = $this->rows($this->db()->select('SELECT status, value, ms, created_at FROM sm_mon_checks WHERE check_key = ? ORDER BY id DESC LIMIT 40', [$k->check_key]));
            $total = count($rows);
            $ok = count(array_filter($rows, fn ($x) => in_array($x['status'], ['ok', 'skip'], true)));
            $hist[$k->check_key] = ['points' => array_reverse($rows), 'uptime' => $total ? round($ok / $total * 100, 1) : null];
        }
        return response()->json(['data' => ['services' => $this->runChecks(), 'history' => $hist]]);
    }

    public function runNow(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        $checks = $this->runChecks();
        $this->storeChecks($checks);
        $this->evaluate($this->metrics($checks));
        $bad = count(array_filter($checks, fn ($c) => $c['status'] === 'fail'));
        $this->writeLog($bad ? 'warn' : 'info', 'admin', 'check_run', 'Chạy kiểm tra dịch vụ thủ công: ' . count($checks) . ' mục, ' . $bad . ' lỗi.', $this->me($r)['u'], $r->ip());
        return response()->json(['data' => ['services' => $checks]]);
    }

    // ============================================================ NHẬT KÝ
    private function logQuery(Request $r): array
    {
        $w = ['1=1'];
        $a = [];
        $lv = (string) $r->query('level', '');
        if (in_array($lv, self::LEVELS, true)) { $w[] = 'level = ?'; $a[] = $lv; }
        $src = (string) $r->query('source', '');
        if ($src !== '' && preg_match('/^[a-z_]{2,20}$/', $src)) { $w[] = 'source = ?'; $a[] = $src; }
        $actor = trim((string) $r->query('actor', ''));
        if ($actor !== '' && mb_strlen($actor) <= 60) { $w[] = 'actor = ?'; $a[] = $actor; }
        $act = (string) $r->query('action', '');
        if ($act !== '' && preg_match('/^[a-z_]{2,40}$/', $act)) { $w[] = 'action = ?'; $a[] = $act; }
        $q = trim((string) $r->query('q', ''));
        if ($q !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], mb_substr($q, 0, 60)) . '%';
            $w[] = '(message LIKE ? OR actor LIKE ? OR ip LIKE ? OR route LIKE ?)';
            array_push($a, $like, $like, $like, $like);
        }
        $hours = (int) $r->query('hours', 0);
        if ($hours > 0) { $w[] = 'created_at >= ?'; $a[] = $this->utcAgo(min($hours, 24 * 365) * 3600); }
        return [implode(' AND ', $w), $a];
    }

    public function logs(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        [$where, $args] = $this->logQuery($r);
        $per = 20;
        $page = max(1, (int) $r->query('page', 1));
        $total = (int) $this->db()->selectOne("SELECT COUNT(*) AS n FROM sm_mon_logs WHERE $where", $args)->n;
        $rows = $this->rows($this->db()->select("SELECT id, level, source, action, message, actor, ip, route, created_at FROM sm_mon_logs WHERE $where ORDER BY id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $args));
        $cnt = $this->rows($this->db()->select('SELECT level, COUNT(*) AS n FROM sm_mon_logs WHERE created_at >= ? GROUP BY level', [$this->utcAgo(86400)]));
        $by = ['info' => 0, 'warn' => 0, 'error' => 0, 'security' => 0];
        foreach ($cnt as $c) $by[$c['level']] = (int) $c['n'];
        $actions = array_map(fn ($x) => $x->action, $this->db()->select('SELECT DISTINCT action FROM sm_mon_logs ORDER BY action LIMIT 60'));
        $sources = array_map(fn ($x) => $x->source, $this->db()->select('SELECT DISTINCT source FROM sm_mon_logs ORDER BY source'));
        return response()->json(['data' => ['items' => $rows, 'total' => $total, 'page' => $page, 'per' => $per, 'last_page' => max(1, (int) ceil($total / $per)), 'counts_24h' => $by, 'actions' => $actions, 'sources' => $sources]]);
    }

    public function logOne(Request $r, int $id)
    {
        if ($d = $this->deny($r)) return $d;
        $x = $this->db()->selectOne('SELECT * FROM sm_mon_logs WHERE id = ?', [$id]);
        if (!$x) return $this->fail('Không tìm thấy dòng nhật ký.', 404);
        $x = (array) $x;
        $x['context'] = $x['context'] ? json_decode($x['context'], true) : null;
        return response()->json(['data' => $x]);
    }

    public function logsExport(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        [$where, $args] = $this->logQuery($r);
        $rows = $this->rows($this->db()->select("SELECT id, created_at, level, source, action, message, actor, ip, route FROM sm_mon_logs WHERE $where ORDER BY id DESC LIMIT 5000", $args));
        return response()->json(['data' => $rows]);
    }

    public function logsPurge(Request $r)
    {
        if ($d = $this->deny($r, true)) return $d;
        $days = (int) $r->input('older_than_days', 0);
        if ($days < 1 || $days > 3650) return $this->fail('Số ngày không hợp lệ (1–3650).', 422, ['older_than_days' => 'Nhập từ 1 đến 3650.']);
        $n = $this->db()->delete('DELETE FROM sm_mon_logs WHERE created_at < ?', [$this->utcAgo($days * 86400)]);
        $this->writeLog('security', 'admin', 'logs_purged', "Xóa $n dòng nhật ký cũ hơn $days ngày.", $this->me($r)['u'], $r->ip());
        return response()->json(['message' => "Đã xóa $n dòng nhật ký.", 'data' => ['deleted' => $n]]);
    }

    // ============================================================ LOG LARAVEL (file)
    public function appLog(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        $files = glob(storage_path('logs/*.log')) ?: [];
        usort($files, fn ($a, $b) => filemtime($b) <=> filemtime($a));
        if (!$files) return response()->json(['data' => ['file' => null, 'size' => 0, 'entries' => [], 'by_level' => new \stdClass()]]);
        $file = $files[0];
        $size = filesize($file);
        $take = min($size, 400 * 1024);
        $fh = fopen($file, 'rb');
        fseek($fh, -$take, SEEK_END);
        $txt = (string) fread($fh, $take);
        fclose($fh);
        $parts = preg_split('/^(?=\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] )/m', $txt, -1, PREG_SPLIT_NO_EMPTY);
        $entries = [];
        $by = [];
        foreach ($parts as $p) {
            if (!preg_match('/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\w+)\.(\w+): (.*)/s', $p, $m)) continue;
            $lines = preg_split('/\R/', $m[4]);
            $level = strtolower($m[3]);
            $by[$level] = ($by[$level] ?? 0) + 1;
            $entries[] = ['time' => $m[1], 'channel' => $m[2], 'level' => $level, 'message' => mb_substr($lines[0], 0, 400), 'trace' => implode("\n", array_slice($lines, 1, 8))];
        }
        $lvl = strtolower((string) $r->query('level', ''));
        if ($lvl !== '') $entries = array_values(array_filter($entries, fn ($e) => $e['level'] === $lvl));
        $entries = array_slice(array_reverse($entries), 0, 80);
        return response()->json(['data' => ['file' => basename($file), 'size' => $size, 'size_h' => $this->bytes((float) $size), 'entries' => $entries, 'by_level' => $by ?: new \stdClass()]]);
    }

    public function appLogClear(Request $r)
    {
        if ($d = $this->deny($r, true)) return $d;
        $files = glob(storage_path('logs/*.log')) ?: [];
        $n = 0;
        foreach ($files as $f) { if (@file_put_contents($f, '') !== false) $n++; }
        $this->writeLog('security', 'admin', 'applog_cleared', "Đã làm trống $n file log Laravel.", $this->me($r)['u'], $r->ip());
        return response()->json(['message' => "Đã làm trống $n file log."]);
    }

    // ============================================================ HIỆU NĂNG
    public function performance(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        $hours = in_array((int) $r->query('hours', 24), [1, 6, 24, 72, 168], true) ? (int) $r->query('hours', 24) : 24;
        $since = $this->utcAgo($hours * 3600);
        $slow = max(100, (int) $this->setting('slow_ms', '1000'));

        $tot = $this->db()->selectOne('SELECT COUNT(*) AS n, ROUND(AVG(ms)) AS avg_ms, MAX(ms) AS max_ms, SUM(status >= 500) AS e5, SUM(status >= 400 AND status < 500) AS e4, SUM(ms >= ?) AS slow FROM sm_mon_requests WHERE created_at >= ?', [$slow, $since]);
        $n = (int) ($tot->n ?? 0);

        $routes = $this->rows($this->db()->select('SELECT route, method, COUNT(*) AS n, ROUND(AVG(ms)) AS avg_ms, MAX(ms) AS max_ms, SUM(status >= 500) AS e5, SUM(status >= 400 AND status < 500) AS e4
            FROM sm_mon_requests WHERE created_at >= ? GROUP BY route, method ORDER BY n DESC LIMIT 30', [$since]));
        foreach ($routes as $i => $x) {
            $routes[$i]['p95'] = $i < 15 ? $this->p95('WHERE created_at >= ? AND route = ? AND method = ?', [$since, $x['route'], $x['method']]) : null;
            $routes[$i] = array_map(fn ($v) => is_numeric($v) && !is_int($v) ? (int) $v : $v, $routes[$i]);
        }

        $dist = $this->rows($this->db()->select("SELECT CASE WHEN status < 300 THEN '2xx' WHEN status < 400 THEN '3xx' WHEN status < 500 THEN '4xx' ELSE '5xx' END AS cls, COUNT(*) AS n
            FROM sm_mon_requests WHERE created_at >= ? GROUP BY cls ORDER BY cls", [$since]));

        $buckets = [['≤ 100 ms', 0, 100], ['101–300', 101, 300], ['301–1000', 301, 1000], ['> 1 giây', 1001, 99999999]];
        $lat = [];
        foreach ($buckets as $b) {
            $c = (int) $this->db()->selectOne('SELECT COUNT(*) AS n FROM sm_mon_requests WHERE created_at >= ? AND ms BETWEEN ? AND ?', [$since, $b[1], $b[2]])->n;
            $lat[] = ['label' => $b[0], 'n' => $c];
        }

        $slowest = $this->rows($this->db()->select('SELECT route, method, status, ms, ip, created_at FROM sm_mon_requests WHERE created_at >= ? ORDER BY ms DESC LIMIT 10', [$since]));
        $series = $hours <= 24 ? $this->hourSeries($hours === 1 ? 2 : $hours) : $this->daySeries((int) ceil($hours / 24));

        return response()->json(['data' => [
            'hours' => $hours, 'slow_ms' => $slow,
            'totals' => ['requests' => $n, 'avg_ms' => (int) ($tot->avg_ms ?? 0), 'max_ms' => (int) ($tot->max_ms ?? 0), 'p95_ms' => $this->p95('WHERE created_at >= ?', [$since]),
                'e5' => (int) ($tot->e5 ?? 0), 'e4' => (int) ($tot->e4 ?? 0), 'slow' => (int) ($tot->slow ?? 0), 'error_rate' => $n ? round(((int) $tot->e5) / $n * 100, 2) : 0, 'rpm' => round($n / max(1, $hours * 60), 2)],
            'routes' => $routes, 'status_dist' => $dist, 'latency' => $lat, 'slowest' => $slowest, 'series' => $series,
        ]]);
    }

    private function daySeries(int $days): array
    {
        $since = gmdate('Y-m-d 00:00:00', time() - ($days - 1) * 86400);
        $rows = $this->rows($this->db()->select("SELECT DATE(created_at) AS h, COUNT(*) AS n, ROUND(AVG(ms)) AS avg_ms, SUM(status >= 500) AS err FROM sm_mon_requests WHERE created_at >= ? GROUP BY h", [$since]));
        $by = [];
        foreach ($rows as $x) $by[$x['h']] = $x;
        $out = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $k = gmdate('Y-m-d', time() - $i * 86400);
            $x = $by[$k] ?? null;
            $out[] = ['t' => $k . ' 00:00:00', 'n' => (int) ($x['n'] ?? 0), 'avg' => (int) ($x['avg_ms'] ?? 0), 'err' => (int) ($x['err'] ?? 0)];
        }
        return $out;
    }

    // ============================================================ CƠ SỞ DỮ LIỆU
    public function database(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        $tables = $this->rows($this->db()->select('SELECT table_name AS name, engine, table_rows AS est_rows, data_length AS data_b, index_length AS index_b, data_free AS free_b, update_time, create_time
            FROM information_schema.TABLES WHERE table_schema = DATABASE() AND table_type = \'BASE TABLE\' ORDER BY (data_length + index_length) DESC'));
        $totalB = 0;
        foreach ($tables as $i => $t) {
            $tables[$i]['est_rows'] = (int) $t['est_rows'];
            $tables[$i]['data_b'] = (int) $t['data_b'];
            $tables[$i]['index_b'] = (int) $t['index_b'];
            $tables[$i]['free_b'] = (int) $t['free_b'];
            $totalB += $tables[$i]['data_b'] + $tables[$i]['index_b'];
        }
        $st = [];
        foreach ($this->rows($this->db()->select("SHOW GLOBAL STATUS WHERE Variable_name IN ('Uptime','Threads_connected','Threads_running','Questions','Slow_queries','Connections','Aborted_connects','Innodb_buffer_pool_read_requests','Innodb_buffer_pool_reads')")) as $x) $st[$x['Variable_name']] = (int) $x['Value'];
        $maxConn = (int) ($this->rows($this->db()->select("SHOW VARIABLES LIKE 'max_connections'"))[0]['Value'] ?? 0);
        $req = $st['Innodb_buffer_pool_read_requests'] ?? 0;
        $miss = $st['Innodb_buffer_pool_reads'] ?? 0;

        $now = $this->now();
        $cleanup = [
            ['key' => 'staff_tokens', 'label' => 'Phiên nhân viên đã hết hạn', 'n' => (int) $this->db()->selectOne('SELECT COUNT(*) AS n FROM sm_staff_tokens WHERE expires_at <= ?', [$now])->n],
            ['key' => 'student_tokens', 'label' => 'Phiên học sinh đã hết hạn', 'n' => $this->safeCount('SELECT COUNT(*) AS n FROM sm_api_tokens WHERE expires_at <= ?', [$now])],
            ['key' => 'requests', 'label' => 'Số liệu request cũ hơn 7 ngày', 'n' => (int) $this->db()->selectOne('SELECT COUNT(*) AS n FROM sm_mon_requests WHERE created_at < ?', [$this->utcAgo(7 * 86400)])->n],
            ['key' => 'checks', 'label' => 'Lịch sử kiểm tra cũ hơn 7 ngày', 'n' => (int) $this->db()->selectOne('SELECT COUNT(*) AS n FROM sm_mon_checks WHERE created_at < ?', [$this->utcAgo(7 * 86400)])->n],
        ];

        return response()->json(['data' => [
            'version' => $this->db()->selectOne('SELECT VERSION() AS v')->v ?? '',
            'database' => $this->db()->selectOne('SELECT DATABASE() AS d')->d ?? '',
            'total_b' => $totalB, 'tables' => $tables,
            'status' => [
                'uptime_s' => $st['Uptime'] ?? 0, 'threads' => $st['Threads_connected'] ?? 0, 'running' => $st['Threads_running'] ?? 0, 'max_conn' => $maxConn,
                'queries' => $st['Questions'] ?? 0, 'slow' => $st['Slow_queries'] ?? 0, 'aborted' => $st['Aborted_connects'] ?? 0,
                'buffer_hit' => $req > 0 ? round((1 - $miss / $req) * 100, 2) : null,
            ],
            'cleanup' => $cleanup,
        ]]);
    }

    private function safeCount(string $sql, array $args): int
    {
        try { return (int) $this->db()->selectOne($sql, $args)->n; } catch (\Throwable $e) { return 0; }
    }

    public function tableCount(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        $out = [];
        foreach ($this->db()->select('SELECT table_name AS n FROM information_schema.TABLES WHERE table_schema = DATABASE() AND table_type = \'BASE TABLE\' AND table_name LIKE \'sm\\_%\'') as $t) {
            $name = (string) $t->n;
            if (!preg_match('/^sm_[a-z0-9_]+$/', $name)) continue;
            try { $out[$name] = (int) $this->db()->selectOne("SELECT COUNT(*) AS n FROM `$name`")->n; } catch (\Throwable $e) { $out[$name] = null; }
        }
        return response()->json(['data' => $out]);
    }

    public function analyze(Request $r)
    {
        if ($d = $this->deny($r, true)) return $d;
        $name = (string) $r->input('table', '');
        if (!preg_match('/^sm_[a-z0-9_]+$/', $name)) return $this->fail('Tên bảng không hợp lệ (chỉ cho phép bảng sm_*).', 422);
        if (!$this->tableExists($name)) return $this->fail('Bảng không tồn tại.', 404);
        $res = $this->rows($this->db()->select("ANALYZE TABLE `$name`"));
        $this->writeLog('info', 'admin', 'table_analyze', "Phân tích bảng $name.", $this->me($r)['u'], $r->ip());
        return response()->json(['message' => "Đã phân tích bảng $name.", 'data' => $res]);
    }

    public function cleanup(Request $r)
    {
        if ($d = $this->deny($r, true)) return $d;
        $key = (string) $r->input('target', '');
        $now = $this->now();
        $n = match ($key) {
            'staff_tokens' => $this->db()->delete('DELETE FROM sm_staff_tokens WHERE expires_at <= ?', [$now]),
            'student_tokens' => $this->db()->delete('DELETE FROM sm_api_tokens WHERE expires_at <= ?', [$now]),
            'requests' => $this->db()->delete('DELETE FROM sm_mon_requests WHERE created_at < ?', [$this->utcAgo(7 * 86400)]),
            'checks' => $this->db()->delete('DELETE FROM sm_mon_checks WHERE created_at < ?', [$this->utcAgo(7 * 86400)]),
            default => -1,
        };
        if ($n < 0) return $this->fail('Mục dọn dẹp không hợp lệ.', 422);
        $this->writeLog('info', 'admin', 'cleanup', "Dọn dẹp [$key]: xóa $n bản ghi.", $this->me($r)['u'], $r->ip());
        return response()->json(['message' => "Đã dọn $n bản ghi.", 'data' => ['deleted' => $n]]);
    }

    // ============================================================ PHIÊN & BẢO MẬT
    public function sessions(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        $now = $this->now();
        $mine = hash('sha256', (string) $r->bearerToken());
        $staff = $this->rows($this->db()->select('SELECT t.id, t.token_hash, t.created_at, t.expires_at, a.username, a.full_name AS name, a.role, a.last_login_at
            FROM sm_staff_tokens t JOIN sm_staff_accounts a ON a.id = t.staff_id WHERE t.expires_at > ? ORDER BY t.created_at DESC LIMIT 200', [$now]));
        foreach ($staff as $i => $s) { $staff[$i]['current'] = hash_equals($s['token_hash'], $mine); unset($staff[$i]['token_hash']); }
        $stu = [];
        try {
            $stu = $this->rows($this->db()->select('SELECT t.id, t.created_at, t.expires_at, a.username, s.full_name AS name, s.code, a.last_login_at
                FROM sm_api_tokens t JOIN sm_accounts a ON a.id = t.account_id JOIN sm_students s ON s.id = a.student_id WHERE t.expires_at > ? ORDER BY t.created_at DESC LIMIT 300', [$now]));
        } catch (\Throwable $e) {}
        return response()->json(['data' => ['staff' => $staff, 'students' => $stu]]);
    }

    public function revoke(Request $r, string $type, int $id)
    {
        if ($d = $this->deny($r, true)) return $d;
        if ($type === 'staff') {
            $t = $this->db()->selectOne('SELECT t.token_hash, a.username FROM sm_staff_tokens t JOIN sm_staff_accounts a ON a.id = t.staff_id WHERE t.id = ?', [$id]);
            if (!$t) return $this->fail('Phiên không tồn tại hoặc đã hết hạn.', 404);
            if (hash_equals($t->token_hash, hash('sha256', (string) $r->bearerToken()))) return $this->fail('Không thể tự thu hồi phiên đang dùng. Hãy dùng nút Đăng xuất.', 422);
            $this->db()->delete('DELETE FROM sm_staff_tokens WHERE id = ?', [$id]);
            $who = $t->username;
        } elseif ($type === 'student') {
            $t = $this->db()->selectOne('SELECT a.username FROM sm_api_tokens t JOIN sm_accounts a ON a.id = t.account_id WHERE t.id = ?', [$id]);
            if (!$t) return $this->fail('Phiên không tồn tại hoặc đã hết hạn.', 404);
            $this->db()->delete('DELETE FROM sm_api_tokens WHERE id = ?', [$id]);
            $who = $t->username;
        } else {
            return $this->fail('Loại phiên không hợp lệ.', 422);
        }
        $this->writeLog('security', 'admin', 'session_revoked', "Thu hồi phiên $type của $who.", $this->me($r)['u'], $r->ip());
        return response()->json(['message' => "Đã thu hồi phiên của $who."]);
    }

    public function revokeAll(Request $r)
    {
        if ($d = $this->deny($r, true)) return $d;
        $scope = (string) $r->input('scope', '');
        $mine = hash('sha256', (string) $r->bearerToken());
        $n = 0;
        if ($scope === 'staff') $n = $this->db()->delete('DELETE FROM sm_staff_tokens WHERE token_hash <> ?', [$mine]);
        elseif ($scope === 'student') $n = $this->db()->delete('DELETE FROM sm_api_tokens');
        else return $this->fail('Phạm vi không hợp lệ.', 422);
        $this->writeLog('security', 'admin', 'sessions_revoked_all', "Thu hồi toàn bộ phiên $scope ($n phiên).", $this->me($r)['u'], $r->ip());
        return response()->json(['message' => "Đã thu hồi $n phiên.", 'data' => ['revoked' => $n]]);
    }

    public function security(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        $now = $this->now();
        $accounts = $this->rows($this->db()->select("SELECT 'staff' AS type, id, username, full_name AS name, role AS extra, failed_attempts, locked_until, last_login_at FROM sm_staff_accounts
            WHERE failed_attempts > 0 OR (locked_until IS NOT NULL AND locked_until > ?) ORDER BY locked_until DESC LIMIT 100", [$now]));
        try {
            $stu = $this->rows($this->db()->select("SELECT 'student' AS type, a.id, a.username, s.full_name AS name, s.code AS extra, a.failed_attempts, a.locked_until, a.last_login_at FROM sm_accounts a
                JOIN sm_students s ON s.id = a.student_id WHERE a.failed_attempts > 0 OR (a.locked_until IS NOT NULL AND a.locked_until > ?) ORDER BY a.locked_until DESC LIMIT 100", [$now]));
            $accounts = array_merge($accounts, $stu);
        } catch (\Throwable $e) {}
        foreach ($accounts as $i => $a) $accounts[$i]['locked'] = $a['locked_until'] && $a['locked_until'] > $now;

        $d7 = $this->utcAgo(7 * 86400);
        $ips = $this->rows($this->db()->select("SELECT ip, COUNT(*) AS n, COUNT(DISTINCT actor) AS users, MAX(created_at) AS last_at FROM sm_mon_logs
            WHERE action = 'login_failed' AND ip IS NOT NULL AND created_at >= ? GROUP BY ip ORDER BY n DESC LIMIT 10", [$d7]));
        $events = $this->rows($this->db()->select("SELECT id, level, action, message, actor, ip, created_at FROM sm_mon_logs WHERE level = 'security' ORDER BY id DESC LIMIT 15"));
        $daily = $this->rows($this->db()->select("SELECT DATE(created_at) AS d, SUM(action = 'login_ok') AS ok, SUM(action = 'login_failed') AS bad FROM sm_mon_logs
            WHERE action IN ('login_ok','login_failed') AND created_at >= ? GROUP BY d ORDER BY d", [$d7]));
        $mustChange = 0;
        try { $mustChange = (int) $this->db()->selectOne('SELECT COUNT(*) AS n FROM sm_accounts WHERE must_change_password = 1')->n; } catch (\Throwable $e) {}
        $inactiveStaff = (int) $this->db()->selectOne("SELECT COUNT(*) AS n FROM sm_staff_accounts WHERE status <> 'active'")->n;

        return response()->json(['data' => [
            'accounts' => $accounts, 'ips' => $ips, 'events' => $events, 'daily' => $daily,
            'summary' => ['locked' => count(array_filter($accounts, fn ($a) => $a['locked'])), 'failing' => count($accounts), 'must_change' => $mustChange, 'inactive_staff' => $inactiveStaff, 'default_pw_staff' => $this->defaultPwStaff(),
                'failed_24h' => (int) $this->db()->selectOne("SELECT COUNT(*) AS n FROM sm_mon_logs WHERE action = 'login_failed' AND created_at >= ?", [$this->utcAgo(86400)])->n],
        ]]);
    }

    public function unlock(Request $r, string $type, int $id)
    {
        if ($d = $this->deny($r, true)) return $d;
        $tbl = $type === 'staff' ? 'sm_staff_accounts' : ($type === 'student' ? 'sm_accounts' : null);
        if (!$tbl) return $this->fail('Loại tài khoản không hợp lệ.', 422);
        $a = $this->db()->selectOne("SELECT username FROM $tbl WHERE id = ?", [$id]);
        if (!$a) return $this->fail('Tài khoản không tồn tại.', 404);
        $this->db()->update("UPDATE $tbl SET failed_attempts = 0, locked_until = NULL WHERE id = ?", [$id]);
        $this->writeLog('security', 'admin', 'account_unlocked', "Mở khóa / xóa đếm lỗi đăng nhập của {$a->username}.", $this->me($r)['u'], $r->ip());
        return response()->json(['message' => "Đã mở khóa {$a->username}."]);
    }

    // ============================================================ CẢNH BÁO
    public function alerts(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        $st = (string) $r->query('status', 'active');
        $w = $st === 'active' ? "status IN ('open','ack')" : ($st === 'resolved' ? "status = 'resolved'" : '1=1');
        $rows = $this->rows($this->db()->select("SELECT * FROM sm_mon_alerts WHERE $w ORDER BY id DESC LIMIT 100"));
        $rules = $this->rows($this->db()->select('SELECT id, rule_key, name, description, metric, op, threshold, unit, severity, enabled FROM sm_mon_rules ORDER BY id'));
        foreach ($rules as $i => $x) { $rules[$i]['threshold'] = (float) $x['threshold']; $rules[$i]['enabled'] = (int) $x['enabled']; }
        $cnt = $this->db()->selectOne("SELECT SUM(status='open') AS o, SUM(status='ack') AS a, SUM(status='resolved') AS r FROM sm_mon_alerts");
        return response()->json(['data' => ['items' => $rows, 'rules' => $rules, 'counts' => ['open' => (int) $cnt->o, 'ack' => (int) $cnt->a, 'resolved' => (int) $cnt->r]]]);
    }

    public function alertAct(Request $r, int $id)
    {
        if ($d = $this->deny($r, true)) return $d;
        $act = (string) $r->input('action', '');
        $a = $this->db()->selectOne('SELECT * FROM sm_mon_alerts WHERE id = ?', [$id]);
        if (!$a) return $this->fail('Không tìm thấy cảnh báo.', 404);
        $me = $this->me($r)['u'];
        if ($act === 'ack') $this->db()->update("UPDATE sm_mon_alerts SET status = 'ack', ack_by = ?, ack_at = ? WHERE id = ? AND status = 'open'", [$me, $this->now(), $id]);
        elseif ($act === 'resolve') $this->db()->update("UPDATE sm_mon_alerts SET status = 'resolved', resolved_by = ?, resolved_at = ? WHERE id = ? AND status <> 'resolved'", [$me, $this->now(), $id]);
        else return $this->fail('Thao tác không hợp lệ.', 422);
        $this->writeLog('info', 'admin', 'alert_' . $act, "Cảnh báo #$id ({$a->title}): " . ($act === 'ack' ? 'đã tiếp nhận' : 'đã đóng') . '.', $me, $r->ip());
        return response()->json(['message' => $act === 'ack' ? 'Đã tiếp nhận cảnh báo.' : 'Đã đóng cảnh báo.']);
    }

    public function ruleUpdate(Request $r, int $id)
    {
        if ($d = $this->deny($r, true)) return $d;
        $x = $this->db()->selectOne('SELECT * FROM sm_mon_rules WHERE id = ?', [$id]);
        if (!$x) return $this->fail('Không tìm thấy quy tắc.', 404);
        $th = $r->input('threshold', $x->threshold);
        $en = $r->has('enabled') ? ($r->boolean('enabled') ? 1 : 0) : (int) $x->enabled;
        $sev = (string) $r->input('severity', $x->severity);
        $errs = [];
        if (!is_numeric($th) || $th < 0 || $th > 1000000) $errs['threshold'] = 'Ngưỡng phải là số từ 0 đến 1.000.000.';
        if (!in_array($sev, self::SEVERITY, true)) $errs['severity'] = 'Mức độ không hợp lệ.';
        if ($errs) return $this->fail('Dữ liệu chưa hợp lệ.', 422, $errs);
        $this->db()->update('UPDATE sm_mon_rules SET threshold = ?, enabled = ?, severity = ? WHERE id = ?', [(float) $th, $en, $sev, $id]);
        $this->writeLog('info', 'admin', 'rule_updated', "Sửa quy tắc \"{$x->name}\": ngưỡng $th, " . ($en ? 'bật' : 'tắt') . ', mức ' . $sev . '.', $this->me($r)['u'], $r->ip());
        return response()->json(['message' => 'Đã lưu quy tắc.']);
    }

    // ============================================================ THÔNG BÁO HỆ THỐNG
    public function announcements(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        $rows = $this->rows($this->db()->select('SELECT * FROM sm_mon_announcements ORDER BY id DESC LIMIT 100'));
        $now = $this->now();
        foreach ($rows as $i => $x) {
            $live = $x['active'] && $x['starts_at'] <= $now && (!$x['ends_at'] || $x['ends_at'] >= $now);
            $rows[$i]['state'] = !$x['active'] ? 'off' : ($x['starts_at'] > $now ? 'scheduled' : ($live ? 'live' : 'ended'));
            $rows[$i]['active'] = (int) $x['active'];
        }
        return response()->json(['data' => $rows]);
    }

    private function annInput(Request $r): array
    {
        $title = trim((string) $r->input('title', ''));
        $body = trim((string) $r->input('body', ''));
        $level = (string) $r->input('level', 'info');
        $aud = (string) $r->input('audience', 'all');
        $errs = [];
        if (mb_strlen($title) < 3 || mb_strlen($title) > 120) $errs['title'] = 'Tiêu đề từ 3 đến 120 ký tự.';
        if (mb_strlen($body) > 600) $errs['body'] = 'Nội dung tối đa 600 ký tự.';
        if (!in_array($level, self::ANN_LEVELS, true)) $errs['level'] = 'Mức độ không hợp lệ.';
        if (!in_array($aud, self::AUDIENCE, true)) $errs['audience'] = 'Đối tượng không hợp lệ.';
        $s = $this->parseLocal((string) $r->input('starts_at', ''));
        $e = $this->parseLocal((string) $r->input('ends_at', ''));
        if ($r->input('starts_at') && !$s) $errs['starts_at'] = 'Thời điểm bắt đầu không hợp lệ.';
        if ($r->input('ends_at') && !$e) $errs['ends_at'] = 'Thời điểm kết thúc không hợp lệ.';
        if ($s && $e && $e <= $s) $errs['ends_at'] = 'Kết thúc phải sau thời điểm bắt đầu.';
        return [$errs, ['title' => $title, 'body' => $body ?: null, 'level' => $level, 'audience' => $aud, 'starts_at' => $s ?: $this->now(), 'ends_at' => $e ?: null, 'active' => $r->has('active') ? ($r->boolean('active') ? 1 : 0) : 1]];
    }

    /** Nhận 'YYYY-MM-DDTHH:mm' kèm offset (phút, JS getTimezoneOffset) → UTC 'Y-m-d H:i:s' */
    private function parseLocal(string $s): ?string
    {
        if ($s === '') return null;
        $t = strtotime($s);
        return $t ? gmdate('Y-m-d H:i:s', $t) : null;
    }

    public function annStore(Request $r)
    {
        if ($d = $this->deny($r, true)) return $d;
        [$errs, $v] = $this->annInput($r);
        if ($errs) return $this->fail('Dữ liệu chưa hợp lệ.', 422, $errs);
        $me = $this->me($r);
        $this->db()->insert('INSERT INTO sm_mon_announcements (title, body, level, audience, starts_at, ends_at, active, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
            [$v['title'], $v['body'], $v['level'], $v['audience'], $v['starts_at'], $v['ends_at'], $v['active'], $me['u'], $this->now()]);
        $this->writeLog('info', 'admin', 'announcement_created', 'Tạo thông báo hệ thống: ' . $v['title'], $me['u'], $r->ip());
        return response()->json(['message' => 'Đã tạo thông báo.'], 201);
    }

    public function annUpdate(Request $r, int $id)
    {
        if ($d = $this->deny($r, true)) return $d;
        if (!$this->db()->selectOne('SELECT id FROM sm_mon_announcements WHERE id = ?', [$id])) return $this->fail('Không tìm thấy thông báo.', 404);
        [$errs, $v] = $this->annInput($r);
        if ($errs) return $this->fail('Dữ liệu chưa hợp lệ.', 422, $errs);
        $this->db()->update('UPDATE sm_mon_announcements SET title=?, body=?, level=?, audience=?, starts_at=?, ends_at=?, active=? WHERE id=?',
            [$v['title'], $v['body'], $v['level'], $v['audience'], $v['starts_at'], $v['ends_at'], $v['active'], $id]);
        $this->writeLog('info', 'admin', 'announcement_updated', 'Sửa thông báo hệ thống: ' . $v['title'], $this->me($r)['u'], $r->ip());
        return response()->json(['message' => 'Đã lưu thông báo.']);
    }

    public function annToggle(Request $r, int $id)
    {
        if ($d = $this->deny($r, true)) return $d;
        $x = $this->db()->selectOne('SELECT active, title FROM sm_mon_announcements WHERE id = ?', [$id]);
        if (!$x) return $this->fail('Không tìm thấy thông báo.', 404);
        $n = $x->active ? 0 : 1;
        $this->db()->update('UPDATE sm_mon_announcements SET active = ? WHERE id = ?', [$n, $id]);
        $this->writeLog('info', 'admin', 'announcement_toggle', ($n ? 'Bật' : 'Tắt') . ' thông báo: ' . $x->title, $this->me($r)['u'], $r->ip());
        return response()->json(['message' => $n ? 'Đã bật thông báo.' : 'Đã tắt thông báo.']);
    }

    public function annDestroy(Request $r, int $id)
    {
        if ($d = $this->deny($r, true)) return $d;
        $x = $this->db()->selectOne('SELECT title FROM sm_mon_announcements WHERE id = ?', [$id]);
        if (!$x) return $this->fail('Không tìm thấy thông báo.', 404);
        $this->db()->delete('DELETE FROM sm_mon_announcements WHERE id = ?', [$id]);
        $this->writeLog('info', 'admin', 'announcement_deleted', 'Xóa thông báo: ' . $x->title, $this->me($r)['u'], $r->ip());
        return response()->json(['message' => 'Đã xóa thông báo.']);
    }

    /** CÔNG KHAI (không cần đăng nhập): GET /api/public/announcements?audience=staff|student */
    public function publicAnnouncements(Request $r)
    {
        $aud = (string) $r->query('audience', 'all');
        if (!in_array($aud, self::AUDIENCE, true)) $aud = 'all';
        $now = $this->now();
        $rows = $this->rows($this->db()->select("SELECT id, title, body, level, ends_at FROM sm_mon_announcements
            WHERE active = 1 AND starts_at <= ? AND (ends_at IS NULL OR ends_at >= ?) AND (audience = 'all' OR audience = ?) ORDER BY FIELD(level,'critical','warning','info','success'), id DESC LIMIT 5", [$now, $now, $aud]));
        return response()->json(['data' => $rows]);
    }

    // ============================================================ CÀI ĐẶT
    public function settings(Request $r)
    {
        if ($d = $this->deny($r)) return $d;
        return response()->json(['data' => [
            'retention_requests_days' => (int) $this->setting('retention_requests_days', '14'),
            'retention_logs_days' => (int) $this->setting('retention_logs_days', '90'),
            'slow_ms' => (int) $this->setting('slow_ms', '1000'),
            'refresh_sec' => (int) $this->setting('refresh_sec', '30'),
        ]]);
    }

    public function settingsUpdate(Request $r)
    {
        if ($d = $this->deny($r, true)) return $d;
        $rules = ['retention_requests_days' => [1, 90, 'Lưu số liệu request từ 1 đến 90 ngày.'], 'retention_logs_days' => [7, 730, 'Lưu nhật ký từ 7 đến 730 ngày.'],
            'slow_ms' => [100, 20000, 'Ngưỡng request chậm từ 100 đến 20000 ms.'], 'refresh_sec' => [10, 600, 'Tự làm mới từ 10 đến 600 giây.']];
        $errs = [];
        $set = [];
        foreach ($rules as $k => [$lo, $hi, $msg]) {
            if (!$r->has($k)) continue;
            $v = $r->input($k);
            if (!is_numeric($v) || (int) $v < $lo || (int) $v > $hi) $errs[$k] = $msg; else $set[$k] = (int) $v;
        }
        if ($errs) return $this->fail('Dữ liệu chưa hợp lệ.', 422, $errs);
        foreach ($set as $k => $v) $this->db()->statement('INSERT INTO sm_mon_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [$k, (string) $v]);
        $this->writeLog('info', 'admin', 'settings_updated', 'Cập nhật cài đặt giám sát: ' . json_encode($set), $this->me($r)['u'], $r->ip());
        return response()->json(['message' => 'Đã lưu cài đặt.']);
    }
}
