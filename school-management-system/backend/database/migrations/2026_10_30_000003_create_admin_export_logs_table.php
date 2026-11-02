<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Nhật ký xuất dữ liệu: ai xuất gì, bao nhiêu dòng, có che dữ liệu nhạy cảm không (phục vụ kiểm soát dữ liệu cá nhân). */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('admin_export_logs')) {
            return;
        }
        Schema::create('admin_export_logs', function (Blueprint $table) {
            $table->id();
            $table->string('dataset', 40);
            $table->string('format', 12);                              // csv | xls | json
            $table->unsignedInteger('rows_count')->default(0);
            $table->json('columns')->nullable();
            $table->json('filters')->nullable();
            $table->boolean('masked')->default(false);
            $table->string('ip', 45)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['dataset', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_export_logs');
    }
};
