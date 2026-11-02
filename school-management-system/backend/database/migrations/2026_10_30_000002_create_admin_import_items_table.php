<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Dấu vết từng bản ghi bị thay đổi trong lô nhập – dùng để HOÀN TÁC. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('admin_import_items')) {
            return;
        }
        Schema::create('admin_import_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('batch_id');
            $table->unsignedBigInteger('record_id');
            $table->string('action', 10);                              // insert | update
            $table->json('before')->nullable();                        // giá trị cũ của các cột bị sửa (khi update)
            $table->timestamp('created_at')->nullable();

            $table->index('batch_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_import_items');
    }
};
