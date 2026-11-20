<?php

namespace Modules\Roster\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Roster\Services\OverviewService;
use Modules\Roster\Services\RosterSupport;

class RosterController extends Controller
{
    use ApiResponse;

    public function __construct(private RosterSupport $support, private OverviewService $overview) {}

    public function years(): JsonResponse
    {
        return $this->success($this->support->years());
    }

    public function overview(Request $request): JsonResponse
    {
        $year = $this->support->resolveYear($request->integer('year_id') ?: null);

        return $this->success(['year_id' => $year] + $this->overview->build($year));
    }

    public function lookups(Request $request): JsonResponse
    {
        $year = $this->support->resolveYear($request->integer('year_id') ?: null);

        return $this->success(['teachers' => $this->support->teachers($year), 'subjects' => $this->support->subjects()]);
    }
}
