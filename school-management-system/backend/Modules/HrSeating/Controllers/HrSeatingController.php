<?php

namespace Modules\HrSeating\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\HrSeating\Services\HrGroupService;
use Modules\HrSeating\Services\HrOverviewService;
use Modules\HrSeating\Services\HrRosterService;
use Modules\HrSeating\Support\Hr;

class HrSeatingController extends HrBaseController
{
    public function meta(Request $r)
    {
        $c = $this->ctx($r);
        $year = DB::selectOne('SELECT label FROM sm_school_years WHERE id = ?', [$c['year_id']]);

        return $this->success([
            'staff' => $c['staff'], 'is_manager' => $c['is_manager'], 'resolved_by' => $c['resolved_by'],
            'class' => $c['class'], 'classes' => $c['classes'], 'year_id' => $c['year_id'], 'year_label' => $year->label ?? '',
            'semester' => $c['semester'], 'officer_roles' => Hr::OFFICER_ROLES,
        ]);
    }

    public function overview(Request $r)
    {
        return $this->run(fn () => (new HrOverviewService())->get($this->ctx($r)));
    }

    public function roster(Request $r)
    {
        return $this->run(fn () => (new HrRosterService())->build($this->ctx($r)));
    }

    public function events(Request $r)
    {
        return $this->success((new HrGroupService())->events($this->ctx($r), 60));
    }
}
