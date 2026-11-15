<?php

namespace Modules\Evaluations\Controllers;

use Illuminate\Http\Request;

class OverviewController extends BaseController
{
    public function profile(Request $r)
    {
        $me = $this->me($r);
        return $this->success(['user' => $me, 'settings' => $this->repo->settings()]);
    }

    public function lookups()
    {
        return $this->success($this->repo->lookups());
    }

    public function overview(Request $r)
    {
        [$y, $s] = $this->period($r);
        return $this->success(['year' => $y, 'semester' => $s] + $this->repo->overview($y, $s));
    }

    public function slots(Request $r)
    {
        $t = (int) $r->query('teacher_id');
        $d = (string) $r->query('date', date('Y-m-d'));
        if (! $t || ! strtotime($d)) return $this->error('Thiếu giáo viên hoặc ngày', 422);
        return $this->success($this->repo->slots($t, $d));
    }

    public function teachers(Request $r)
    {
        [$y, $s] = $this->period($r);
        return $this->success($this->repo->teachers($r->query(), $y, $s) + ['year' => $y, 'semester' => $s]);
    }

    public function teacher(Request $r, int $id)
    {
        if (! $this->repo->teacherExists($id)) return $this->error('Không tìm thấy giáo viên', 404);
        [$y] = $this->period($r);
        return $this->success($this->repo->teacherProfile($id, $y));
    }

    public function report(Request $r)
    {
        [$y, $s] = $this->period($r);
        return $this->success(['year' => $y, 'semester' => $s] + $this->repo->report($y, $s));
    }
}
