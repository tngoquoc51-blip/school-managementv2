<?php

namespace Modules\Homework\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCommentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return ['body' => ['required', 'string', 'min:2', 'max:1000']];
    }

    public function messages(): array
    {
        return ['body.required' => 'Hãy nhập nội dung câu hỏi.', 'body.min' => 'Câu hỏi quá ngắn.'];
    }
}
