<?php

namespace Modules\Logs\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AlertActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['note' => ['nullable', 'string', 'max:255']];
    }
}
