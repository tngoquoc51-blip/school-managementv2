<?php

namespace Modules\Homework\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateStateRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'starred' => ['sometimes', 'boolean'],
            'progress' => ['sometimes', 'integer', 'between:0,100'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }
}
