<?php

namespace Modules\User\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $phone = ['nullable', 'regex:/^(0|\+84)[0-9]{9,10}$/'];

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($this->user()->id)],
            'phone' => $phone,
            'gender' => ['nullable', 'in:male,female,other'],
            'birth_date' => ['nullable', 'date', 'before:today'],
            'id_number' => ['nullable', 'regex:/^[0-9]{9,12}$/'],
            'address' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:100'],
            'department' => ['nullable', 'string', 'max:100'],
            'employee_code' => ['nullable', 'string', 'max:30'],
            'joined_at' => ['nullable', 'date'],
            'bio' => ['nullable', 'string', 'max:500'],
            'emergency_contact_name' => ['nullable', 'string', 'max:100'],
            'emergency_contact_phone' => $phone,
            'emergency_contact_relation' => ['nullable', 'string', 'max:50'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Vui lòng nhập họ và tên.',
            'email.required' => 'Vui lòng nhập email.',
            'email.email' => 'Email không đúng định dạng.',
            'email.unique' => 'Email này đã được tài khoản khác sử dụng.',
            'phone.regex' => 'Số điện thoại không hợp lệ (ví dụ 0901234567).',
            'emergency_contact_phone.regex' => 'Số điện thoại không hợp lệ (ví dụ 0901234567).',
            'birth_date.before' => 'Ngày sinh phải trước ngày hôm nay.',
            'id_number.regex' => 'Số CCCD/CMND gồm 9 đến 12 chữ số.',
            'bio.max' => 'Giới thiệu tối đa 500 ký tự.',
        ];
    }
}
