<?php

namespace App\Http\Controllers\Admin;

use App\Services\DataHub\DatasetRegistry;
use App\Services\DataHub\ExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DataExportController extends BaseDataHubController
{
    public function __construct(private DatasetRegistry $reg, private ExportService $svc) {}

    /** GET data-hub/export/rows?dataset=&columns=a,b&q=&class_id=&active=&page=&per_page=&mask=1 */
    public function rows(Request $r): JsonResponse
    {
        $r->validate(['dataset' => ['required', 'string', 'max:40']]);
        $ds = $this->reg->get($r->query('dataset'));
        $columns = array_filter(explode(',', (string) $r->query('columns', '')));
        $res = $this->svc->rows(
            $ds, $columns, $r->only(['q', 'class_id', 'active']),
            max(1, (int) $r->query('page', 1)), min(max((int) $r->query('per_page', 1000), 1), 2000), $r->boolean('mask')
        );

        return $this->ok($res['rows'], 'OK', ['meta' => $res['meta']]);
    }

    /** POST data-hub/export/log */
    public function log(Request $r): JsonResponse
    {
        $v = $r->validate([
            'dataset' => ['required', 'string', 'max:40'],
            'format'  => ['required', 'in:csv,xls,json'],
            'rows'    => ['required', 'integer', 'min:0'],
            'columns' => ['nullable', 'array'],
            'filters' => ['nullable', 'array'],
            'masked'  => ['nullable', 'boolean'],
        ]);
        $this->reg->get($v['dataset']);

        DB::table('admin_export_logs')->insert([
            'dataset' => $v['dataset'], 'format' => $v['format'], 'rows_count' => $v['rows'],
            'columns' => json_encode($v['columns'] ?? []), 'filters' => json_encode($v['filters'] ?? []),
            'masked' => (int) ($v['masked'] ?? false), 'ip' => $r->ip(), 'created_by' => $this->uid($r), 'created_at' => now(),
        ]);

        return $this->ok(null, 'Đã ghi nhật ký xuất dữ liệu.', [], 201);
    }

    /** GET data-hub/export/logs */
    public function logs(Request $r): JsonResponse
    {
        $p = DB::table('admin_export_logs')->orderByDesc('id')->paginate(min(max((int) $r->query('per_page', 15), 5), 50));

        $items = collect($p->items())->map(function ($l) {
            $a = (array) $l;
            $a['columns'] = json_decode((string) $l->columns, true) ?: [];
            $a['filters'] = json_decode((string) $l->filters, true) ?: [];
            $a['masked'] = (bool) $l->masked;
            return $a;
        })->all();

        return $this->ok($this->withUsers($items), 'OK', ['meta' => [
            'current_page' => $p->currentPage(), 'last_page' => $p->lastPage(), 'per_page' => $p->perPage(), 'total' => $p->total(),
        ]]);
    }
}
