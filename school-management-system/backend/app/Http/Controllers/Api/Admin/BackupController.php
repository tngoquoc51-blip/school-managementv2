<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class BackupController extends Controller
{
    private function dir(): string
    {
        $path = storage_path('app/backups');
        if (!File::isDirectory($path)) {
            File::makeDirectory($path, 0755, true);
        }
        return $path;
    }

    private function settings(): object
    {
        if (!Schema::hasTable('sm_backup_settings')) {
            return (object) [
                'auto_enabled' => false,
                'auto_time'    => '02:00:00',
                'keep_days'    => 30,
                'max_files'    => 20,
                'storage_path' => 'storage/app/backups',
                'last_run_at'  => null,
            ];
        }
        $row = DB::table('sm_backup_settings')->where('id', 1)->first();
        return $row ?: (object) [
            'auto_enabled' => false,
            'auto_time'    => '02:00:00',
            'keep_days'    => 30,
            'max_files'    => 20,
            'storage_path' => 'storage/app/backups',
            'last_run_at'  => null,
        ];
    }

    private function moneySize(int $bytes): string
    {
        if ($bytes < 1024) return $bytes . ' B';
        if ($bytes < 1048576) return round($bytes / 1024, 1) . ' KB';
        if ($bytes < 1073741824) return round($bytes / 1048576, 1) . ' MB';
        return round($bytes / 1073741824, 2) . ' GB';
    }

    /** GET /api/admin/backups */
    public function index()
    {
        $dir = $this->dir();
        $diskFree = @disk_free_space($dir) ?: 0;
        $diskTotal = @disk_total_space($dir) ?: 0;

        $items = [];
        if (Schema::hasTable('sm_backups')) {
            $items = DB::table('sm_backups')
                ->orderByDesc('id')
                ->limit(50)
                ->get()
                ->map(function ($b) {
                    return [
                        'id'          => $b->id,
                        'code'        => $b->code,
                        'type'        => $b->type,
                        'type_label'  => match ($b->type) {
                            'full'  => 'Toàn hệ thống',
                            'files' => 'Tệp tin',
                            default => 'Cơ sở dữ liệu',
                        },
                        'status'      => $b->status,
                        'status_label'=> match ($b->status) {
                            'done'    => 'Thành công',
                            'failed'  => 'Thất bại',
                            'running' => 'Đang chạy',
                            default   => 'Chờ xử lý',
                        },
                        'file_name'   => $b->file_name,
                        'file_size'   => (int) $b->file_size,
                        'file_size_label' => $this->moneySize((int) $b->file_size),
                        'note'        => $b->note,
                        'error'       => $b->error_message,
                        'started_at'  => $b->started_at,
                        'finished_at' => $b->finished_at,
                        'created_at'  => $b->created_at,
                    ];
                });
        }

        $done = collect($items)->where('status', 'done')->count();
        $failed = collect($items)->where('status', 'failed')->count();
        $totalSize = collect($items)->sum('file_size');

        $set = $this->settings();

        return response()->json([
            'success' => true,
            'data'    => [
                'stats' => [
                    'total'       => count($items),
                    'done'        => $done,
                    'failed'      => $failed,
                    'total_size'  => $this->moneySize((int) $totalSize),
                    'disk_free'   => $this->moneySize((int) $diskFree),
                    'disk_total'  => $this->moneySize((int) $diskTotal),
                    'disk_used_pct' => $diskTotal > 0
                        ? round((($diskTotal - $diskFree) / $diskTotal) * 100, 1)
                        : 0,
                ],
                'settings' => [
                    'auto_enabled' => (bool) ($set->auto_enabled ?? false),
                    'auto_time'    => substr((string) ($set->auto_time ?? '02:00:00'), 0, 5),
                    'keep_days'    => (int) ($set->keep_days ?? 30),
                    'max_files'    => (int) ($set->max_files ?? 20),
                    'last_run_at'  => $set->last_run_at ?? null,
                ],
                'items' => $items,
            ],
        ]);
    }

    /** POST /api/admin/backups  { type?, note? } */
    public function store(Request $request)
    {
        $type = in_array($request->input('type'), ['full', 'db', 'files'], true)
            ? $request->input('type')
            : 'db';
        $note = trim((string) $request->input('note', ''));
        $code = 'BK' . date('ymdHis') . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
        $fileName = $code . '.sql';
        $dir = $this->dir();
        $path = $dir . DIRECTORY_SEPARATOR . $fileName;

        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Không tạo được thư mục storage/app/backups',
            ], 500);
        }

        if (!is_writable($dir)) {
            return response()->json([
                'success' => false,
                'message' => 'Thư mục backups không ghi được (permission)',
            ], 500);
        }

        $id = null;
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('sm_backups')) {
                $id = \Illuminate\Support\Facades\DB::table('sm_backups')->insertGetId([
                    'code'         => $code,
                    'type'         => $type,
                    'status'       => 'running',
                    'file_name'    => $fileName,
                    'file_path'    => $path,
                    'note'         => $note !== '' ? $note : null,
                    'triggered_by' => null,
                    'started_at'   => now(),
                    'created_at'   => now(),
                ]);
            }

            $sql = $this->exportDatabaseSql();
            if ($sql === '' || strlen($sql) < 50) {
                throw new \RuntimeException('Nội dung SQL xuất ra rỗng');
            }

            if (file_put_contents($path, $sql) === false) {
                throw new \RuntimeException('Không ghi được file: ' . $path);
            }

            $size = filesize($path) ?: 0;

            if ($id) {
                \Illuminate\Support\Facades\DB::table('sm_backups')->where('id', $id)->update([
                    'status'      => 'done',
                    'file_size'   => $size,
                    'finished_at' => now(),
                ]);
            }

            if (\Illuminate\Support\Facades\Schema::hasTable('sm_backup_settings')) {
                \Illuminate\Support\Facades\DB::table('sm_backup_settings')->updateOrInsert(
                    ['id' => 1],
                    ['last_run_at' => now(), 'updated_at' => now()]
                );
            }

            return response()->json([
                'success' => true,
                'message' => 'Sao lưu thành công',
                'data'    => [
                    'id'        => $id,
                    'code'      => $code,
                    'file_name' => $fileName,
                    'file_size' => $size,
                ],
            ]);
        } catch (\Throwable $e) {
            if ($id) {
                \Illuminate\Support\Facades\DB::table('sm_backups')->where('id', $id)->update([
                    'status'        => 'failed',
                    'error_message' => mb_substr($e->getMessage(), 0, 500),
                    'finished_at'   => now(),
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Sao lưu thất bại: ' . $e->getMessage(),
            ], 500);
        }
    }

    /** GET /api/admin/backups/{id}/download */
    public function download(int $id)
    {
        $row = DB::table('sm_backups')->where('id', $id)->first();
        if (!$row || $row->status !== 'done' || empty($row->file_path) || !File::exists($row->file_path)) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy file'], 404);
        }
        return response()->download($row->file_path, $row->file_name, [
            'Content-Type' => 'application/sql',
        ]);
    }

    /** DELETE /api/admin/backups/{id} */
    public function destroy(int $id)
    {
        $row = DB::table('sm_backups')->where('id', $id)->first();
        if (!$row) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy'], 404);
        }
        if (!empty($row->file_path) && File::exists($row->file_path)) {
            File::delete($row->file_path);
        }
        DB::table('sm_backups')->where('id', $id)->delete();
        return response()->json(['success' => true, 'message' => 'Đã xóa bản sao lưu']);
    }

    /** POST /api/admin/backups/{id}/restore */
    public function restore(int $id)
    {
        $row = DB::table('sm_backups')->where('id', $id)->first();
        if (!$row || $row->status !== 'done' || empty($row->file_path) || !File::exists($row->file_path)) {
            return response()->json(['success' => false, 'message' => 'File sao lưu không hợp lệ'], 404);
        }

        // An toàn: môi trường dev cho phép restore SQL thuần;
        // production nên gắn thêm xác nhận 2 lớp + role super_admin.
        try {
            $sql = File::get($row->file_path);
            // Tách statement đơn giản theo ";\n"
            $parts = preg_split('/;\s*\n/', $sql) ?: [];
            DB::beginTransaction();
            foreach ($parts as $stmt) {
                $stmt = trim($stmt);
                if ($stmt === '' || str_starts_with($stmt, '--')) {
                    continue;
                }
                // Chỉ cho phép lệnh an toàn tối thiểu khi demo
                if (preg_match('/^\s*(SET|CREATE|INSERT|UPDATE|DELETE|ALTER|DROP|REPLACE|TRUNCATE)/i', $stmt)) {
                    DB::unprepared($stmt);
                }
            }
            DB::commit();
            return response()->json(['success' => true, 'message' => 'Phục hồi dữ liệu thành công']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Phục hồi thất bại: ' . $e->getMessage(),
            ], 500);
        }
    }

    /** PUT /api/admin/backups/settings */
    public function updateSettings(Request $request)
    {
        if (!Schema::hasTable('sm_backup_settings')) {
            return response()->json(['success' => false, 'message' => 'Chưa có bảng settings'], 500);
        }
        DB::table('sm_backup_settings')->updateOrInsert(
            ['id' => 1],
            [
                'auto_enabled' => $request->boolean('auto_enabled') ? 1 : 0,
                'auto_time'    => $request->input('auto_time', '02:00'),
                'keep_days'    => max(1, (int) $request->input('keep_days', 30)),
                'max_files'    => max(1, (int) $request->input('max_files', 20)),
                'updated_at'   => now(),
            ]
        );
        return response()->json(['success' => true, 'message' => 'Đã lưu cấu hình']);
    }

    private function pruneOld(): void
    {
        if (!\Illuminate\Support\Facades\Schema::hasTable('sm_backups')) {
            return;
        }

        $set = $this->settings();
        $keepDays = max(1, (int) ($set->keep_days ?? 30));
        $maxFiles = max(1, (int) ($set->max_files ?? 20));

        // 1) Xóa bản quá hạn (theo ngày)
        $old = \Illuminate\Support\Facades\DB::table('sm_backups')
            ->where('created_at', '<', now()->subDays($keepDays))
            ->get();

        foreach ($old as $b) {
            if (!empty($b->file_path) && is_file($b->file_path)) {
                @unlink($b->file_path);
            }
            \Illuminate\Support\Facades\DB::table('sm_backups')->where('id', $b->id)->delete();
        }

        // 2) Chỉ giữ $maxFiles bản mới nhất
        // MySQL: OFFSET phải đi kèm LIMIT → không dùng skip() một mình
        $keepIds = \Illuminate\Support\Facades\DB::table('sm_backups')
            ->orderByDesc('id')
            ->limit($maxFiles)
            ->pluck('id')
            ->all();

        if (count($keepIds) === 0) {
            return;
        }

        $excess = \Illuminate\Support\Facades\DB::table('sm_backups')
            ->whereNotIn('id', $keepIds)
            ->get();

        foreach ($excess as $b) {
            if (!empty($b->file_path) && is_file($b->file_path)) {
                @unlink($b->file_path);
            }
            \Illuminate\Support\Facades\DB::table('sm_backups')->where('id', $b->id)->delete();
        }
    }
    /** Xuất schema + data các bảng chính (không dùng mysqldump để dễ chạy Laragon) */
    private function exportDatabaseSql(): string
    {
        $out = "-- School Management Backup\n-- " . date('c') . "\n\nSET FOREIGN_KEY_CHECKS=0;\n\n";
        $tables = DB::select('SHOW TABLES');
        $key = 'Tables_in_' . DB::getDatabaseName();

        foreach ($tables as $t) {
            $name = $t->$key ?? null;
            if (!$name) {
                continue;
            }
            // bỏ bảng tạm / session
            if (str_starts_with($name, 'sessions') || str_starts_with($name, 'cache')) {
                continue;
            }

            $create = DB::select("SHOW CREATE TABLE `{$name}`");
            $createSql = $create[0]->{'Create Table'} ?? null;
            if ($createSql) {
                $out .= "DROP TABLE IF EXISTS `{$name}`;\n{$createSql};\n\n";
            }

            $rows = DB::table($name)->get();
            foreach ($rows as $row) {
                $arr = (array) $row;
                $cols = array_map(fn ($c) => '`' . str_replace('`', '``', $c) . '`', array_keys($arr));
                $vals = array_map(function ($v) {
                    if ($v === null) return 'NULL';
                    return "'" . str_replace(["\\", "'"], ["\\\\", "\\'"], (string) $v) . "'";
                }, array_values($arr));
                $out .= 'INSERT INTO `' . $name . '` (' . implode(',', $cols) . ') VALUES (' . implode(',', $vals) . ");\n";
            }
            $out .= "\n";
        }
        $out .= "SET FOREIGN_KEY_CHECKS=1;\n";
        return $out;
    }
}
