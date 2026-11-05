<?php

namespace Modules\Logs\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LogFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'q'          => ['nullable', 'string', 'max:100'],
            'module'     => ['nullable', 'string', 'max:200'],
            'severity'   => ['nullable', 'string', 'max:60'],
            'status'     => ['nullable', 'string', 'max:40'],
            'actor_type' => ['nullable', 'string', 'max:40'],
            'action'     => ['nullable', 'string', 'max:60'],
            'actor_id'   => ['nullable', 'integer'],
            'actor_role' => ['nullable', 'string', 'max:30'],
            'ip'         => ['nullable', 'string', 'max:45'],
            'entity_type'=> ['nullable', 'string', 'max:40'],
            'entity_id'  => ['nullable', 'string', 'max:64'],
            'request_id' => ['nullable', 'string', 'max:36'],
            'from'       => ['nullable', 'date'],
            'to'         => ['nullable', 'date'],
            'sort'       => ['nullable', 'string', 'max:20'],
            'dir'        => ['nullable', 'in:asc,desc'],
            'page'       => ['nullable', 'integer', 'min:1'],
            'per_page'   => ['nullable', 'integer', 'min:1', 'max:200'],
        ];
    }

    public function filters(): array
    {
        return $this->safe()->except(['page', 'per_page']);
    }
}
