<?php

namespace Modules\Catalog\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/** Request gốc: luôn trả lỗi 422 theo envelope {success,message,errors} + thông báo tiếng Việt. */
abstract class CatalogFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại.',
            'errors' => $validator->errors()->toArray(),
        ], 422));
    }

    /** Chuẩn hóa mã: bỏ khoảng trắng, viết HOA. */
    protected function normalizeCode(bool $upper = true): void
    {
        if ($this->has('code')) {
            $code = trim((string) $this->input('code'));
            $this->merge(['code' => $upper ? strtoupper($code) : strtolower($code)]);
        }
    }

    public function messages(): array
    {
        return [
            'required' => ':attribute không được để trống.',
            'unique' => ':attribute đã tồn tại.',
            'max.string' => ':attribute tối đa :max ký tự.',
            'min.string' => ':attribute tối thiểu :min ký tự.',
            'in' => ':attribute không hợp lệ.',
            'regex' => ':attribute sai định dạng.',
            'exists' => ':attribute không tồn tại.',
            'numeric' => ':attribute phải là số.',
            'integer' => ':attribute phải là số nguyên.',
            'between.numeric' => ':attribute phải nằm trong khoảng :min – :max.',
            'min.numeric' => ':attribute tối thiểu là :min.',
            'max.numeric' => ':attribute tối đa là :max.',
            'boolean' => ':attribute phải là đúng/sai.',
            'array' => ':attribute không hợp lệ.',
            'email' => ':attribute không đúng định dạng email.',
        ];
    }

    protected function color(): array
    {
        return ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'];
    }
}
