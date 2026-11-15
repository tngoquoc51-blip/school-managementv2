<?php

namespace Modules\Catalog\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Catalog\Requests\DepartmentRequest;
use Modules\Catalog\Resources\DepartmentResource;
use Modules\Catalog\Services\CatalogService;
use Modules\Catalog\Services\DepartmentService;

class DepartmentController extends CatalogController
{
    public function __construct(private DepartmentService $service) {}

    protected function service(): CatalogService { return $this->service; }
    protected function resource(): string { return DepartmentResource::class; }
    protected function exportName(): string { return 'to_chuyen_mon'; }

    public function store(DepartmentRequest $request): JsonResponse
    {
        return $this->success($this->transform($this->service->store($request->validated())), 'ÄĂ£ thĂªm tá»• chuyĂªn mĂ´n', 201);
    }

    public function update(DepartmentRequest $request, int $id): JsonResponse
    {
        return $this->success($this->transform($this->service->update($id, $request->validated())), 'ÄĂ£ cáº­p nháº­t tá»• chuyĂªn mĂ´n');
    }
}
