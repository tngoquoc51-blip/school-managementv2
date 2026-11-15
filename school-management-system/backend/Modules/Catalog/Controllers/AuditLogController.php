<?php

namespace Modules\Catalog\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Catalog\Resources\AuditLogResource;
use Modules\Catalog\Services\AuditService;

class AuditLogController extends Controller
{
    use ApiResponse;

    public function __construct(private AuditService $service) {}

    public function index(Request $request): JsonResponse
    {
        $page = $this->service->paginate(
            $request->only(['entity', 'action', 'search', 'from', 'to']),
            max(5, min((int) $request->query('per_page', 20), 100))
        );

        return $this->success([
            'items' => $page->getCollection()->map(fn ($l) => (new AuditLogResource($l))->resolve())->values()->all(),
            'meta' => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(),
                'total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem(),
            ],
        ]);
    }

    public function restore(int $id): JsonResponse
    {
        $model = $this->service->restore($id);

        return $this->success(['entity_id' => $model->getKey(), 'label' => $model->label()], 'Đã khôi phục "' . $model->label() . '"');
    }
}
