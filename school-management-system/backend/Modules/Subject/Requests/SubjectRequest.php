<?php

namespace Modules\Subject\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SubjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => strtoupper(trim((string) $this->input('code')))]);
        }
    }

    public function rules(): array
    {
        $id = $this->route('id');

        return [
            'code'             => ['required', 'regex:/^[A-Z0-9_-]{1,10}$/', Rule::unique('sm_subjects', 'code')->ignore($id)],
            'name'             => ['required', 'string', 'max:60'],
            'kind'             => ['required', Rule::in(['score', 'pass'])],
            'category'         => ['nullable', Rule::in(['required', 'elective', 'topic'])],
            'periods_per_week' => ['required', 'integer', 'between:1,10'],
            'group_id'         => ['nullable', 'integer', 'exists:sm_subj_groups,id'],
            'color'            => ['nullable', 'string', 'max:20'],
            'grades'           => ['nullable', 'array'],
            'grades.*'         => ['integer', Rule::in([10, 11, 12])],
            'description'      => ['nullable', 'string', 'max:500'],
            'status'           => ['nullable', Rule::in(['active', 'inactive'])],
            'sort_order'       => ['nullable', 'integer', 'between:1,127'],
            'sync_periods'     => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.required' => 'Vui lòng nhập mã môn',
            'code.regex'    => 'Mã môn chỉ gồm chữ HOA, số, - hoặc _ (tối đa 10 ký tự)',
            'code.unique'   => 'Mã môn đã tồn tại',
            'name.required' => 'Vui lòng nhập tên môn',
            'name.max'      => 'Tên môn tối đa 60 ký tự',
            'periods_per_week.between' => 'Số tiết/tuần phải từ 1 đến 10',
            'group_id.exists' => 'Tổ bộ môn không tồn tại',
        ];
    }
}
