<?php

namespace App\Support\SystemLog;

use DateTimeInterface;

/**
 * Phát hiện bất thường: so số sự kiện trong GIỜ HIỆN TẠI với cùng khung giờ
 * của 7 ngày trước (trung bình + độ lệch chuẩn). Không cần thư viện ngoài.
 */
class Anomaly
{
    /**
     * @param  array<string, array<string,int>>  $hourly  ['nhóm' => ['2026-10-29 14' => 37, ...]]
     * @return array<int, array<string,mixed>>
     */
    public static function detect(array $hourly, DateTimeInterface $now, int $minCount = 5, float $zThreshold = 3.0): array
    {
        $out = [];
        $curKey = $now->format('Y-m-d H');
        $hour = $now->format('H');

        foreach ($hourly as $scope => $buckets) {
            $current = (int) ($buckets[$curKey] ?? 0);
            if ($current < $minCount) {
                continue;
            }
            $base = [];
            for ($d = 1; $d <= 7; $d++) {
                $k = (clone $now)->modify("-{$d} day")->format('Y-m-d') . ' ' . $hour;
                $base[] = (int) ($buckets[$k] ?? 0);
            }
            $mean = array_sum($base) / count($base);
            $var = 0.0;
            foreach ($base as $b) {
                $var += ($b - $mean) ** 2;
            }
            $std = sqrt($var / count($base));
            $z = ($current - $mean) / max($std, 1.0);

            if ($z >= $zThreshold && $current >= max($minCount, $mean * 2)) {
                $out[] = [
                    'kind' => 'spike',
                    'scope' => (string) $scope,
                    'current' => $current,
                    'baseline' => round($mean, 1),
                    'z' => round($z, 1),
                ];
            }
        }
        usort($out, fn ($a, $b) => $b['z'] <=> $a['z']);

        return $out;
    }
}
