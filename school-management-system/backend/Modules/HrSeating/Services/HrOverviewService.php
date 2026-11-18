<?php

namespace Modules\HrSeating\Services;

use Illuminate\Support\Facades\DB;

/** Tổng quan sĩ số lớp + cảnh báo + sơ đồ đang áp dụng. */
class HrOverviewService
{
    public function get(array $ctx): array
    {
        $roster = (new HrRosterService())->build($ctx);
        $layouts = new HrLayoutService();
        $summary = $roster['summary'];
        $alerts = [];
        $active = null;

        if ($roster['active_layout']) {
            $active = $layouts->get($roster['active_layout'], $ctx);
            $check = $layouts->check($roster['active_layout'], $ctx);
            foreach ($check['warnings'] as $w) {
                $alerts[] = $w;
            }
        } else {
            $alerts[] = ['level' => 'warn', 'code' => 'no_layout', 'text' => 'Lớp chưa có sơ đồ chỗ ngồi chính thức. Hãy tạo và công bố một sơ đồ.', 'students' => []];
        }
        $noGroup = array_values(array_filter($roster['students'], fn ($s) => ! $s['group']));
        if ($noGroup) {
            $alerts[] = ['level' => 'info', 'code' => 'no_group', 'text' => count($noGroup) . ' học sinh chưa thuộc tổ nào.', 'students' => array_map(fn ($s) => $s['full_name'], $noGroup)];
        }
        $lowAtt = array_values(array_filter($roster['students'], fn ($s) => ($s['absent_30d'] ?? 0) >= 5));
        if ($lowAtt) {
            $alerts[] = ['level' => 'warn', 'code' => 'absent', 'text' => count($lowAtt) . ' học sinh nghỉ từ 5 buổi trở lên trong 30 ngày qua.', 'students' => array_map(fn ($s) => $s['full_name'], $lowAtt)];
        }
        $weak = array_values(array_filter($roster['students'], fn ($s) => $s['level'] === 'Chưa đạt'));
        if ($weak) {
            $alerts[] = ['level' => 'info', 'code' => 'weak', 'text' => count($weak) . ' học sinh có học lực "Chưa đạt" cần hỗ trợ.', 'students' => array_map(fn ($s) => $s['full_name'], $weak)];
        }

        $layoutCount = (int) DB::selectOne('SELECT COUNT(*) AS n FROM sm_seat_layouts WHERE class_id = ?', [$ctx['class_id']])->n;

        return [
            'class' => $ctx['class'], 'summary' => $summary, 'alerts' => $alerts, 'active_layout' => $active, 'layout_count' => $layoutCount,
            'students' => array_map(fn ($s) => [
                'id' => $s['id'], 'code' => $s['code'], 'full_name' => $s['full_name'], 'ten' => $s['ten'], 'gender' => $s['gender'], 'level' => $s['level'],
                'group' => $s['group'], 'flags' => $s['flags'], 'officer_roles' => $s['officer_roles'],
            ], $roster['students']),
            'events' => (new HrGroupService())->events($ctx, 8),
        ];
    }
}
