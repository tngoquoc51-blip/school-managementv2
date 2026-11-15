<?php

namespace Modules\Academic\Controllers;

use Illuminate\Http\Request;
use Modules\Academic\Services\BghTimetableService;

class BghTimetableController extends BghController
{
    public function __construct(private BghTimetableService $svc) {}

    public function grid(Request $r)
    {
        $data = $r->validate(['class_id' => 'required|integer']);

        return $this->run(fn () => $this->svc->grid((int) $data['class_id']));
    }

    public function conflicts(Request $r)
    {
        return $this->success($this->svc->conflicts($this->year($r)));
    }

    public function swap(Request $r)
    {
        $d = $r->validate([
            'class_id' => 'required|integer',
            'a.weekday' => 'required|integer|between:2,7', 'a.period' => 'required|integer|between:1,5',
            'b.weekday' => 'required|integer|between:2,7', 'b.period' => 'required|integer|between:1,5',
        ]);

        return $this->run(fn () => $this->svc->swap((int) $d['class_id'], $d['a'], $d['b'], $this->actor($r)), 'Đã hoán đổi tiết học');
    }
}
