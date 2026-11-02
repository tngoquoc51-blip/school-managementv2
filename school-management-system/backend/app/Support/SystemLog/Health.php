<?php

namespace App\Support\SystemLog;

/** Điểm sức khỏe hệ thống 0–100, kèm lý do trừ điểm để người dùng hiểu vì sao. */
class Health
{
    /**
     * @param  array{total:int,errors:int,critical:int,failed_logins:int,logins:int,open_warning:int,open_error:int,open_critical:int}  $m
     * @return array{score:int,grade:string,parts:array<int,array<string,mixed>>}
     */
    public static function score(array $m): array
    {
        $parts = [];
        $penalty = 0;

        $rate = $m['total'] > 0 ? $m['errors'] / $m['total'] : 0;
        if ($rate > 0.01) {
            $p = min(30, (int) round($rate * 100 * 2));
            $parts[] = ['key' => 'error_rate', 'label' => 'Tỷ lệ lỗi', 'penalty' => $p, 'detail' => round($rate * 100, 1) . '% sự kiện là lỗi'];
            $penalty += $p;
        }
        if ($m['critical'] > 0) {
            $p = min(30, 15 * $m['critical']);
            $parts[] = ['key' => 'critical', 'label' => 'Sự kiện nghiêm trọng', 'penalty' => $p, 'detail' => $m['critical'] . ' sự kiện mức Critical'];
            $penalty += $p;
        }
        $inc = $m['open_critical'] * 10 + $m['open_error'] * 6 + $m['open_warning'] * 3;
        if ($inc > 0) {
            $p = min(25, $inc);
            $parts[] = ['key' => 'incidents', 'label' => 'Sự cố chưa xử lý', 'penalty' => $p, 'detail' => ($m['open_critical'] + $m['open_error'] + $m['open_warning']) . ' sự cố đang mở'];
            $penalty += $p;
        }
        $attempts = $m['logins'] + $m['failed_logins'];
        if ($m['failed_logins'] >= 5 && $attempts > 0) {
            $fr = $m['failed_logins'] / $attempts;
            if ($fr > 0.1) {
                $p = min(15, (int) round($fr * 40));
                $parts[] = ['key' => 'failed_logins', 'label' => 'Đăng nhập sai nhiều', 'penalty' => $p, 'detail' => round($fr * 100) . '% lượt đăng nhập thất bại'];
                $penalty += $p;
            }
        }

        $score = max(0, 100 - $penalty);
        $grade = $score >= 90 ? 'A' : ($score >= 75 ? 'B' : ($score >= 60 ? 'C' : ($score >= 40 ? 'D' : 'E')));

        return ['score' => $score, 'grade' => $grade, 'parts' => $parts];
    }
}
