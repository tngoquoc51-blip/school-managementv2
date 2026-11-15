<?php

namespace Modules\Catalog\Requests;

use Illuminate\Validation\Rule;
use Modules\Catalog\Services\RoomService;

class RoomRequest extends CatalogFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->normalizeCode();
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:30', 'regex:/^[A-Z0-9_\-]+$/', Rule::unique('cat_rooms', 'code')->ignore($this->route('id'))],
            'name' => ['required', 'string', 'max:191'],
            'room_type' => ['required', Rule::in(array_keys(RoomService::TYPES))],
            'building' => ['nullable', 'string', 'max:50'],
            'floor' => ['required', 'integer', 'between:-2,30'],
            'capacity' => ['required', 'integer', 'between:0,2000'],
            'facilities' => ['nullable', 'string', 'max:500'],
            'status' => ['required', Rule::in(array_keys(RoomService::STATUSES))],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['boolean'],
        ];
    }

    public function attributes(): array
    {
        return ['code' => 'Mã phòng', 'name' => 'Tên phòng', 'room_type' => 'Loại phòng', 'building' => 'Tòa nhà', 'floor' => 'Tầng', 'capacity' => 'Sức chứa', 'facilities' => 'Trang thiết bị', 'status' => 'Tình trạng', 'sort_order' => 'Thứ tự'];
    }
}
