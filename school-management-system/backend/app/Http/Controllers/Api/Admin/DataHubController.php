<?php

namespace App\Http\Controllers\Api\Admin;

use App\Services\DataHub\DatasetRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/** Tổng quan + danh sách loại dữ liệu. */
class DataHubController extends BaseDataHubController
{
    public function __construct(private DatasetRegistry $reg) {}

    /** GET data-hub/datasets */
    public function datasets(): JsonResponse
    {
        $out = [];
        foreach (array_keys($this->reg->all()) as $id) {
            $out[] = $this->reg->meta($id);
        }
        return $this->ok($out, 'OK', ['meta' => ['limits' => [
            'chunk' => (int) config('data_hub.max_rows_per_chunk', 500),
            'total' => (int) config('data_hub.max_rows_total', 20000),
            'undo_days' => (int) config('data_hub.undo_days', 14),
        ]]]);
    }

    /** GET data-hub/overview */
    public function overview(): JsonResponse
    {
        $month = now()->startOfMonth();
        $batches = DB::table('admin_import_batches')->orderByDesc('id')->limit(5)
            ->get(['id', 'dataset', 'filename', 'mode', 'total', 'inserted', 'updated', 'failed', 'status', 'created_by', 'created_at'])
            ->map(fn ($b) => (array) $b)->all();
        $exports = DB::table('admin_export_logs')->orderByDesc('id')->limit(5)
            ->get(['id', 'dataset', 'format', 'rows_count', 'masked', 'created_by', 'created_at'])
            ->map(fn ($b) => (array) $b)->all();

        return $this->ok([
            'imports_total' => DB::table('admin_import_batches')->count(),
            'imports_month' => DB::table('admin_import_batches')->where('created_at', '>=', $month)->count(),
            'rows_imported_month' => (int) DB::table('admin_import_batches')->where('created_at', '>=', $month)->selectRaw('COALESCE(SUM(inserted + updated), 0) as n')->value('n'),
            'exports_month' => DB::table('admin_export_logs')->where('created_at', '>=', $month)->count(),
            'running' => DB::table('admin_import_batches')->where('status', 'running')->count(),
            'recent_imports' => $this->withUsers($batches),
            'recent_exports' => $this->withUsers($exports),
        ]);
    }
}
