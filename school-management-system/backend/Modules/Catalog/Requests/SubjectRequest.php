<?php

namespace Modules\Catalog\Requests;

use Illuminate\Validation\Rule;
use Modules\Catalog\Services\SubjectService;

class SubjectRequest extends CatalogFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->normalizeCode();
        if ($this->input('department_id') === '') {
            $this->merge(['department_id' => null]);
        }
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:30', 'regex:/^[A-Z0-9_\-]+$/', Rule::unique('cat_subjects', 'code')->ignore($this->route('id'))],
            'name' => ['required', 'string', 'max:191'],
            'short_name' => ['nullable', 'string', 'max:50'],
            'subject_group' => ['required', Rule::in(array_keys(SubjectService::GROUPS))],
            'department_id' => ['nullable', 'integer', 'exists:cat_departments,id'],
            'periods_per_week' => ['required', 'numeric', 'between:0,20'],
            'coefficient' => ['required', 'numeric', 'between:0,5'],
            'kind' => ['required', Rule::in(array_keys(SubjectService::KINDS))],
            'grading_type' => ['required', Rule::in(array_keys(SubjectService::GRADING))],
            'applicable_grades' => ['nullable', 'array'],
            'applicable_grades.*' => ['integer', Rule::in([10, 11, 12])],
            'description' => ['nullable', 'string', 'max:500'],
            'color' => $this->color(),
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['boolean'],
        ];
    }

    public function attributes(): array
    {
        return [
            'code' => 'Mã môn', 'name' => 'Tên môn', 'short_name' => 'Tên viết tắt', 'subject_group' => 'Nhóm môn',
            'department_id' => 'Tổ chuyên môn', 'periods_per_week' => 'Số tiết/tuần', 'coefficient' => 'Hệ số',
            'kind' => 'Tính chất', 'grading_type' => 'Hình thức đánh giá', 'applicable_grades' => 'Khối áp dụng', 'sort_order' => 'Thứ tự',
        ];
    }
}
