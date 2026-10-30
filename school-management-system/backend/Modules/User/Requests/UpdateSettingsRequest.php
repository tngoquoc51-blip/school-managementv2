<?php

namespace Modules\User\Requests;

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
            'theme' => ['sometimes', 'in:light,dark,system'],
            'language' => ['sometimes', 'in:vi,en'],
            'timezone' => ['sometimes', 'timezone'],
            'date_format' => ['sometimes', 'in:DD/MM/YYYY,MM/DD/YYYY,YYYY-MM-DD'],
            'density' => ['sometimes', 'in:comfortable,compact'],
            'notifications' => ['sometimes', 'array'],
            'notifications.email' => ['sometimes', 'boolean'],
            'notifications.inapp' => ['sometimes', 'boolean'],
            'notifications.security' => ['sometimes', 'boolean'],
            'notifications.grades' => ['sometimes', 'boolean'],
            'notifications.finance' => ['sometimes', 'boolean'],
            'notifications.system' => ['sometimes', 'boolean'],
            'notifications.digest' => ['sometimes', 'in:instant,daily,weekly'],
            'notifications.quiet_enabled' => ['sometimes', 'boolean'],
            'notifications.quiet_from' => ['sometimes', 'date_format:H:i'],
            'notifications.quiet_to' => ['sometimes', 'date_format:H:i'],
        ];
    }
}
