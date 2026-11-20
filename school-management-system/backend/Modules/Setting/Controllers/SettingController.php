<?php

namespace Modules\Setting\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Modules\Setting\Services\SettingService;

class SettingController extends Controller
{
    use ApiResponse;

    public function __construct(private SettingService $svc) {}

    /** GET /overview — bảng điều khiển tổng quan hệ thống */
    public function overview()
    {
        $count = function (string $sql, array $b = []) {
            try { return (int) (DB::selectOne($sql, $b)->c ?? 0); } catch (\Throwable) { return null; }
        };
        $db = config('database.connections.' . config('database.default') . '.database');
        $size = null; $tables = null;
        try {
            $r = DB::selectOne('SELECT ROUND(SUM(data_length+index_length)/1048576,1) s, COUNT(*) t FROM information_schema.tables WHERE table_schema = ?', [$db]);
            $size = (float) $r->s; $tables = (int) $r->t;
        } catch (\Throwable) {}

        $lastBackup = null;
        try { $lastBackup = DB::table('sm_backups')->where('status', 'done')->orderByDesc('id')->first(['code', 'type', 'file_size', 'created_at']); } catch (\Throwable) {}
        $year = null;
        try { $year = DB::table('sm_school_years')->where('is_current', 1)->first(['id', 'label', 'start_date', 'end_date']); } catch (\Throwable) {}

        return $this->success([
            'system' => [
                'app_name' => config('app.name'), 'env' => config('app.env'), 'debug' => (bool) config('app.debug'),
                'php' => PHP_VERSION, 'laravel' => app()->version(), 'timezone' => config('app.timezone'),
                'db_name' => $db, 'db_version' => DB::selectOne('SELECT VERSION() v')->v ?? null, 'db_size_mb' => $size, 'db_tables' => $tables,
                'server_time' => now()->toIso8601String(),
                'disk_free_gb' => round(@disk_free_space(base_path()) / 1073741824, 1),
                'disk_total_gb' => round(@disk_total_space(base_path()) / 1073741824, 1),
                'memory_limit' => ini_get('memory_limit'), 'max_exec' => ini_get('max_execution_time'),
            ],
            'stats' => [
                'users'    => $count('SELECT COUNT(*) c FROM users'),
                'students' => $count('SELECT COUNT(*) c FROM sm_students'),
                'teachers' => $count('SELECT COUNT(*) c FROM sm_teachers'),
                'classes'  => $count('SELECT COUNT(*) c FROM sm_classes'),
                'sessions' => $count('SELECT COUNT(*) c FROM personal_access_tokens WHERE expires_at IS NULL OR expires_at > NOW()'),
                'logs_today' => $count('SELECT COUNT(*) c FROM sm_audit_logs WHERE occurred_at >= CURDATE()'),
                'failed_logins_24h' => $count("SELECT COUNT(*) c FROM sm_audit_logs WHERE action='login_failed' AND occurred_at >= NOW() - INTERVAL 1 DAY"),
            ],
            'backup' => ['last' => $lastBackup, 'count' => $count('SELECT COUNT(*) c FROM sm_backups')],
            'school_year' => $year,
            'maintenance' => $this->svc->get('maintenance', 'maintenance_on', '0') === '1',
            'school_name' => $this->svc->get('general', 'school_name', ''),
        ]);
    }

    /** GET /groups/{group} */
    public function show(string $group)
    {
        if (! SettingService::groupExists($group)) return $this->error('Nhóm cài đặt không tồn tại', 404);
        return $this->success($this->svc->forUi($group));
    }

    /** PUT /groups/{group}  body: { values: {...} } */
    public function update(Request $request, string $group)
    {
        if (! SettingService::groupExists($group)) return $this->error('Nhóm cài đặt không tồn tại', 404);
        $input = (array) $request->input('values', []);

        $rules = SettingService::SCHEMA[$group];
        $v = Validator::make($input, array_intersect_key($rules, $input));
        if ($v->fails()) return $this->error('Dữ liệu không hợp lệ', 422, $v->errors());

        if ($group === 'academic') {
            $cur = array_merge($this->svc->raw('academic'), $input);
            if (! ((float) $cur['pass_score'] <= (float) $cur['good_score'] && (float) $cur['good_score'] <= (float) $cur['excellent_score'])) {
                return $this->error('Ngưỡng điểm phải thỏa: Đạt ≤ Khá ≤ Giỏi', 422, ['pass_score' => ['Ngưỡng điểm không hợp lệ']]);
            }
        }

        $changed = $this->svc->save($group, $input, $request->user()->id);
        if ($changed) {
            $this->svc->audit($request->user(), "settings.$group.update", 'Cập nhật cài đặt nhóm "' . $group . '": ' . implode(', ', $changed),
                ['entity_label' => $group, 'new' => array_intersect_key($input, array_flip(array_diff($changed, SettingService::SECRETS)))]);
        }
        return $this->success($this->svc->forUi($group), $changed ? 'Đã lưu cài đặt' : 'Không có thay đổi');
    }

    /** POST /mail/test  body: { to } — gửi thử bằng cấu hình SMTP đã lưu */
    public function mailTest(Request $request)
    {
        $request->validate(['to' => 'required|email']);
        $m = $this->svc->raw('mail');
        if (empty($m['smtp_host'])) return $this->error('Chưa cấu hình máy chủ SMTP', 422);

        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp' => [
                'transport' => 'smtp', 'host' => $m['smtp_host'], 'port' => (int) ($m['smtp_port'] ?: 587),
                'encryption' => ($m['smtp_encryption'] ?? 'tls') === 'none' ? null : $m['smtp_encryption'],
                'username' => $m['smtp_username'] ?: null, 'password' => $m['smtp_password'] ?: null, 'timeout' => 15,
            ],
            'mail.from' => ['address' => $m['from_address'] ?: $m['smtp_username'], 'name' => $m['from_name'] ?: config('app.name')],
        ]);
        app('mail.manager')->purge('smtp');

        try {
            Mail::raw("Đây là thư kiểm tra từ hệ thống quản lý trường.\nThời gian: " . now()->format('d/m/Y H:i:s'), function ($msg) use ($request) {
                $msg->to($request->input('to'))->subject('[Kiểm tra] Cấu hình email hệ thống trường');
            });
        } catch (\Throwable $e) {
            return $this->error('Gửi thất bại: ' . $e->getMessage(), 422);
        }
        $this->svc->audit($request->user(), 'settings.mail.test', 'Gửi email thử tới ' . $request->input('to'), ['severity' => 'info']);
        return $this->success(null, 'Đã gửi email thử tới ' . $request->input('to'));
    }

    /** POST /maintenance  body: { enabled, message } */
    public function maintenance(Request $request)
    {
        $data = $request->validate(['enabled' => 'required|boolean', 'message' => 'nullable|string|max:255']);
        $this->svc->save('maintenance', [
            'maintenance_on' => $data['enabled'] ? '1' : '0',
            'maintenance_message' => $data['message'] ?? 'Hệ thống đang bảo trì, vui lòng quay lại sau.',
        ], $request->user()->id);
        $this->svc->audit($request->user(), 'settings.maintenance', ($data['enabled'] ? 'BẬT' : 'TẮT') . ' chế độ bảo trì', ['severity' => 'warning']);
        return $this->success(['enabled' => (bool) $data['enabled']], $data['enabled'] ? 'Đã bật chế độ bảo trì' : 'Đã tắt chế độ bảo trì');
    }

    /** POST /cache/clear */
    public function clearCache(Request $request)
    {
        try { Artisan::call('optimize:clear'); } catch (\Throwable $e) { return $this->error($e->getMessage(), 500); }
        $this->svc->audit($request->user(), 'settings.cache.clear', 'Xóa bộ nhớ đệm hệ thống', ['severity' => 'info']);
        return $this->success(null, 'Đã xóa cache, config, route, view');
    }
}
