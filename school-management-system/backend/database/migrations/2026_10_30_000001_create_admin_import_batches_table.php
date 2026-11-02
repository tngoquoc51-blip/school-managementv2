<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Mỗi lần nhập dữ liệu = 1 "lô" (batch): để theo dõi tiến độ, xem lỗi, hoàn tác. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('admin_import_batches')) {
            return;
        }
        Schema::create('admin_import_batches', function (Blueprint $table) {
            $table->id();
            $table->string('dataset', 40);
            $table->string('filename')->nullable();
            $table->string('mode', 12)->default('upsert');            // insert | upsert | update
            $table->json('options')->nullable();
            $table->unsignedInteger('total')->default(0);
            $table->unsignedInteger('processed')->default(0);
            $table->unsignedInteger('inserted')->default(0);
            $table->unsignedInteger('updated')->default(0);
            $table->unsignedInteger('unchanged')->default(0);          // bản ghi đã tồn tại nhưng dữ liệu giống hệt (không cần sửa)
            $table->unsignedInteger('failed')->default(0);
            $table->string('status', 24)->default('running');          // running | completed | completed_with_errors | cancelled | undone
            $table->longText('errors')->nullable();                    // JSON [{row, message}] (tối đa 1000)
            $table->unsignedBigInteger('created_by')->nullable();
            $table->dateTime('started_at')->nullable();
            $table->dateTime('finished_at')->nullable();
            $table->dateTime('undone_at')->nullable();
            $table->unsignedBigInteger('undone_by')->nullable();
            $table->timestamps();

            $table->index(['dataset', 'status']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_import_batches');
    }
};
