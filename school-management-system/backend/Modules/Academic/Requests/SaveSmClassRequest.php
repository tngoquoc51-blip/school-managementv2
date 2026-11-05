<?php

namespace Modules\Academic\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveSmClassRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('id');

        return [
            'school_year_id'      => ['required', 'integer', 'exists:sm_school_years,id'],
            'grade'               => ['required', 'integer', Rule::in([10, 11, 12])],
            'name'                => [
                'required', 'string', 'max:10',
                Rule::unique('sm_classes', 'name')
                    ->where(fn ($q) => $q->where('school_year_id', $this->input('school_year_id')))
                    ->ignore($id),
            ],
            'homeroom_teacher_id' => ['nullable', 'integer', 'exists:sm_teachers,id'],
            'room'                => ['nullable', 'string', 'max:30'],
            'capacity'            => ['required', 'integer', 'between:10,60'],
            'status'              => ['required', Rule::in(['active', 'paused', 'closed'])],
            'note'                => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.unique'       => 'Tên lớp đã tồn tại trong năm học này.',
            'name.required'     => 'Vui lòng nhập tên lớp.',
            'capacity.between'  => 'Sĩ số tối đa phải từ 10 đến 60.',
            'grade.in'          => 'Khối phải là 10, 11 hoặc 12.',
        ];
    }
}
