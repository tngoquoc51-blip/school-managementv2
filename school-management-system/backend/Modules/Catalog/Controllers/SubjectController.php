<?php

namespace Modules\Catalog\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Catalog\Requests\SubjectRequest;
use Modules\Catalog\Resources\SubjectResource;
use Modules\Catalog\Services\CatalogService;
use Modules\Catalog\Services\SubjectService;

class SubjectController extends CatalogController
{
    public function __construct(private SubjectService $service) {}

    protected function service(): CatalogService { return $this->service; }
    protected function resource(): string { return SubjectResource::class; }
    protected function exportName(): string { return 'mon_hoc'; }

    public function store(SubjectRequest $request): JsonResponse
    {
        return $this->success($this->transform($this->service->store($request->validated())), 'Đã thêm môn học', 201);
    }

    public function update(SubjectRequest $request, int $id): JsonResponse
    {
        return $this->success($this->transform($this->service->update($id, $request->validated())), 'Đã cập nhật môn học');
    }
}
