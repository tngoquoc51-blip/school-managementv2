<?php

namespace Modules\Catalog\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Catalog\Services\UserDirectoryService;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserDirectoryController extends Controller
{
    use ApiResponse;

    private const FILTERS = ['search', 'type', 'status', 'role', 'sort', 'dir'];

    public function __construct(private UserDirectoryService $service) {}

    public function summary(): JsonResponse
    {
        return $this->success($this->service->summary());
    }

    public function index(Request $request): JsonResponse
    {
        $page = $this->service->paginate($request->only(self::FILTERS), max(5, min((int) $request->query('per_page', 15), 100)));

        return $this->success([
            'items' => $page->getCollection()->values()->all(),
            'meta' => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(),
                'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem(),
            ],
        ]);
    }

    public function roles(): JsonResponse
    {
        return $this->success(['roles' => $this->service->roles(), 'permissions' => $this->service->permissionList()]);
    }

    public function status(Request $request, string $type, int $id): JsonResponse
    {
        $data = $request->validate(['status' => 'required|in:active,inactive,locked']);
        $this->service->setStatus($type, $id, $data['status']);

        return $this->success(['status' => $data['status']], ['active' => 'Đã mở khóa tài khoản', 'locked' => 'Đã khóa tài khoản', 'inactive' => 'Đã ngừng sử dụng tài khoản'][$data['status']]);
    }

    public function resetPassword(string $type, int $id): JsonResponse
    {
        return $this->success($this->service->resetPassword($type, $id), 'Đã cấp mật khẩu tạm thời');
    }

    public function setRoles(Request $request, string $type, int $id): JsonResponse
    {
        $data = $request->validate(['roles' => 'required|array|min:1', 'roles.*' => 'string|max:100']);

        return $this->success($this->service->setRoles($type, $id, $data['roles']), 'Đã cập nhật chức năng');
    }

    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate(['action' => 'required|in:lock,unlock,deactivate', 'keys' => 'required|array|min:1|max:200', 'keys.*' => 'string|max:30']);
        $r = $this->service->bulkStatus($data['action'], $data['keys']);

        return $this->success($r, "Đã xử lý {$r['processed']} tài khoản" . ($r['skipped'] ? ', bỏ qua ' . count($r['skipped']) : ''));
    }

    public function setRolePermissions(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['permissions' => 'present|array', 'permissions.*' => 'string|max:150']);

        return $this->success($this->service->setRolePermissions($id, $data['permissions']), 'Đã cập nhật quyền của chức năng');
    }

    public function export(Request $request): StreamedResponse
    {
        $rows = $this->service->export($request->only(self::FILTERS));

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Loại', 'Họ tên', 'Tên đăng nhập', 'Email', 'Chức năng', 'Trạng thái', 'Đăng nhập gần nhất', 'Ngày tạo']);
            foreach ($rows as $r) {
                fputcsv($out, [$r['type_label'], $r['name'], $r['username'], $r['email'], implode('; ', $r['role_labels']), $r['status'], $r['last_login_at'], $r['created_at']]);
            }
            fclose($out);
        }, 'nguoi_dung_' . date('Ymd_His') . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
