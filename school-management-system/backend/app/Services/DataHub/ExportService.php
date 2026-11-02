<?php

namespace App\Services\DataHub;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ExportService
{
    public function __construct(private DatasetRegistry $reg) {}

    private function base(array $ds, array $filters)
    {
        $t = $ds['table'];
        $cols = $this->reg->tableColumns($ds);
        $q = DB::table($t . ' as t');

        if (in_array('deleted_at', $cols, true)) {
            $q->whereNull('t.deleted_at');
        }
        $s = trim((string) ($filters['q'] ?? ''));
        if ($s !== '') {
            $search = array_values(array_intersect($ds['search'] ?? [], $cols));
            if ($search) {
                $q->where(function ($w) use ($search, $s) {
                    foreach ($search as $c) {
                        $w->orWhere('t.' . $c, 'like', "%{$s}%");
                    }
                });
            }
        }
        if (! empty($filters['class_id']) && in_array('class_id', $cols, true)) {
            $q->where('t.class_id', (int) $filters['class_id']);
        }
        if (isset($filters['active']) && $filters['active'] !== '' && in_array('is_active', $cols, true)) {
            $q->where('t.is_active', (int) $filters['active']);
        }
        return $q;
    }

    public function mask(string $type, $v)
    {
        if ($v === null || $v === '') {
            return $v;
        }
        $s = (string) $v;
        return match ($type) {
            'phone' => strlen($s) > 5 ? substr($s, 0, 3) . str_repeat('*', strlen($s) - 5) . substr($s, -2) : '***',
            'email' => preg_match('/^(.).*(@.+)$/', $s, $m) ? $m[1] . '***' . $m[2] : '***',
            'date'  => substr($s, 0, 4),
            default => mb_substr($s, 0, 6) . '…',
        };
    }

    public function rows(array $ds, array $columns, array $filters, int $page, int $perPage, bool $mask): array
    {
        if (! $this->reg->exists($ds)) {
            return ['rows' => [], 'meta' => ['total' => 0, 'page' => 1, 'per_page' => $perPage, 'last_page' => 1]];
        }
        $usable = $this->reg->usableFields($ds);
        $cols = array_values(array_filter($columns, fn ($c) => isset($usable[$c])));
        if (! $cols) {
            $cols = array_keys($usable);
        }

        $q = $this->base($ds, $filters);
        $total = (clone $q)->count();

        $g = $q->getGrammar();
        $selects = [];
        $n = 0;
        foreach ($cols as $c) {
            $f = $usable[$c];
            if (($f['type'] ?? '') === 'lookup' && Schema::hasTable($f['lookup']['table'])) {
                $alias = 'lk' . $n++;
                $q->leftJoin($f['lookup']['table'] . ' as ' . $alias, $alias . '.id', '=', 't.' . $c);
                $selects[] = DB::raw($g->wrap($alias . '.' . $f['lookup']['match']) . ' as ' . $g->wrap($c));
            } else {
                $selects[] = DB::raw($g->wrap('t.' . $c) . ' as ' . $g->wrap($c));
            }
        }
        $q->select($selects)->orderBy('t.id');

        $rows = $q->forPage($page, $perPage)->get()->map(function ($r) use ($cols, $usable, $ds, $mask) {
            $row = [];
            foreach ($cols as $c) {
                $v = $r->{$c} ?? null;
                if (($usable[$c]['type'] ?? '') === 'checkbox') {
                    $v = $v === null ? null : ((int) $v === 1 ? 1 : 0);
                }
                if ($mask && in_array($c, $ds['sensitive'] ?? [], true)) {
                    $v = $this->mask($usable[$c]['type'] ?? 'text', $v);
                }
                $row[$c] = $v;
            }
            return $row;
        })->all();

        return ['rows' => $rows, 'meta' => ['total' => $total, 'page' => $page, 'per_page' => $perPage, 'last_page' => max(1, (int) ceil($total / $perPage))]];
    }
}
