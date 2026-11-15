<?php

namespace Modules\Catalog\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Catalog\Services\OverviewService;

class OverviewController extends Controller
{
    use ApiResponse;

    public function __construct(private OverviewService $service) {}

    public function index(): JsonResponse
    {
        return $this->success($this->service->summary());
    }
}
