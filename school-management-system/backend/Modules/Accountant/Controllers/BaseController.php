<?php

namespace Modules\Accountant\Controllers;

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Validator;

abstract class BaseController extends Controller
{
    protected function ok($data = null, string $message = 'OK', int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], $status);
    }

    protected function fail(string $message, int $status = 422, $errors = null): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message, 'errors' => $errors], $status);
    }

    /** Dừng xử lý và trả lỗi JSON (dùng được cả bên trong DB::transaction). */
    protected function stop(string $message, int $status = 422): never
    {
        throw new HttpResponseException($this->fail($message, $status));
    }

    protected function validated(Request $request, array $rules, array $messages = []): array
    {
        $v = Validator::make($request->all(), $rules, $messages);
        if ($v->fails()) {
            throw new HttpResponseException(
                $this->fail($v->errors()->first(), 422, $v->errors())
            );
        }
        return $v->validated();
    }

    protected function staff(Request $request): object
    {
        return $request->attributes->get('staff');
    }

    /** Tên ghi vào cột confirmed_by / created_by, ví dụ "Kế toán Phạm Văn Kế". */
    protected function actor(Request $request): string
    {
        $s = $this->staff($request);
        $prefix = $s->role === 'accountant' ? 'Kế toán ' : '';
        return mb_substr($prefix . $s->full_name, 0, 80);
    }
}
