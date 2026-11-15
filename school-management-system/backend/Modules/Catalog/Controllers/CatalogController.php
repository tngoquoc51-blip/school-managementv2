<?php

namespace Modules\Catalog\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Catalog\Requests\BulkRequest;
use Modules\Catalog\Services\CatalogService;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Controller gốc: index / show / toggle / destroy / bulk / export dùng chung cho mọi danh mục. */
abstract class CatalogController extends Controller
{
    use ApiResponse;

    protected const FILTER_KEYS = ['search', 'status', 'sort', 'dir', 'group_id', 'department_id', 'subject_group', 'kind', 'grading_type', 'room_type', 'building', 'room_status'];

    abstract protected function service(): CatalogService;

    /** @return class-string<\Illuminate\Http\Resources\Json\JsonResource> */
    abstract protected function resource(): string;

    /** Tên file khi xuất CSV. */
    abstract protected function exportName(): string;

    public function index(Request $request): JsonResponse
    {
        return $this->paginated($this->service()->search($this->filters($request), $this->perPage($request)));
    }

    public function show(int $id): JsonResponse
    {
        return $this->success($this->transform($this->service()->show($id)));
    }

    public function toggle(int $id): JsonResponse
    {
        $model = $this->service()->toggle($id);

        return $this->success($this->transform($model), $model->is_active ? 'Đã bật hoạt động' : 'Đã ngừng hoạt động');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $log = $this->service()->remove($id, $request->boolean('force'));

        return $this->success(['audit_id' => $log->id], 'Đã xóa');
    }

    public function bulk(BulkRequest $request): JsonResponse
    {
        $result = $this->service()->bulk($request->validated('action'), $request->validated('ids'));
        $label = ['activate' => 'bật hoạt động', 'deactivate' => 'ngừng hoạt động', 'delete' => 'xóa'][$result['action']];
        $message = "Đã {$label} {$result['processed']} mục" . ($result['skipped'] ? ', bỏ qua ' . count($result['skipped']) : '');

        return $this->success($result, $message);
    }

    public function export(Request $request): StreamedResponse
    {
        $service = $this->service();
        $filters = $this->filters($request);
        $filename = $this->exportName() . '_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($service, $filters) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM để Excel đọc đúng tiếng Việt
            fputcsv($out, $service->exportHeaders());
            foreach ($service->exportRows($filters) as $row) {
                fputcsv($out, $row);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    // ---- helpers ----------------------------------------------------------

    protected function transform($model): array
    {
        $class = $this->resource();

        return (new $class($model))->resolve();
    }

    protected function paginated(LengthAwarePaginator $page, string $message = 'OK'): JsonResponse
    {
        $class = $this->resource();

        return $this->success([
            'items' => $page->getCollection()->map(fn ($m) => (new $class($m))->resolve())->values()->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'from' => $page->firstItem(),
                'to' => $page->lastItem(),
            ],
        ], $message);
    }

    protected function perPage(Request $request, int $default = 15): int
    {
        return max(5, min((int) $request->query('per_page', $default), 200));
    }

    protected function filters(Request $request): array
    {
        return array_filter($request->only(self::FILTER_KEYS), fn ($v) => $v !== null && $v !== '');
    }
}
