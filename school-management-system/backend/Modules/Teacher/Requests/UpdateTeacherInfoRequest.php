<?php

namespace Modules\Teacher\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTeacherInfoRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'phone'                      => ['nullable', 'regex:/^(0|\+84)[0-9]{9,10}$/'],
            'gender'                     => ['nullable', 'in:male,female,other'],
            'birth_date'                 => ['nullable', 'date', 'before:today'],
            'id_number'                  => ['nullable', 'regex:/^[0-9]{9}$|^[0-9]{12}$/'],
            'address'                    => ['nullable', 'string', 'max:255'],
            'job_title'                  => ['nullable', 'string', 'max:100'],
            'department'                 => ['nullable', 'string', 'max:100'],
            'joined_at'                  => ['nullable', 'date'],
            'bio'                        => ['nullable', 'string', 'max:2000'],
            'email'                      => ['nullable', 'email', 'max:120'],
            'ethnicity'                  => ['nullable', 'string', 'max:40'],
            'religion'                   => ['nullable', 'string', 'max:40'],
            'hometown'                   => ['nullable', 'string', 'max:255'],
            'degree_level'               => ['nullable', 'string', 'max:40'],
            'major'                      => ['nullable', 'string', 'max:120'],
            'career_start_year'          => ['nullable', 'integer', 'between:1960,2100'],
            'emergency_contact_name'     => ['nullable', 'string', 'max:100'],
            'emergency_contact_phone'    => ['nullable', 'regex:/^(0|\+84)[0-9]{9,10}$/'],
            'emergency_contact_relation' => ['nullable', 'string', 'max:50'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.email' => 'Email không hợp lệ.',
            'phone.regex' => 'Số điện thoại không hợp lệ (VD: 0912345678).',
            'emergency_contact_phone.regex' => 'SĐT người liên hệ khẩn cấp không hợp lệ.',
            'id_number.regex' => 'CCCD gồm 12 số (hoặc CMND 9 số).',
            'birth_date.before' => 'Ngày sinh phải nhỏ hơn ngày hiện tại.',
        ];
    }
}
