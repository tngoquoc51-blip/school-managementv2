<?php

namespace Modules\Catalog\Requests;

class BulkRequest extends CatalogFormRequest
{
    public function rules(): array
    {
        return [
            'action' => ['required', 'in:activate,deactivate,delete'],
            'ids' => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['integer'],
        ];
    }

    public function attributes(): array
    {
        return ['action' => 'Thao tác', 'ids' => 'Danh sách chọn'];
    }
}
