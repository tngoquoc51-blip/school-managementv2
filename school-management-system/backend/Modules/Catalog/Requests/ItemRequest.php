<?php

namespace Modules\Catalog\Requests;

use Illuminate\Validation\Rule;
use Modules\Catalog\Models\CatalogItem;

class ItemRequest extends CatalogFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->normalizeCode();
    }

    public function rules(): array
    {
        // Tạo mới: nhóm lấy từ URL; cập nhật: lấy từ chính mục đang sửa.
        $groupId = $this->route('group') ?? CatalogItem::whereKey($this->route('id'))->value('group_id');

        return [
            'code' => ['required', 'string', 'max:50', 'regex:/^[A-Z0-9_\-\.]+$/',
                Rule::unique('cat_items', 'code')->where('group_id', $groupId)->ignore($this->route('id'))],
            'name' => ['required', 'string', 'max:191'],
            'short_name' => ['nullable', 'string', 'max:50'],
            'value' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
            'color' => $this->color(),
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['boolean'],
        ];
    }

    public function attributes(): array
    {
        return ['code' => 'Mã', 'name' => 'Tên', 'short_name' => 'Tên viết tắt', 'value' => 'Giá trị', 'description' => 'Mô tả', 'color' => 'Màu', 'sort_order' => 'Thứ tự'];
    }

    public function messages(): array
    {
        return parent::messages() + ['code.regex' => 'Mã chỉ gồm chữ HOA, số, dấu gạch dưới, gạch ngang hoặc dấu chấm.'];
    }
}
