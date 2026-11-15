<?php

namespace App\Http\Controllers\Api\Bgh;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

abstract class BasePlanController extends Controller
{
    protected function ok($data = null, string $message = 'OK', array $extra = [], int $code = 200): JsonResponse
    {
        return response()->json(array_merge(['success' => true, 'message' => $message, 'data' => $data], $extra), $code);
    }

    protected function run(callable $fn): JsonResponse
    {
        try {
            return $fn();
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => collect($e->errors())->flatten()->first() ?? 'Dữ liệu không hợp lệ.',
                'data'    => null,
                'errors'  => $e->errors(),
            ], 422);
        }
    }

    protected function actor(Request $r): array
    {
        $u = $r->user();
        return ['id' => $u?->getAuthIdentifier(), 'name' => $u->name ?? 'Ban Giám hiệu'];
    }

    protected function messages(): array
    {
        return [
            'title.required' => 'Vui lòng nhập tên.', 'title.max' => 'Tên tối đa 255 ký tự.',
            'end_date.after_or_equal' => 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.',
            'due_date.after_or_equal' => 'Hạn hoàn thành phải sau hoặc bằng ngày bắt đầu.',
            'in' => 'Giá trị không hợp lệ.', 'date' => 'Ngày không hợp lệ.', 'integer' => 'Phải là số nguyên.',
            'body.required' => 'Vui lòng nhập nội dung.', 'label.required' => 'Vui lòng nhập tên liên kết.',
        ];
    }
}
