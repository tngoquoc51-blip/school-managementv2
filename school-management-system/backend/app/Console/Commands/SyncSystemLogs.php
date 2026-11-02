<?php

namespace App\Console\Commands;

use App\Services\SystemLog\AlertService;
use App\Services\SystemLog\LegacyLogImporter;
use Illuminate\Console\Command;

class SyncSystemLogs extends Command
{
    protected $signature = 'logs:sync';
    protected $description = 'Nhập nhật ký từ các bảng cũ vào system_logs và đánh giá quy tắc cảnh báo';

    public function handle(): int
    {
        $imported = (new LegacyLogImporter())->sync();
        $opened = (new AlertService())->evaluateNow();
        $this->info("Đã nhập {$imported} sự kiện; mở {$opened} sự cố mới.");

        return self::SUCCESS;
    }
}
