<?php

namespace Modules\Evaluations\Services;

/**
 * Tính điểm & xếp loại. Thuần PHP, không phụ thuộc DB (dễ kiểm thử).
 *   - Điểm phiếu dự giờ = Σ(trọng số × điểm/điểm tối đa) / Σ trọng số × 100
 *   - Xếp loại theo ngưỡng cấu hình: Tốt ≥ 85, Khá ≥ 70, Đạt ≥ 50, còn lại Chưa đạt
 */
class ScoringService
{
    public const RATINGS = ['excellent', 'good', 'pass', 'fail'];

    public const DEFAULTS = [
        'min_obs_per_semester' => '2',
        'rating_excellent' => '85', 'rating_good' => '70', 'rating_pass' => '50',
        'weight_observation' => '40', 'weight_professional' => '20', 'weight_results' => '20',
        'weight_conduct' => '10', 'weight_innovation' => '10',
        'remind_days_before' => '2', 'default_rubric_id' => '1', 'current_semester' => '1',
    ];

    /** @param array<int,array{id:int,weight:float|string,max_score:int|string}> $criteria
     *  @param array<int,int|float|null> $scores  criterion_id => điểm
     *  @param bool $requireAll true: chia cho tổng trọng số của MỌI tiêu chí (phiếu hoàn chỉnh) */
    public function observationScore(array $criteria, array $scores, bool $requireAll = false): ?float
    {
        $num = 0.0; $den = 0.0; $den_all = 0.0;
        foreach ($criteria as $c) {
            $w = (float) $c['weight']; $max = max(1, (int) $c['max_score']);
            $den_all += $w;
            $id = (int) $c['id'];
            if (! array_key_exists($id, $scores) || $scores[$id] === null) {
                continue;
            }
            $s = max(0, min($max, (float) $scores[$id]));
            $num += $w * $s / $max;
            $den += $w;
        }
        $d = $requireAll ? $den_all : $den;
        if ($d <= 0 || $den <= 0) {
            return null;
        }
        return round($num / $d * 100, 2);
    }

    public function rate(?float $score, array $settings): ?string
    {
        if ($score === null) {
            return null;
        }
        $s = $settings + self::DEFAULTS;
        if ($score >= (float) $s['rating_excellent']) return 'excellent';
        if ($score >= (float) $s['rating_good']) return 'good';
        if ($score >= (float) $s['rating_pass']) return 'pass';
        return 'fail';
    }

    /** Điểm tổng kết định kỳ: trung bình có trọng số của các thành phần ĐÃ có điểm.
     *  @param array{observation:?float,professional:?float,results:?float,conduct:?float,innovation:?float} $comp */
    public function periodicTotal(array $comp, array $settings): array
    {
        $s = $settings + self::DEFAULTS;
        $num = 0.0; $den = 0.0; $have = 0;
        foreach (['observation', 'professional', 'results', 'conduct', 'innovation'] as $k) {
            $v = $comp[$k] ?? null;
            if ($v === null || $v === '') continue;
            $w = (float) $s['weight_' . $k];
            $num += $w * max(0, min(100, (float) $v));
            $den += $w;
            $have++;
        }
        $total = $den > 0 ? round($num / $den, 2) : null;
        return ['total' => $total, 'complete' => $have === 5, 'rating' => $this->rate($total, $settings)];
    }

    /** Điểm cho phép của thang: kiểm tra hợp lệ trước khi lưu. */
    public function validScore($score, int $max): bool
    {
        return is_numeric($score) && (int) $score == $score && $score >= 0 && $score <= $max;
    }
}
