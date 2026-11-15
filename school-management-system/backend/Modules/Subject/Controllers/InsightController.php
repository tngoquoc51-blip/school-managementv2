<?php

namespace Modules\Subject\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Subject\Services\InsightService;
use Modules\Subject\Support\Audit;

class InsightController extends Controller
{
    use ApiResponse;

    public function __construct(private InsightService $svc) {}

    private function year(Request $r): int
    {
        return Audit::currentYearId($r->integer('school_year_id') ?: null);
    }

    public function overview(Request $r)
    {
        return $this->success($this->svc->overview($this->year($r)));
    }

    public function integrity(Request $r)
    {
        return $this->success($this->svc->integrity($this->year($r)));
    }

    public function analytics(Request $r)
    {
        return $this->success($this->svc->analytics($this->year($r), $r->integer('semester') ?: null));
    }
}
