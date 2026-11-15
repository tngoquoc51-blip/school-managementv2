<?php

namespace Modules\Catalog\Requests;

use Illuminate\Validation\Rule;

class DepartmentRequest extends CatalogFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->normalizeCode();
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:30', 'regex:/^[A-Z0-9_\-]+$/', Rule::unique('cat_departments', 'code')->ignore($this->route('id'))],
            'name' => ['required', 'string', 'max:191'],
            'description' => ['nullable', 'string', 'max:500'],
            'head_name' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s().]{6,20}$/'],
            'email' => ['nullable', 'string', 'email', 'max:120'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['boolean'],
        ];
    }

    public function attributes(): array
    {
        return ['code' => 'Mã tổ', 'name' => 'Tên tổ', 'description' => 'Mô tả', 'head_name' => 'Tổ trưởng', 'phone' => 'Điện thoại', 'email' => 'Email', 'sort_order' => 'Thứ tự'];
    }
}
