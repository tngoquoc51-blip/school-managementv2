<?php

namespace App\Support\SystemLog;

class Diff
{
    /** @return array<int, array{key:string,type:string,before:mixed,after:mixed}> */
    public static function compute(?array $old, ?array $new): array
    {
        $old ??= [];
        $new ??= [];
        $rows = [];
        foreach (array_unique(array_merge(array_keys($old), array_keys($new))) as $k) {
            $has0 = array_key_exists($k, $old);
            $has1 = array_key_exists($k, $new);
            if ($has0 && $has1) {
                if ($old[$k] != $new[$k]) {
                    $rows[] = ['key' => (string) $k, 'type' => 'changed', 'before' => $old[$k], 'after' => $new[$k]];
                }
            } elseif ($has1) {
                $rows[] = ['key' => (string) $k, 'type' => 'added', 'before' => null, 'after' => $new[$k]];
            } else {
                $rows[] = ['key' => (string) $k, 'type' => 'removed', 'before' => $old[$k], 'after' => null];
            }
        }

        return $rows;
    }
}
