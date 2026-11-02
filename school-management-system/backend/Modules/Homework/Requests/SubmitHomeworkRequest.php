<?php

namespace Modules\Homework\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SubmitHomeworkRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'content' => ['nullable', 'string', 'max:20000'],
            'link_url' => ['nullable', 'url', 'max:500'],
            'files' => ['nullable', 'array', 'max:5'],
            'files.*' => ['file', 'max:10240', 'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,png,jpg,jpeg,txt,zip'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            if (!filled($this->input('content')) && !filled($this->input('link_url')) && !$this->hasFile('files')) {
                $v->errors()->add('content', 'Hãy nhập nội dung, dán liên kết hoặc đính kèm ít nhất một tệp.');
            }
        }];
    }

    public function messages(): array
    {
        return [
            'link_url.url' => 'Liên kết chưa đúng định dạng (bắt đầu bằng https://).',
            'files.max' => 'Chỉ đính kèm tối đa 5 tệp.',
            'files.*.max' => 'Mỗi tệp tối đa 10 MB.',
            'files.*.mimes' => 'Tệp phải là PDF, Word, Excel, PowerPoint, ảnh, TXT hoặc ZIP.',
        ];
    }
}
