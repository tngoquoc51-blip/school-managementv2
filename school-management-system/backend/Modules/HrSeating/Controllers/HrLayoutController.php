<?php

namespace Modules\HrSeating\Controllers;

use Illuminate\Http\Request;
use Modules\HrSeating\Services\HrLayoutService;

class HrLayoutController extends HrBaseController
{
    public function __construct(private HrLayoutService $svc) {}

    public function index(Request $r)
    {
        return $this->success($this->svc->list($this->ctx($r)));
    }

    public function show(Request $r, int $id)
    {
        return $this->run(fn () => $this->svc->get($id, $this->ctx($r)));
    }

    public function store(Request $r)
    {
        $d = $r->validate([
            'name' => 'nullable|string|max:120', 'room_label' => 'nullable|string|max:40', 'note' => 'nullable|string|max:255',
            'rows_n' => 'nullable|integer|between:1,12', 'cols_n' => 'nullable|integer|between:1,8', 'seats_per_desk' => 'nullable|integer|between:1,3',
            'from' => 'nullable|in:blank,copy,alpha', 'source_id' => 'nullable|integer',
        ]);

        return $this->run(fn () => $this->svc->create($d, $this->ctx($r)), 'Đã tạo sơ đồ', 201);
    }

    public function update(Request $r, int $id)
    {
        $d = $r->validate([
            'name' => 'nullable|string|max:120', 'room_label' => 'nullable|string|max:40', 'note' => 'nullable|string|max:255',
            'rows_n' => 'nullable|integer|between:1,12', 'cols_n' => 'nullable|integer|between:1,8', 'seats_per_desk' => 'nullable|integer|between:1,3',
        ]);

        return $this->run(fn () => $this->svc->updateMeta($id, $d, $this->ctx($r)), 'Đã cập nhật sơ đồ');
    }

    public function saveSeats(Request $r, int $id)
    {
        $d = $r->validate([
            'seats' => 'present|array', 'seats.*.row' => 'required|integer|min:0', 'seats.*.col' => 'required|integer|min:0',
            'seats.*.pos' => 'required|integer|min:0', 'seats.*.student_id' => 'required|integer', 'seats.*.locked' => 'nullable|boolean',
            'seats.*.note' => 'nullable|string|max:120', 'blocked' => 'nullable|array', 'blocked.*' => 'string|max:20', 'version' => 'nullable|integer',
        ]);

        return $this->run(fn () => $this->svc->saveSeats($id, $d['seats'], $d['blocked'] ?? [], isset($d['version']) ? (int) $d['version'] : null, $this->ctx($r)), 'Đã lưu sơ đồ');
    }

    public function duplicate(Request $r, int $id)
    {
        return $this->run(fn () => $this->svc->duplicate($id, $this->ctx($r)), 'Đã nhân bản sơ đồ', 201);
    }

    public function publish(Request $r, int $id)
    {
        return $this->run(fn () => $this->svc->publish($id, $this->ctx($r)), 'Đã công bố sơ đồ');
    }

    public function destroy(Request $r, int $id)
    {
        return $this->run(function () use ($r, $id) {
            $this->svc->delete($id, $this->ctx($r));

            return null;
        }, 'Đã xóa sơ đồ');
    }

    public function check(Request $r, int $id)
    {
        return $this->run(fn () => $this->svc->check($id, $this->ctx($r)));
    }

    public function auto(Request $r, int $id)
    {
        $d = $r->validate(['mode' => 'required|string', 'keep_locked' => 'nullable|boolean', 'seed' => 'nullable|integer']);

        return $this->run(fn () => $this->svc->auto($id, $d['mode'], ['keep_locked' => $d['keep_locked'] ?? true, 'seed' => $d['seed'] ?? 1], $this->ctx($r)));
    }

    public function rotate(Request $r, int $id)
    {
        $d = $r->validate(['direction' => 'required|in:rows,cols', 'reverse' => 'nullable|boolean']);

        return $this->run(fn () => $this->svc->rotate($id, $d['direction'], (bool) ($d['reverse'] ?? false), $this->ctx($r)));
    }
}
