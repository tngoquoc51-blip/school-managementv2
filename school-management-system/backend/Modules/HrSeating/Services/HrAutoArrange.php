<?php

namespace Modules\HrSeating\Services;

use Modules\HrSeating\Support\Hr;

/**
 * Thuật toán xếp chỗ tự động (trả về BẢN ĐỀ XUẤT, giáo viên xem trước rồi mới áp dụng).
 * Quy tắc: học sinh cận thị/nghe kém/cần ngồi trước -> các bàn đầu; học sinh cao -> các bàn cuối;
 * chỗ đã khóa giữ nguyên; tránh xếp cạnh nhau những em trong danh sách "không ngồi cạnh".
 */
final class HrAutoArrange
{
    public const MODES = ['alpha', 'gender_mix', 'score_mix', 'group', 'random'];

    /** Tọa độ chỗ theo thứ tự bàn đầu -> bàn cuối, trái -> phải. */
    public static function coords(int $rows, int $cols, int $per, array $blocked): array
    {
        $b = array_flip($blocked);
        $out = [];
        for ($r = 0; $r < $rows; $r++) {
            for ($c = 0; $c < $cols; $c++) {
                for ($p = 0; $p < $per; $p++) {
                    if (! isset($b[Hr::key($r, $c, $p)])) {
                        $out[] = [$r, $c, $p];
                    }
                }
            }
        }

        return $out;
    }

    private static function front(array $s): bool
    {
        $f = $s['flags'];

        return $f['front_required'] || $f['vision'] || $f['hearing'];
    }

    private static function constrained(array $s): bool
    {
        return self::front($s) || $s['flags']['tall'];
    }

    private static function alpha(array $a): array
    {
        usort($a, fn ($x, $y) => strcmp(Hr::sortKey($x['full_name']), Hr::sortKey($y['full_name'])));

        return $a;
    }

    private static function interleave(array $a, array $b): array
    {
        $out = [];
        $n = max(count($a), count($b));
        for ($i = 0; $i < $n; $i++) {
            if (isset($a[$i])) {
                $out[] = $a[$i];
            }
            if (isset($b[$i])) {
                $out[] = $b[$i];
            }
        }

        return $out;
    }

    private static function order(array $mid, string $mode, int $seed): array
    {
        switch ($mode) {
            case 'gender_mix':
                $m = self::alpha(array_values(array_filter($mid, fn ($s) => $s['gender'] === 'Nam')));
                $f = self::alpha(array_values(array_filter($mid, fn ($s) => $s['gender'] !== 'Nam')));

                return self::interleave($m, $f);
            case 'score_mix':
                usort($mid, fn ($x, $y) => ($y['avg_score'] ?? 6.5) <=> ($x['avg_score'] ?? 6.5));
                $out = [];
                for ($i = 0, $j = count($mid) - 1; $i <= $j; $i++, $j--) {
                    $out[] = $mid[$i];
                    if ($i !== $j) {
                        $out[] = $mid[$j];
                    }
                }

                return $out;
            case 'random':
                mt_srand($seed);
                $keys = array_keys($mid);
                for ($i = count($keys) - 1; $i > 0; $i--) {
                    $j = mt_rand(0, $i);
                    [$keys[$i], $keys[$j]] = [$keys[$j], $keys[$i]];
                }

                return array_map(fn ($k) => $mid[$k], $keys);
            default:
                return self::alpha($mid);
        }
    }

    /** Đếm cặp "không ngồi cạnh" đang ngồi sát nhau (cùng hàng, liền kề). */
    public static function conflicts(array $assign, array $seatInfo, array $avoid, int $per): array
    {
        $byRow = [];
        foreach ($assign as $key => $sid) {
            [$r, $c, $p] = $seatInfo[$key];
            $byRow[$r][$c * $per + $p] = $sid;
        }
        $pairs = [];
        foreach ($byRow as $cells) {
            ksort($cells);
            $prev = null;
            foreach ($cells as $idx => $sid) {
                if ($prev !== null && $prev[0] === $idx - 1) {
                    $a = $prev[1];
                    if (isset($avoid[$a][$sid]) || isset($avoid[$sid][$a])) {
                        $pairs[] = [$a, $sid];
                    }
                }
                $prev = [$idx, $sid];
            }
        }

        return $pairs;
    }

    /**
     * @param array $layout   rows_n, cols_n, seats_per_desk, blocked[]
     * @param array $students danh sách học sinh từ HrRosterService
     * @param array $current  chỗ hiện tại [{row,col,pos,student_id,locked,note}]
     */
    public static function run(array $layout, array $students, array $current, string $mode, array $opts = []): array
    {
        $per = (int) $layout['seats_per_desk'];
        $keepLocked = $opts['keep_locked'] ?? true;
        $seed = (int) ($opts['seed'] ?? 1);

        $fixed = [];
        $taken = [];
        foreach ($current as $s) {
            if ($keepLocked && ! empty($s['locked'])) {
                $fixed[(int) $s['student_id']] = $s;
                $taken[Hr::key($s['row'], $s['col'], $s['pos'])] = true;
            }
        }
        $coords = array_values(array_filter(
            self::coords((int) $layout['rows_n'], (int) $layout['cols_n'], $per, $layout['blocked'] ?? []),
            fn ($c) => ! isset($taken[Hr::key($c[0], $c[1], $c[2])])
        ));
        $pool = array_values(array_filter($students, fn ($s) => ! isset($fixed[$s['id']])));

        $front = self::alpha(array_values(array_filter($pool, fn ($s) => self::front($s))));
        $back = self::alpha(array_values(array_filter($pool, fn ($s) => ! self::front($s) && $s['flags']['tall'])));
        $mid = array_values(array_filter($pool, fn ($s) => ! self::constrained($s)));

        $seatInfo = [];
        foreach ($coords as $c) {
            $seatInfo[Hr::key($c[0], $c[1], $c[2])] = $c;
        }
        $assign = []; // seatKey => student_id
        $placed = [];
        $i = 0;
        $j = count($coords) - 1;

        if ($mode === 'group') {
            $cols = (int) $layout['cols_n'];
            $queues = [];
            foreach (self::alpha($mid) as $s) {
                $col = $s['group'] ? (($s['group']['number'] - 1) % $cols) : -1;
                $queues[$col][] = $s;
            }
            $rest = [];
            foreach ($front as $s) { if ($i <= $j) { $k = Hr::key(...$coords[$i]); $assign[$k] = $s['id']; $placed[$s['id']] = $k; $i++; } }
            foreach ($back as $s) { if ($j >= $i) { $k = Hr::key(...$coords[$j]); $assign[$k] = $s['id']; $placed[$s['id']] = $k; $j--; } }
            foreach ($coords as [$r, $c, $p]) {
                $k = Hr::key($r, $c, $p);
                if (isset($assign[$k])) {
                    continue;
                }
                if (! empty($queues[$c])) {
                    $s = array_shift($queues[$c]);
                    $assign[$k] = $s['id'];
                    $placed[$s['id']] = $k;
                }
            }
            foreach ($queues as $q) {
                foreach ($q as $s) {
                    $rest[] = $s;
                }
            }
            foreach ($coords as [$r, $c, $p]) {
                $k = Hr::key($r, $c, $p);
                if (! isset($assign[$k]) && $rest) {
                    $s = array_shift($rest);
                    $assign[$k] = $s['id'];
                    $placed[$s['id']] = $k;
                }
            }
        } else {
            foreach ($front as $s) {
                if ($i <= $j) {
                    $k = Hr::key(...$coords[$i]);
                    $assign[$k] = $s['id'];
                    $placed[$s['id']] = $k;
                    $i++;
                }
            }
            foreach ($back as $s) {
                if ($j >= $i) {
                    $k = Hr::key(...$coords[$j]);
                    $assign[$k] = $s['id'];
                    $placed[$s['id']] = $k;
                    $j--;
                }
            }
            foreach (self::order($mid, $mode, $seed) as $s) {
                if ($i <= $j) {
                    $k = Hr::key(...$coords[$i]);
                    $assign[$k] = $s['id'];
                    $placed[$s['id']] = $k;
                    $i++;
                }
            }
        }

        // Sửa các cặp "không ngồi cạnh" bằng cách hoán đổi với em khác không bị ràng buộc
        $avoid = [];
        foreach ($students as $s) {
            foreach ($s['flags']['avoid_ids'] as $o) {
                $avoid[$s['id']][$o] = true;
            }
        }
        if ($avoid) {
            $movable = array_flip(array_map(fn ($s) => $s['id'], $mid));
            for ($iter = 0; $iter < 200; $iter++) {
                $pairs = self::conflicts($assign, $seatInfo, $avoid, $per);
                if (! $pairs) {
                    break;
                }
                $best = count($pairs);
                $done = false;
                foreach ($pairs[0] as $victim) {
                    if (! isset($movable[$victim])) {
                        continue;
                    }
                    $vk = array_search($victim, $assign, true);
                    foreach ($assign as $ok => $other) {
                        if ($other === $victim || ! isset($movable[$other])) {
                            continue;
                        }
                        $try = $assign;
                        $try[$vk] = $other;
                        $try[$ok] = $victim;
                        $n = count(self::conflicts($try, $seatInfo, $avoid, $per));
                        if ($n < $best) {
                            $assign = $try;
                            $done = true;
                            break 2;
                        }
                    }
                }
                if (! $done) {
                    break;
                }
            }
        }

        $seats = [];
        foreach ($assign as $k => $sid) {
            [$r, $c, $p] = $seatInfo[$k];
            $seats[] = ['row' => $r, 'col' => $c, 'pos' => $p, 'student_id' => $sid, 'locked' => false, 'note' => null];
        }
        foreach ($fixed as $s) {
            $seats[] = ['row' => (int) $s['row'], 'col' => (int) $s['col'], 'pos' => (int) $s['pos'], 'student_id' => (int) $s['student_id'], 'locked' => true, 'note' => $s['note'] ?? null];
        }
        $seatedIds = array_map(fn ($s) => $s['student_id'], $seats);
        $unplaced = array_values(array_map(fn ($s) => $s['id'], array_filter($students, fn ($s) => ! in_array($s['id'], $seatedIds, true))));

        return ['seats' => $seats, 'unplaced' => $unplaced, 'conflicts' => count(self::conflicts($assign, $seatInfo, $avoid, $per)), 'mode' => $mode];
    }

    /** Xoay vòng chỗ ngồi: 'rows' = mỗi em lùi 1 hàng; 'cols' = mỗi em dịch 1 bàn sang phải trong hàng. */
    public static function rotate(array $layout, array $students, array $current, string $dir, bool $reverse): array
    {
        $per = (int) $layout['seats_per_desk'];
        $byId = [];
        foreach ($students as $s) {
            $byId[$s['id']] = $s;
        }
        $movable = [];
        $fixedOut = [];
        foreach ($current as $s) {
            $st = $byId[$s['student_id']] ?? null;
            if (! empty($s['locked']) || ($st && self::constrained($st))) {
                $fixedOut[] = $s;
            } else {
                $movable[] = $s;
            }
        }
        usort($movable, fn ($a, $b) => [$a['row'], $a['col'], $a['pos']] <=> [$b['row'], $b['col'], $b['pos']]);

        $shift = function (array $list, int $k) {
            $n = count($list);
            if ($n === 0) {
                return $list;
            }
            $k = (($k % $n) + $n) % $n;

            return array_merge(array_slice($list, $n - $k), array_slice($list, 0, $n - $k));
        };
        $out = [];
        if ($dir === 'cols') {
            $rowsMap = [];
            foreach ($movable as $m) {
                $rowsMap[$m['row']][] = $m;
            }
            foreach ($rowsMap as $cells) {
                $ids = array_map(fn ($m) => $m['student_id'], $cells);
                $ids = $shift($ids, $reverse ? -$per : $per);
                foreach ($cells as $i => $m) {
                    $out[] = ['row' => $m['row'], 'col' => $m['col'], 'pos' => $m['pos'], 'student_id' => $ids[$i], 'locked' => false, 'note' => $m['note'] ?? null];
                }
            }
        } else {
            $ids = array_map(fn ($m) => $m['student_id'], $movable);
            $k = (int) $layout['cols_n'] * $per;
            $ids = $shift($ids, $reverse ? -$k : $k);
            foreach ($movable as $i => $m) {
                $out[] = ['row' => $m['row'], 'col' => $m['col'], 'pos' => $m['pos'], 'student_id' => $ids[$i], 'locked' => false, 'note' => $m['note'] ?? null];
            }
        }
        foreach ($fixedOut as $f) {
            $out[] = ['row' => (int) $f['row'], 'col' => (int) $f['col'], 'pos' => (int) $f['pos'], 'student_id' => (int) $f['student_id'], 'locked' => (bool) ($f['locked'] ?? false), 'note' => $f['note'] ?? null];
        }

        return ['seats' => $out, 'mode' => 'rotate_' . $dir];
    }
}
