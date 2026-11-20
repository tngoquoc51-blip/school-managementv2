<?php

namespace Modules\Setting\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

/**
 * Sao lưu / phục hồi dựa trên bảng sm_backups + sm_backup_settings (đã có trong DB).
 * Cần mysqldump / mysql. Laragon: khai báo trong .env, ví dụ
 *   MYSQLDUMP_PATH="C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysqldump.exe"
 *   MYSQL_PATH="C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe"
 */
class BackupService
{
    public function settings(): object
    {
        $s = DB::table('sm_backup_settings')->where('id', 1)->first();
        if (! $s) {
            DB::table('sm_backup_settings')->insert(['id' => 1, 'auto_enabled' => 0, 'auto_time' => '02:00:00', 'keep_days' => 30, 'max_files' => 20, 'storage_path' => 'storage/app/backups', 'updated_at' => now()]);
            $s = DB::table('sm_backup_settings')->where('id', 1)->first();
        }
        return $s;
    }

    public function dir(): string
    {
        $p = $this->settings()->storage_path ?: 'storage/app/backups';
        $abs = preg_match('#^([A-Za-z]:[\\\\/]|/)#', $p) ? $p : base_path($p);
        if (! is_dir($abs)) @mkdir($abs, 0775, true);
        return $abs;
    }

    public function create(string $type, ?string $note, ?int $userId): object
    {
        @set_time_limit(0);
        $code = 'BK' . now()->format('ymdHis') . strtoupper(Str::random(4));
        $ext  = $type === 'db' ? 'sql' : 'zip';
        $name = "$code.$ext";
        $path = $this->dir() . DIRECTORY_SEPARATOR . $name;

        $id = DB::table('sm_backups')->insertGetId([
            'code' => $code, 'type' => $type, 'status' => 'running', 'file_name' => $name, 'file_path' => $path,
            'note' => $note, 'triggered_by' => $userId, 'started_at' => now(), 'created_at' => now(),
        ]);

        try {
            if ($type === 'db') {
                $this->dumpDb($path);
            } elseif ($type === 'files') {
                $this->zipFiles($path);
            } else { // full = SQL + files trong 1 file zip
                $tmp = $this->dir() . DIRECTORY_SEPARATOR . "$code.sql";
                $this->dumpDb($tmp);
                $this->zipFiles($path, $tmp);
                @unlink($tmp);
            }
            DB::table('sm_backups')->where('id', $id)->update(['status' => 'done', 'file_size' => filesize($path), 'finished_at' => now()]);
        } catch (\Throwable $e) {
            @unlink($path);
            DB::table('sm_backups')->where('id', $id)->update(['status' => 'failed', 'error_message' => mb_substr($e->getMessage(), 0, 2000), 'finished_at' => now()]);
        }

        DB::table('sm_backup_settings')->where('id', 1)->update(['last_run_at' => now()]);
        $this->prune();
        return DB::table('sm_backups')->where('id', $id)->first();
    }

    protected function dumpDb(string $file): void
    {
        $c = config('database.connections.' . config('database.default'));
        $bin = env('MYSQLDUMP_PATH', 'mysqldump');
        $p = new Process([$bin, '--host=' . $c['host'], '--port=' . $c['port'], '--user=' . $c['username'],
            '--single-transaction', '--routines', '--triggers', '--no-tablespaces',
            '--default-character-set=utf8mb4', '--result-file=' . $file, $c['database']], null, ['MYSQL_PWD' => (string) $c['password']]);
        $p->setTimeout(null)->run();
        if (! $p->isSuccessful() || ! is_file($file) || filesize($file) < 100) {
            throw new \RuntimeException('mysqldump lỗi: ' . trim($p->getErrorOutput() ?: 'không tìm thấy mysqldump — khai báo MYSQLDUMP_PATH trong .env'));
        }
    }

    protected function zipFiles(string $zipPath, ?string $sqlFile = null): void
    {
        $zip = new \ZipArchive();
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) throw new \RuntimeException('Không tạo được file zip');
        if ($sqlFile) $zip->addFile($sqlFile, 'database.sql');
        $root = storage_path('app/public');
        if (is_dir($root)) {
            $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS));
            foreach ($it as $f) if ($f->isFile()) $zip->addFile($f->getPathname(), 'files/' . substr($f->getPathname(), strlen($root) + 1));
        }
        $zip->close();
    }

    /** Xóa bản sao lưu quá hạn / vượt số lượng tối đa. */
    public function prune(): void
    {
        $s = $this->settings();
        $old = DB::table('sm_backups')->where('created_at', '<', now()->subDays(max(1, (int) $s->keep_days)))->get();
        $extra = DB::table('sm_backups')->orderByDesc('id')->skip(max(1, (int) $s->max_files))->take(1000)->get();
        foreach ($old->merge($extra)->unique('id') as $b) $this->remove($b);
    }

    public function remove(object $b): void
    {
        if ($b->file_path && is_file($b->file_path)) @unlink($b->file_path);
        DB::table('sm_backups')->where('id', $b->id)->delete();
    }

    public function restore(object $b): void
    {
        @set_time_limit(0);
        if ($b->type !== 'db' || ! $b->file_path || ! is_file($b->file_path)) throw new \RuntimeException('Chỉ phục hồi được bản sao lưu CSDL (.sql) còn tồn tại trên máy chủ.');
        $c = config('database.connections.' . config('database.default'));
        $in = fopen($b->file_path, 'r');
        $p = new Process([env('MYSQL_PATH', 'mysql'), '--host=' . $c['host'], '--port=' . $c['port'], '--user=' . $c['username'],
            '--default-character-set=utf8mb4', $c['database']], null, ['MYSQL_PWD' => (string) $c['password']]);
        $p->setInput($in)->setTimeout(null)->run();
        fclose($in);
        if (! $p->isSuccessful()) throw new \RuntimeException('mysql lỗi: ' . trim($p->getErrorOutput()));
    }

    /** Gọi mỗi phút từ scheduler (routes/console.php). */
    public function runAuto(): void
    {
        $s = $this->settings();
        if (! $s->auto_enabled) return;
        if (now()->format('H:i') !== substr((string) $s->auto_time, 0, 5)) return;
        if ($s->last_run_at && substr((string) $s->last_run_at, 0, 10) === now()->toDateString()) return;
        $this->create('db', 'Sao lưu tự động theo lịch', null);
    }
}
