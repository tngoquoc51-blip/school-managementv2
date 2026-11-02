<?php

namespace App\Console\Commands;

use App\Services\SystemLog\SystemLogService;
use Illuminate\Console\Command;

class PurgeSystemLogs extends Command
{
    protected $signature = 'logs:purge {--dry-run : Chỉ đếm, không xóa}';
    protected $description = 'Xóa sự kiện nhật ký quá hạn lưu giữ (không xóa sự kiện đã ghim)';

    public function handle(SystemLogService $svc): int
    {
        $res = $svc->purge((bool) $this->option('dry-run'));
        foreach ($res['detail'] as $d) {
            $this->line(sprintf('  %-9s giữ %4d ngày | quá hạn %6d | đã xóa %6d', $d['level'], $d['days'], $d['matched'], $d['deleted']));
        }
        $this->info(($res['dry_run'] ? '[Chạy thử] Sẽ xóa ' : 'Đã xóa ') . $res['total'] . ' sự kiện.');

        return self::SUCCESS;
    }
}
