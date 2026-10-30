<?php

namespace Modules\User\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class ChangePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', 'different:current_password',
                Password::min(8)->mixedCase()->numbers()->symbols()],
            'logout_others' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'current_password.required' => 'Vui lòng nhập mật khẩu hiện tại.',
            'password.required' => 'Vui lòng nhập mật khẩu mới.',
            'password.confirmed' => 'Xác nhận mật khẩu không khớp.',
            'password.different' => 'Mật khẩu mới phải khác mật khẩu hiện tại.',
            'password.min' => 'Mật khẩu mới tối thiểu 8 ký tự.',
            'password.mixed' => 'Mật khẩu mới cần có cả chữ hoa và chữ thường.',
            'password.numbers' => 'Mật khẩu mới cần có ít nhất một chữ số.',
            'password.symbols' => 'Mật khẩu mới cần có ít nhất một ký tự đặc biệt.',
        ];
    }
}
