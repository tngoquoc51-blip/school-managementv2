<?php

namespace Modules\Catalog\Requests;

class ImportItemsRequest extends CatalogFormRequest
{
    public function rules(): array
    {
        return [
            'mode' => ['required', 'in:skip,update'],
            'rows' => ['required', 'array', 'min:1', 'max:1000'],
            'rows.*' => ['array'],
        ];
    }

    public function attributes(): array
    {
        return ['mode' => 'Chế độ nhập', 'rows' => 'Dữ liệu nhập'];
    }
}
