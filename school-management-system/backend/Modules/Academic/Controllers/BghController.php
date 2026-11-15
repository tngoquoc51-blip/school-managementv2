<?php

namespace Modules\Academic\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Academic\Support\Bgh;

/** Lớp cha cho các controller khu vực Chuyên môn – Ban Giám hiệu. */
abstract class BghController extends Controller
{
    use ApiResponse;

    protected function actor(Request $r): array
    {
        $u = $r->user();

        return ['id' => $u?->getKey(), 'name' => $u->name ?? 'Ban Giám hiệu', 'ip' => $r->ip()];
    }

    protected function year(Request $r): int
    {
        return Bgh::year($r->integer('year_id') ?: null);
    }

    protected function sem(Request $r): int
    {
        return Bgh::semester($r->input('semester'));
    }

    /** Chạy nghiệp vụ; lỗi nghiệp vụ (DomainException) trả về 422 với thông báo tiếng Việt. */
    protected function run(callable $fn, string $message = 'OK', int $code = 200)
    {
        try {
            return $this->success($fn(), $message, $code);
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }
    }
}
