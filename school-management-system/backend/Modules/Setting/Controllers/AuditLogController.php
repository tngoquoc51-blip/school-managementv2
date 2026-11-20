<?php

namespace Modules\Setting\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Setting\Services\SettingService;

/** Nhật ký hệ thống — đọc bảng sm_audit_logs (bảng chỉ-ghi, không có API sửa/xóa). */
class AuditLogController extends Controller
{
    use ApiResponse;

    public function __construct(private SettingService $svc) {}

    private function query(Request $r)
    {
        $q = DB::table('sm_audit_logs');
        if ($s = trim((string) $r->query('q'))) {
            $q->where(function ($w) use ($s) {
                $w->where('summary', 'like', "%$s%")->orWhere('actor_name', 'like', "%$s%")->orWhere('action', 'like', "%$s%")
                  ->orWhere('ip', 'like', "%$s%")->orWhere('entity_label', 'like', "%$s%");
            });
        }
        foreach (['module', 'severity', 'status', 'actor_type'] as $f) if ($v = $r->query($f)) $q->where($f, $v);
        if ($v = $r->query('from')) $q->where('occurred_at', '>=', $v . ' 00:00:00');
        if ($v = $r->query('to'))   $q->where('occurred_at', '<=', $v . ' 23:59:59.999');
        return $q;
    }

    private function maskIp(?string $ip): ?string
    {
        if (! $ip || $this->svc->get('audit', 'mask_ip', '0') !== '1') return $ip;
        $p = explode('.', $ip);
        return count($p) === 4 ? "{$p[0]}.{$p[1]}.*.*" : substr($ip, 0, 9) . '…';
    }

    public function index(Request $r)
    {
        $per = min(max((int) $r->query('per_page', 20), 5), 100);
        $page = $this->query($r)->orderByDesc('occurred_at')->orderByDesc('id')
            ->select('id', 'occurred_at', 'actor_type', 'actor_name', 'actor_role', 'module', 'action', 'entity_label', 'severity', 'status', 'summary', 'ip')
            ->paginate($per);
        $page->getCollection()->transform(function ($x) { $x->ip = $this->maskIp($x->ip); return $x; });

        $stats = DB::table('sm_audit_logs')->selectRaw("COUNT(*) total, SUM(occurred_at >= CURDATE()) today, SUM(severity IN ('warning','critical')) alerts, SUM(status <> 'success') failed")->first();
        return $this->success(['items' => $page->items(), 'meta' => ['total' => $page->total(), 'page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $per], 'stats' => $stats]);
    }

    public function meta()
    {
        return $this->success(['modules' => DB::table('sm_audit_logs')->distinct()->orderBy('module')->pluck('module'),
                               'severities' => ['info', 'notice', 'warning', 'critical'], 'statuses' => ['success', 'failed', 'denied']]);
    }

    public function show(int $id)
    {
        $x = DB::table('sm_audit_logs')->find($id);
        if (! $x) return $this->error('Không tìm thấy', 404);
        $x->ip = $this->maskIp($x->ip);
        foreach (['old_values', 'new_values', 'meta'] as $k) $x->$k = $x->$k ? json_decode($x->$k, true) : null;
        unset($x->prev_hash, $x->row_hash);
        return $this->success($x);
    }

    public function export(Request $r)
    {
        $max = (int) $this->svc->get('audit', 'export_max_rows', 50000);
        $this->svc->audit($r->user(), 'audit.export', 'Xuất nhật ký hệ thống ra CSV', ['severity' => 'notice']);
        $q = $this->query($r)->orderByDesc('occurred_at')->limit($max)
            ->select('id', 'occurred_at', 'actor_type', 'actor_name', 'actor_role', 'module', 'action', 'entity_label', 'severity', 'status', 'summary', 'ip');
        return response()->streamDownload(function () use ($q) {
            $o = fopen('php://output', 'w');
            fwrite($o, "\xEF\xBB\xBF"); // BOM để Excel đọc đúng tiếng Việt
            fputcsv($o, ['ID', 'Thời gian', 'Loại', 'Người thực hiện', 'Vai trò', 'Phân hệ', 'Hành động', 'Đối tượng', 'Mức độ', 'Kết quả', 'Nội dung', 'IP']);
            foreach ($q->cursor() as $x) { $x->ip = $this->maskIp($x->ip); fputcsv($o, (array) $x); }
            fclose($o);
        }, 'nhat-ky-he-thong-' . now()->format('Ymd-His') . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
