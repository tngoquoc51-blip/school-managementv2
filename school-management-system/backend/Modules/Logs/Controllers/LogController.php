<?php

namespace Modules\Logs\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logs\Requests\LogFilterRequest;
use Modules\Logs\Services\LogService;
use Modules\Logs\Support\AuditLogger;

class LogController extends Controller
{
    use ApiResponse;

    public function __construct(private LogService $service) {}

    private function actor(Request $r): array
    {
        return $r->attributes->get('log_actor');
    }

    /** Ẩn 2 octet cuối của IP nếu bật "mask_ip" (bảo vệ dữ liệu cá nhân). */
    private function maskIps($data)
    {
        if (($this->service->repo()->settings()['mask_ip'] ?? '0') !== '1') {
            return $data;
        }
        $mask = fn ($ip) => $ip && str_contains($ip, '.') ? preg_replace('/\.\d+\.\d+$/', '.x.x', $ip) : $ip;
        $walk = function (&$v) use (&$walk, $mask) {
            if (is_object($v)) { foreach ($v as $k => &$x) { if ($k === 'ip') $x = $mask($x); else $walk($x); } }
            elseif (is_array($v)) { foreach ($v as $k => &$x) { if ($k === 'ip') $x = $mask($x); else $walk($x); } }
        };
        $walk($data);
        return $data;
    }

    public function me(Request $r)
    {
        $a = $this->actor($r);
        return $this->success(['id' => $a['id'], 'name' => $a['full_name'], 'role' => $a['role'], 'can_admin' => $a['can_admin']]);
    }

    public function overview(Request $r)
    {
        $range = in_array($r->query('range'), ['today', '7d', '30d', '90d'], true) ? $r->query('range') : '7d';
        return $this->success($this->maskIps($this->service->repo()->overview($range)));
    }

    public function index(LogFilterRequest $r)
    {
        $per = min((int) $r->query('per_page', 25), 200);
        return $this->success($this->maskIps($this->service->repo()->paginate($r->filters(), max(1, (int) $r->query('page', 1)), $per)));
    }

    public function show(Request $r, int $id)
    {
        $d = $this->service->detail($id);
        if (! $d) return $this->error('Không tìm thấy bản ghi', 404);

        // Xem chi tiết log chứa dữ liệu nhạy cảm cũng được ghi lại
        AuditLogger::log(['module' => 'security', 'action' => 'logs.view_detail', 'entity_type' => 'audit_log', 'entity_id' => $id,
            'summary' => "{$this->actor($r)['full_name']} xem chi tiết nhật ký #{$id}"]);
        return $this->success($this->maskIps($d));
    }

    public function facets()
    {
        return $this->success($this->service->repo()->facets());
    }

    public function finance(LogFilterRequest $r)
    {
        return $this->success($this->maskIps($this->service->repo()->finance($r->filters())));
    }

    public function export(LogFilterRequest $r)
    {
        return $this->service->exportCsv($r->filters(), $this->actor($r));
    }

    public function verify(Request $r)
    {
        return $this->success($this->service->verifyChain($this->actor($r)));
    }
}
