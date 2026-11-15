<?php

namespace Modules\Academic\Controllers;

use Illuminate\Http\Request;
use Modules\Academic\Services\BghCatalogService;
use Modules\Academic\Services\BghOverviewService;

class BghOverviewController extends BghController
{
    public function __construct(private BghOverviewService $overview, private BghCatalogService $catalog) {}

    public function meta()
    {
        return $this->success($this->catalog->meta());
    }

    public function overview(Request $r)
    {
        return $this->success($this->overview->get($this->year($r), $this->sem($r)));
    }
}
