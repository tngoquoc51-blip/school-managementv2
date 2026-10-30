<?php

namespace Modules\User\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadAvatarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048', 'dimensions:min_width=100,min_height=100'],
        ];
    }

    public function messages(): array
    {
        return [
            'avatar.required' => 'Vui lòng chọn một ảnh.',
            'avatar.image' => 'Tệp được chọn không phải là ảnh.',
            'avatar.mimes' => 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.',
            'avatar.max' => 'Ảnh không được vượt quá 2 MB.',
            'avatar.dimensions' => 'Ảnh cần có kích thước tối thiểu 100×100 px.',
        ];
    }
}
