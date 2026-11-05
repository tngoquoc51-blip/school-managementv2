<?php

namespace Modules\Logs\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'retention_days'  => ['sometimes', 'integer', 'min:30', 'max:3650'],
            'mask_ip'         => ['sometimes', 'boolean'],
            'hash_chain'      => ['sometimes', 'boolean'],
            'export_max_rows' => ['sometimes', 'integer', 'min:100', 'max:200000'],
        ];
    }
}
