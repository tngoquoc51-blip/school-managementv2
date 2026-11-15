<?php

namespace Modules\Catalog\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Catalog\Requests\RoomRequest;
use Modules\Catalog\Resources\RoomResource;
use Modules\Catalog\Services\CatalogService;
use Modules\Catalog\Services\RoomService;

class RoomController extends CatalogController
{
    public function __construct(private RoomService $service) {}

    protected function service(): CatalogService { return $this->service; }
    protected function resource(): string { return RoomResource::class; }
    protected function exportName(): string { return 'phong_hoc'; }

    public function store(RoomRequest $request): JsonResponse
    {
        return $this->success($this->transform($this->service->store($request->validated())), 'Đã thêm phòng học', 201);
    }

    public function update(RoomRequest $request, int $id): JsonResponse
    {
        return $this->success($this->transform($this->service->update($id, $request->validated())), 'Đã cập nhật phòng học');
    }
}
