<?php

namespace Modules\Catalog\Requests;

use Illuminate\Validation\Rule;

class GroupRequest extends CatalogFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->normalizeCode(false);
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:50', 'regex:/^[a-z][a-z0-9_]*$/', Rule::unique('cat_groups', 'code')->ignore($this->route('id'))],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:500'],
            'icon' => ['nullable', 'string', 'max:30'],
            'color' => $this->color(),
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['boolean'],
        ];
    }

    public function attributes(): array
    {
        return ['code' => 'Mã nhóm', 'name' => 'Tên nhóm', 'description' => 'Mô tả', 'color' => 'Màu', 'sort_order' => 'Thứ tự'];
    }

    public function messages(): array
    {
        return parent::messages() + ['code.regex' => 'Mã nhóm viết thường, bắt đầu bằng chữ, chỉ gồm chữ/số/gạch dưới (vd: loai_hoc_bong).'];
    }
}
