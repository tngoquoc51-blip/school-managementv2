<?php

namespace Modules\HrSeating\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

/** Lớp cha của các controller Sơ đồ & Sĩ số lớp. Ngữ cảnh (lớp, năm học, người dùng) do middleware HrSeatingAuth dựng. */
abstract class HrBaseController extends Controller
{
    use ApiResponse;

    protected function ctx(Request $r): array
    {
        return $r->attributes->get('hr');
    }

    /** Lỗi nghiệp vụ (DomainException) trả về 422 với thông báo tiếng Việt. */
    protected function run(callable $fn, string $message = 'OK', int $code = 200)
    {
        try {
            return $this->success($fn(), $message, $code);
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }
    }
}
