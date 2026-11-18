<?php

namespace Modules\HrSeating\Controllers;

use Illuminate\Http\Request;
use Modules\HrSeating\Services\HrGroupService;

class HrGroupController extends HrBaseController
{
    public function __construct(private HrGroupService $svc) {}

    public function groups(Request $r)
    {
        return $this->success($this->svc->groups($this->ctx($r)));
    }

    public function saveGroups(Request $r)
    {
        $d = $r->validate([
            'groups' => 'required|array|min:1|max:8', 'groups.*.name' => 'nullable|string|max:60', 'groups.*.color' => 'nullable|string|max:9',
            'groups.*.leader_student_id' => 'nullable|integer', 'groups.*.members' => 'present|array', 'groups.*.members.*' => 'integer',
        ]);

        return $this->run(fn () => $this->svc->saveGroups($d['groups'], $this->ctx($r)), 'Đã lưu các tổ');
    }

    public function autoSplit(Request $r)
    {
        $d = $r->validate(['count' => 'required|integer|between:2,8']);

        return $this->run(fn () => $this->svc->autoSplit((int) $d['count'], $this->ctx($r)));
    }

    public function officers(Request $r)
    {
        return $this->success($this->svc->officers($this->ctx($r)));
    }

    public function saveOfficers(Request $r)
    {
        $d = $r->validate(['assigned' => 'required|array']);

        return $this->run(fn () => $this->svc->saveOfficers($d['assigned'], $this->ctx($r)), 'Đã lưu ban cán sự');
    }

    public function saveFlag(Request $r, int $studentId)
    {
        $d = $r->validate([
            'vision' => 'nullable|boolean', 'hearing' => 'nullable|boolean', 'tall' => 'nullable|boolean', 'front_required' => 'nullable|boolean',
            'avoid_ids' => 'nullable|array', 'avoid_ids.*' => 'integer', 'note' => 'nullable|string|max:255',
        ]);

        return $this->run(fn () => $this->svc->saveFlag($studentId, $d, $this->ctx($r)), 'Đã lưu lưu ý chỗ ngồi');
    }
}
