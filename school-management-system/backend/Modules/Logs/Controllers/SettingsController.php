<?php

namespace Modules\Logs\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logs\Requests\UpdateSettingsRequest;
use Modules\Logs\Services\LogService;
use Modules\Logs\Support\AuditLogger;

class SettingsController extends Controller
{
    use ApiResponse;

    public function __construct(private LogService $service) {}

    public function show()
    {
        return $this->success(['settings' => $this->service->repo()->settings(), 'stats' => $this->service->repo()->stats()]);
    }

    public function update(UpdateSettingsRequest $r)
    {
        $me = $r->attributes->get('log_actor');
        if (! $me['can_admin']) return $this->error('Chỉ Hiệu trưởng / Quản trị mới được đổi cấu hình', 403);

        $old = $this->service->repo()->settings();
        $new = [];
        foreach ($r->validated() as $k => $v) {
            $v = is_bool($v) ? ($v ? '1' : '0') : (string) $v;
            $this->service->setting($k, $v, $me['full_name']);
            $new[$k] = $v;
        }
        AuditLogger::log(['module' => 'security', 'action' => 'logs.settings', 'severity' => 'notice',
            'old_values' => array_intersect_key($old, $new), 'new_values' => $new,
            'summary' => "{$me['full_name']} đổi cấu hình nhật ký"]);

        return $this->success($this->service->repo()->settings(), 'Đã lưu cấu hình');
    }

    /** Xoá log cũ hơn số ngày lưu trữ. Chỉ cho phép khi đã nhập log cũ và đã xuất CSV là việc của người dùng. */
    public function purge(Request $r)
    {
        $me = $r->attributes->get('log_actor');
        if (! $me['can_admin']) return $this->error('Chỉ Hiệu trưởng / Quản trị mới được dọn nhật ký', 403);

        $days = (int) ($this->service->repo()->settings()['retention_days'] ?? 365);
        if ($r->input('confirm') !== 'XOA') return $this->error('Cần xác nhận bằng cách gửi confirm = "XOA"', 422);

        $n = $this->service->repo()->purgeOlderThan($days);
        AuditLogger::log(['module' => 'security', 'action' => 'logs.purge', 'severity' => 'critical',
            'summary' => "{$me['full_name']} xoá {$n} dòng nhật ký cũ hơn {$days} ngày", 'meta' => ['deleted' => $n, 'days' => $days]]);

        return $this->success(['deleted' => $n]);
    }

    public function importLegacy(Request $r)
    {
        $me = $r->attributes->get('log_actor');
        if (! $me['can_admin']) return $this->error('Chỉ Hiệu trưởng / Quản trị mới được nhập log cũ', 403);
        return $this->success($this->service->importLegacy($me), 'Đã nhập log cũ');
    }
}
