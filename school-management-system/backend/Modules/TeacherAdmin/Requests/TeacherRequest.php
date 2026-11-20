<?php

namespace Modules\TeacherAdmin\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeacherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('id');
        return [
            'code'            => ['required', 'string', 'max:30', Rule::unique('sm_teachers', 'code')->ignore($id)],
            'full_name'       => ['required', 'string', 'max:120'],
            'gender'          => ['nullable', 'string', 'max:10'],
            'main_subject_id' => ['nullable', 'integer', 'exists:sm_subjects,id'],
            'subject_ids'     => ['nullable', 'array'],
            'subject_ids.*'   => ['integer', 'exists:sm_subjects,id'],
            'birth_date'      => ['nullable', 'date'],
            'phone'           => ['nullable', 'string', 'max:20'],
            'email'           => ['nullable', 'email', 'max:120'],
            'address'         => ['nullable', 'string', 'max:200'],
            'degree'          => ['nullable', Rule::in(['bachelor', 'master', 'doctor', 'other'])],
            'position'        => ['nullable', 'string', 'max:30'],
            'hire_date'       => ['nullable', 'date'],
            'contract'        => ['nullable', Rule::in(['permanent', 'contract', 'probation', 'part_time'])],
            'status'          => ['nullable', Rule::in(['active', 'leave', 'inactive', 'retired'])],
            'note'            => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.required'    => 'Vui lòng nhập mã giáo viên',
            'code.unique'      => 'Mã giáo viên đã tồn tại',
            'full_name.required' => 'Vui lòng nhập họ tên',
            'email.email'      => 'Email không hợp lệ',
        ];
    }
}
