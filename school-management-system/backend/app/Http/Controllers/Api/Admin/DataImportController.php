<?php

namespace App\Http\Controllers\Api\Admin;

use App\Services\DataHub\ImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DataImportController extends BaseDataHubController
{
    public function __construct(private ImportService $svc) {}

    private function rules(Request $r, bool $needDataset = true): array
    {
        $max = (int) config('data_hub.max_rows_per_chunk', 500);
        $rules = [
            'rows'     => ['required', 'array', 'min:1', 'max:' . $max],
            'rows.*.n' => ['required', 'integer', 'min:1'],
            'rows.*.d' => ['required', 'array'],
        ];
        if ($needDataset) {
            $rules['dataset'] = ['required', 'string', 'max:40'];
            $rules['mode'] = ['required', 'in:insert,upsert,update'];
        }
        return $rules;
    }

    /** POST data-hub/import/validate */
    public function validateRows(Request $r): JsonResponse
    {
        $v = $r->validate($this->rules($r), ['rows.max' => 'Mỗi lần kiểm tra tối đa ' . config('data_hub.max_rows_per_chunk', 500) . ' dòng.']);

        return $this->run(fn () => $this->ok($this->svc->validate($v['dataset'], $v['rows'], $v['mode'])));
    }

    /** POST data-hub/import/start */
    public function start(Request $r): JsonResponse
    {
        $v = $r->validate([
            'dataset'  => ['required', 'string', 'max:40'],
            'mode'     => ['required', 'in:insert,upsert,update'],
            'filename' => ['nullable', 'string', 'max:255'],
            'total'    => ['required', 'integer', 'min:1'],
            'options'  => ['nullable', 'array'],
        ]);

        return $this->run(fn () => $this->ok(
            ['batch_id' => $this->svc->start($v['dataset'], $v['mode'], $v['filename'] ?? null, (int) $v['total'], (array) ($v['options'] ?? []), $this->uid($r))],
            'Đã tạo lô nhập.', [], 201
        ));
    }

    /** POST data-hub/import/{batch}/chunk */
    public function chunk(Request $r, int $batch): JsonResponse
    {
        $v = $r->validate($this->rules($r, false));

        return $this->run(fn () => $this->ok($this->svc->chunk($batch, $v['rows'])));
    }

    /** POST data-hub/import/{batch}/finish  (body: cancelled?) */
    public function finish(Request $r, int $batch): JsonResponse
    {
        return $this->run(fn () => $this->ok($this->svc->finish($batch, $r->boolean('cancelled')), 'Đã chốt lô nhập.'));
    }

    /** GET data-hub/import/batches */
    public function batches(Request $r): JsonResponse
    {
        $q = DB::table('admin_import_batches')->orderByDesc('id');
        if ($r->filled('dataset')) {
            $q->where('dataset', $r->query('dataset'));
        }
        $p = $q->paginate(min(max((int) $r->query('per_page', 15), 5), 50), ['id', 'dataset', 'filename', 'mode', 'total', 'processed', 'inserted', 'updated', 'unchanged', 'failed', 'status', 'created_by', 'started_at', 'finished_at', 'undone_at', 'created_at']);

        return $this->ok($this->withUsers(collect($p->items())->map(fn ($b) => (array) $b)->all()), 'OK', ['meta' => [
            'current_page' => $p->currentPage(), 'last_page' => $p->lastPage(), 'per_page' => $p->perPage(), 'total' => $p->total(),
        ]]);
    }

    /** GET data-hub/import/batches/{batch} */
    public function show(int $batch): JsonResponse
    {
        return $this->run(fn () => $this->ok($this->svc->show($batch)));
    }

    /** POST data-hub/import/batches/{batch}/undo */
    public function undo(Request $r, int $batch): JsonResponse
    {
        return $this->run(fn () => $this->ok($this->svc->undo($batch, $this->uid($r)), 'Đã hoàn tác lô nhập.'));
    }
}
