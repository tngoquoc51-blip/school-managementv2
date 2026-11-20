<?php

namespace Modules\Waiver\Controllers;

use App\Core\Traits\ApiResponse;
use App\Http\Controllers\Controller;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Waiver\Services\WaiverService;

class WaiverController extends Controller
{
    use ApiResponse;

    /** Vai trò được xem module. */
    private const VIEW_ROLES = ['accountant', 'principal', 'super_admin', 'admin'];

    public function __construct(private WaiverService $svc) {}

    // ------------------------------------------------------------ helpers
    private function roles(Request $r): array
    {
        $u = $r->user();
        if (!$u) return [];
        $roles = method_exists($u, 'getRoleNames') ? $u->getRoleNames()->all() : [];
        if (!empty($u->role)) $roles[] = $u->role;
        return array_map('strtolower', $roles);
    }

    private function actor(Request $r): string
    {
        $u = $r->user();
        return (string) ($u->full_name ?? $u->name ?? $u->username ?? $u->email ?? 'Hệ thống');
    }

    private function canView(Request $r): bool
    {
        return (bool) array_intersect($this->roles($r), self::VIEW_ROLES);
    }

    private function canApprove(Request $r): bool
    {
        $allowed = array_map('trim', explode(',', $this->svc->setting('waiver_approve_roles', 'accountant,principal,super_admin')));
        return (bool) array_intersect($this->roles($r), $allowed);
    }

    /** Bọc xử lý: kiểm tra quyền + chuyển lỗi nghiệp vụ thành JSON 422. */
    private function run(Request $r, callable $fn, bool $needApprove = false): JsonResponse
    {
        if (!$this->canView($r)) return $this->error('Bạn không có quyền truy cập chức năng này.', 403);
        if ($needApprove && !$this->canApprove($r)) return $this->error('Bạn không có quyền duyệt/thu hồi miễn giảm.', 403);
        try {
            return $this->success($fn());
        } catch (DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    // ------------------------------------------------------------ meta + thống kê
    public function meta(Request $r)
    {
        return $this->run($r, fn () => $this->svc->meta() + ['can_approve' => $this->canApprove($r), 'me' => $this->actor($r)]);
    }

    public function stats(Request $r)
    {
        return $this->run($r, fn () => $this->svc->stats($this->svc->yearId($r->integer('school_year_id') ?: null)));
    }

    // ------------------------------------------------------------ đơn đề nghị
    public function requests(Request $r)
    {
        return $this->run($r, fn () => $this->svc->listRequests($r->all()));
    }

    public function showRequest(Request $r, int $id)
    {
        return $this->run($r, fn () => $this->svc->showRequest($id));
    }

    public function createRequest(Request $r)
    {
        $d = $r->validate([
            'student_id' => 'required|integer', 'school_year_id' => 'required|integer', 'type_id' => 'required|integer',
            'percent' => 'required|integer|min:1|max:100', 'terms' => 'required|array|min:1', 'terms.*' => 'in:HK1,HK2',
            'reason' => 'nullable|string|max:500', 'proof_note' => 'nullable|string|max:255',
            'priority' => 'nullable|in:normal,high', 'approve_now' => 'nullable|boolean',
        ]);
        return $this->run($r, function () use ($r, $d) {
            $actor = $this->actor($r);
            $created = $this->svc->createRequest($d, $actor);
            $approved = null;
            if (!empty($d['approve_now']) && $this->canApprove($r)) $approved = $this->svc->approve($created['id'], 'Duyệt ngay khi lập đơn', $actor);
            return $created + ['approved' => $approved !== null, 'invoices' => $approved['invoices'] ?? null];
        });
    }

    public function approve(Request $r, int $id)
    {
        $r->validate(['note' => 'nullable|string|max:250', 'apply_invoices' => 'nullable|boolean']);
        return $this->run($r, fn () => $this->svc->approve($id, $r->input('note'), $this->actor($r), $r->has('apply_invoices') ? $r->boolean('apply_invoices') : null), true);
    }

    public function reject(Request $r, int $id)
    {
        $d = $r->validate(['note' => 'required|string|min:3|max:250']);
        return $this->run($r, function () use ($id, $d, $r) { $this->svc->reject($id, $d['note'], $this->actor($r)); return true; }, true);
    }

    public function cancel(Request $r, int $id)
    {
        return $this->run($r, function () use ($id, $r) { $this->svc->cancel($id, $this->actor($r)); return true; });
    }

    public function bulkApprove(Request $r)
    {
        $d = $r->validate(['ids' => 'required|array|min:1|max:200', 'ids.*' => 'integer', 'note' => 'nullable|string|max:250']);
        return $this->run($r, fn () => $this->svc->bulkApprove($d['ids'], $d['note'] ?? null, $this->actor($r)), true);
    }

    // ------------------------------------------------------------ bản ghi đang áp dụng
    public function records(Request $r)
    {
        return $this->run($r, fn () => $this->svc->listRecords($r->all()));
    }

    public function revoke(Request $r, int $id)
    {
        $d = $r->validate(['reason' => 'required|string|min:3|max:250']);
        return $this->run($r, fn () => $this->svc->revoke($id, $d['reason'], $this->actor($r)), true);
    }

    public function recalc(Request $r)
    {
        $d = $r->validate(['student_id' => 'required|integer', 'school_year_id' => 'required|integer', 'apply' => 'nullable|boolean']);
        return $this->run($r, fn () => $this->svc->recalcInvoices((int) $d['student_id'], (int) $d['school_year_id'], (bool) ($d['apply'] ?? false), $this->actor($r)), true);
    }

    // ------------------------------------------------------------ học sinh + xem trước
    public function searchStudents(Request $r)
    {
        $q = trim((string) $r->query('q'));
        return $this->run($r, fn () => mb_strlen($q) < 2 ? [] : $this->svc->searchStudents($q, $this->svc->yearId($r->integer('school_year_id') ?: null)));
    }

    public function impact(Request $r)
    {
        $d = $r->validate(['student_id' => 'required|integer', 'school_year_id' => 'required|integer', 'percent' => 'nullable|integer|min:0|max:100', 'terms' => 'nullable|array']);
        return $this->run($r, fn () => $this->svc->impact((int) $d['student_id'], (int) $d['school_year_id'], (int) ($d['percent'] ?? 0), $d['terms'] ?? []));
    }

    // ------------------------------------------------------------ danh mục chính sách
    public function types(Request $r)
    {
        return $this->run($r, fn () => $this->svc->listTypes());
    }

    public function saveType(Request $r, ?int $id = null)
    {
        $d = $r->validate([
            'code' => ['required', 'string', 'max:30', 'regex:/^[a-z0-9_]+$/'], 'label' => 'required|string|max:120',
            'description' => 'nullable|string|max:255', 'default_percent' => 'required|integer|min:0|max:100',
            'applies_to' => 'nullable|string|max:80', 'legal_basis' => 'nullable|string|max:160',
            'required_docs' => 'nullable|string|max:255', 'is_active' => 'nullable|boolean', 'sort_order' => 'nullable|integer',
        ]);
        return $this->run($r, fn () => ['id' => $this->svc->saveType($id, $d, $this->actor($r))], true);
    }

    public function toggleType(Request $r, int $id)
    {
        return $this->run($r, fn () => ['is_active' => $this->svc->toggleType($id, $this->actor($r))], true);
    }

    // ------------------------------------------------------------ nhật ký + xuất
    public function logs(Request $r)
    {
        return $this->run($r, fn () => $this->svc->listLogs($r->all()));
    }

    public function export(Request $r)
    {
        if (!$this->canView($r)) return $this->error('Bạn không có quyền truy cập chức năng này.', 403);
        $what = $r->query('what') === 'requests' ? 'requests' : 'records';
        [$head, $rows] = $this->svc->exportRows($what, $r->all());
        $name = "mien-giam-hoc-phi-$what-" . now()->format('Ymd-His') . '.csv';

        return response()->streamDownload(function () use ($head, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM để Excel đọc đúng tiếng Việt
            fputcsv($out, $head);
            foreach ($rows as $row) fputcsv($out, array_values((array) $row));
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
