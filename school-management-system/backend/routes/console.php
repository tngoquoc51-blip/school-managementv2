<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Modules\Setting\Services\BackupService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// [CÀI ĐẶT HỆ THỐNG] Sao lưu tự động theo giờ cấu hình. Cần chạy: php artisan schedule:work
Schedule::call(fn () => app(BackupService::class)->runAuto())->everyMinute()->name('school-auto-backup')->withoutOverlapping();
