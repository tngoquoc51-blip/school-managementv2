<?php

namespace Modules\Evaluations\Controllers;

use Illuminate\Http\Request;
use Modules\Evaluations\Support\EvalAudit;

class SettingsController extends BaseController
{
    public function show()
    {
        return $this->success(['settings' => $this->repo->settings(), 'rubrics' => $this->repo->rubrics()]);
    }

    public function update(Request $r)
    {
        if (! ($this->me($r)['can_admin'] ?? false)) return $this->error('Chỉ Hiệu trưởng / Quản trị mới được đổi cấu hình', 403);
        $in = (array) $r->input('settings', $r->all());
        $cur = $this->repo->settings();
        $new = [];
        foreach (array_keys($cur) as $k) { if (array_key_exists($k, $in)) $new[$k] = (string) $in[$k]; }
        $m = $new + $cur;
        foreach (['rating_excellent', 'rating_good', 'rating_pass'] as $k) {
            if (! is_numeric($m[$k]) || $m[$k] < 0 || $m[$k] > 100) return $this->error('Ngưỡng xếp loại phải từ 0 đến 100', 422);
        }
        if (! ($m['rating_excellent'] > $m['rating_good'] && $m['rating_good'] > $m['rating_pass'])) return $this->error('Ngưỡng phải giảm dần: Tốt > Khá > Đạt', 422);
        $sum = 0;
        foreach (['observation', 'professional', 'results', 'conduct', 'innovation'] as $k) {
            if (! is_numeric($m["weight_$k"]) || $m["weight_$k"] < 0) return $this->error('Trọng số không hợp lệ', 422);
            $sum += (float) $m["weight_$k"];
        }
        if (abs($sum - 100) > 0.01) return $this->error("Tổng trọng số 5 thành phần phải bằng 100 (hiện {$sum})", 422);
        if (! ctype_digit((string) $m['min_obs_per_semester']) || $m['min_obs_per_semester'] < 1 || $m['min_obs_per_semester'] > 20) return $this->error('Số lần dự giờ tối thiểu từ 1 đến 20', 422);
        if (! in_array((string) $m['current_semester'], ['1', '2'], true)) return $this->error('Học kỳ hiện tại phải là 1 hoặc 2', 422);
        $rb = $this->repo->rubric((int) $m['default_rubric_id']);
        if (! $rb || ! $rb['is_active']) return $this->error('Mẫu phiếu mặc định phải tồn tại và đang bật', 422);

        $changed = [];
        foreach ($new as $k => $v) {
            if ((string) $cur[$k] !== $v) { $changed[$k] = ['từ' => $cur[$k], 'thành' => $v]; $this->repo->setSetting($k, $v, $this->name($r)); }
        }
        if ($changed) EvalAudit::log('settings.update', 'ev_settings', null, 'Cấu hình', 'Đổi cấu hình dự giờ & đánh giá: ' . implode(', ', array_keys($changed)), null, $changed, 'notice');
        return $this->success(['settings' => $this->repo->settings(), 'changed' => array_keys($changed)], $changed ? 'Đã lưu cấu hình' : 'Không có thay đổi');
    }
}
