<?php

namespace Modules\Catalog\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Catalog\Requests\GroupRequest;
use Modules\Catalog\Resources\GroupResource;
use Modules\Catalog\Services\CatalogService;
use Modules\Catalog\Services\GroupService;

class GroupController extends CatalogController
{
    public function __construct(private GroupService $service) {}

    protected function service(): CatalogService { return $this->service; }
    protected function resource(): string { return GroupResource::class; }
    protected function exportName(): string { return 'nhom_danh_muc'; }

    public function store(GroupRequest $request): JsonResponse
    {
        return $this->success($this->transform($this->service->store($request->validated())), 'Đã tạo nhóm danh mục', 201);
    }

    public function update(GroupRequest $request, int $id): JsonResponse
    {
        return $this->success($this->transform($this->service->update($id, $request->validated())), 'Đã cập nhật nhóm danh mục');
    }
}
