<?php

namespace Modules\Logs\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logs\Services\LogService;
use Modules\Logs\Support\AuditLogger;

class SecurityController extends Controller
{
    use ApiResponse;

    public function __construct(private LogService $service) {}

    private function admin(Request $r): ?array
    {
        $a = $r->attributes->get('log_actor');
        return $a['can_admin'] ? $a : null;
    }

    public function overview()
    {
        return $this->success($this->service->repo()->security());
    }

    public function sessions()
    {
        return $this->success($this->service->repo()->sessions());
    }

    public function revoke(Request $r, string $type, int $id)
    {
        if (! $this->admin($r)) return $this->error('Chỉ Hiệu trưởng / Quản trị mới được buộc đăng xuất', 403);
        if (! in_array($type, ['staff', 'student', 'user'], true)) return $this->error('Loại phiên không hợp lệ', 422);

        $me = $r->attributes->get('log_actor');
        if ($type === ($me['token_kind'] ?? 'staff') && $id === $me['token_id']) return $this->error('Không thể tự đăng xuất phiên hiện tại tại đây', 422);

        $row = $this->service->repo()->revokeSession($type, $id);
        if (! $row) return $this->error('Không tìm thấy phiên', 404);

        AuditLogger::log(['module' => 'security', 'action' => 'session.revoke', 'severity' => 'warning',
            'entity_type' => $type . '_session', 'entity_id' => $id, 'entity_label' => $row->full_name,
            'summary' => "{$me['full_name']} buộc đăng xuất {$row->full_name} ({$row->username})"]);
        return $this->success(null, 'Đã buộc đăng xuất');
    }

    public function purgeExpired(Request $r)
    {
        if (! $this->admin($r)) return $this->error('Không đủ quyền', 403);
        $n = $this->service->repo()->purgeExpiredSessions();
        AuditLogger::log(['module' => 'security', 'action' => 'session.purge_expired', 'summary' => "Dọn {$n} phiên đã hết hạn"]);
        return $this->success(['deleted' => $n]);
    }

    public function unlock(Request $r, string $type, int $id)
    {
        if (! $this->admin($r)) return $this->error('Chỉ Hiệu trưởng / Quản trị mới được mở khoá tài khoản', 403);
        if (! in_array($type, ['staff', 'student'], true)) return $this->error('Loại tài khoản không hợp lệ', 422);

        $acc = $this->service->repo()->unlockAccount($type, $id);
        if (! $acc) return $this->error('Không tìm thấy tài khoản', 404);

        $me = $r->attributes->get('log_actor');
        AuditLogger::log(['module' => 'security', 'action' => 'account.unlock', 'severity' => 'notice',
            'entity_type' => $type . '_account', 'entity_id' => $id, 'entity_label' => $acc->full_name,
            'summary' => "{$me['full_name']} mở khoá tài khoản {$acc->username}"]);
        return $this->success(null, 'Đã mở khoá');
    }
}
