<?php

namespace Modules\Catalog\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Catalog\Models\CatalogGroup;
use Modules\Catalog\Requests\ImportItemsRequest;
use Modules\Catalog\Requests\ItemRequest;
use Modules\Catalog\Resources\ItemResource;
use Modules\Catalog\Services\CatalogService;
use Modules\Catalog\Services\ItemService;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ItemController extends CatalogController
{
    public function __construct(private ItemService $service) {}

    protected function service(): CatalogService { return $this->service; }
    protected function resource(): string { return ItemResource::class; }
    protected function exportName(): string { return 'danh_muc'; }

    /** GET groups/{group}/items */
    public function listByGroup(Request $request, int $group): JsonResponse
    {
        CatalogGroup::findOrFail($group);

        return $this->paginated($this->service->search($this->filters($request) + ['group_id' => $group], $this->perPage($request)));
    }

    /** POST groups/{group}/items */
    public function store(ItemRequest $request, int $group): JsonResponse
    {
        CatalogGroup::findOrFail($group);
        $item = $this->service->store($request->validated() + ['group_id' => $group]);

        return $this->success($this->transform($item), 'Đã thêm mục', 201);
    }

    public function update(ItemRequest $request, int $id): JsonResponse
    {
        return $this->success($this->transform($this->service->update($id, $request->validated())), 'Đã cập nhật mục');
    }

    /** GET groups/{group}/items/export */
    public function exportGroup(Request $request, int $group): StreamedResponse
    {
        $g = CatalogGroup::findOrFail($group);
        $request->query->set('group_id', (string) $g->id);

        return $this->export($request);
    }

    /** POST groups/{group}/items/import */
    public function import(ImportItemsRequest $request, int $group): JsonResponse
    {
        $result = $this->service->import(CatalogGroup::findOrFail($group), $request->validated('rows'), $request->validated('mode'));
        $msg = "Nhập xong: thêm {$result['created']}, cập nhật {$result['updated']}, bỏ qua {$result['skipped']}" . ($result['errors'] ? ', lỗi ' . count($result['errors']) : '');

        return $this->success($result, $msg);
    }
}
