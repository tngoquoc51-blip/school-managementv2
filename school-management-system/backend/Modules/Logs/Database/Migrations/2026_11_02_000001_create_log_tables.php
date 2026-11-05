<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/**
 * Tạo các bảng của module Nhật ký bằng đúng file SQL trong database/sql/01_logs_module.sql
 * (một nguồn duy nhất, dùng được cả khi import tay bằng HeidiSQL lẫn khi chạy artisan migrate).
 */
return new class extends Migration
{
    public function up(): void
    {
        $sql = File::get(base_path('database/sql/01_logs_module.sql'));

        // Bỏ comment dòng, USE ..., rồi tách từng câu lệnh
        $sql = preg_replace('/^\s*--.*$/m', '', $sql);
        $sql = preg_replace('/^\s*USE\s+`[^`]+`;\s*$/mi', '', $sql);

        foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
            if (stripos($statement, 'SET NAMES') === 0) {
                continue;
            }
            DB::unprepared($statement);
        }
    }

    public function down(): void
    {
        foreach (['sm_log_alerts', 'sm_log_alert_rules', 'sm_log_settings', 'sm_audit_logs'] as $table) {
            DB::unprepared("DROP TABLE IF EXISTS `{$table}`");
        }
    }
};
