<?php

namespace App\Http\Controllers\Api\Bgh;

use App\Services\Plans\PlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Bình luận và liên kết của kế hoạch. */
class PlanExtraController extends BasePlanController
{
    public function __construct(private PlanService $svc) {}

    /** POST plans/{id}/comments */
    public function comment(Request $r, int $id): JsonResponse
    {
        $v = $r->validate(['body' => ['required', 'string', 'max:2000']], $this->messages());

        return $this->run(function () use ($r, $id, $v) {
            $this->svc->comment($id, $v['body'], $this->actor($r));
            return $this->ok(null, 'Đã gửi bình luận.', [], 201);
        });
    }

    /** POST plans/{id}/links */
    public function addLink(Request $r, int $id): JsonResponse
    {
        $v = $r->validate([
            'kind' => ['nullable', 'string', 'max:20'], 'label' => ['required', 'string', 'max:150'], 'url' => ['nullable', 'string', 'max:500'],
        ], $this->messages());
        $v['kind'] = $v['kind'] ?? 'other';

        return $this->run(fn () => $this->ok(['id' => $this->svc->addLink($id, $v, $this->actor($r))], 'Đã thêm liên kết.', [], 201));
    }

    /** DELETE plans/links/{link} */
    public function deleteLink(Request $r, int $link): JsonResponse
    {
        $this->svc->deleteLink($link, $this->actor($r));

        return $this->ok(null, 'Đã gỡ liên kết.');
    }
}
