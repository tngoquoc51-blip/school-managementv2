<?php

namespace Modules\Logs\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'enabled'        => ['sometimes', 'boolean'],
            'threshold'      => ['sometimes', 'integer', 'min:1', 'max:100000'],
            'window_minutes' => ['sometimes', 'integer', 'min:0', 'max:10080'],
            'severity'       => ['sometimes', 'in:info,notice,warning,critical'],
        ];
    }
}
