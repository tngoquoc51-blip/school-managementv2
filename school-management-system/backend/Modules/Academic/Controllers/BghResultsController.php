<?php

namespace Modules\Academic\Controllers;

use Illuminate\Http\Request;
use Modules\Academic\Services\BghResultsService;

class BghResultsController extends BghController
{
    public function __construct(private BghResultsService $svc) {}

    public function overview(Request $r)
    {
        return $this->success($this->svc->overview($this->year($r), $this->sem($r)));
    }

    public function classDetail(Request $r, int $id)
    {
        return $this->run(fn () => $this->svc->classDetail($id, $this->sem($r)));
    }
}
