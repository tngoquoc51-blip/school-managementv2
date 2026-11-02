<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Mẫu ghép cột đã lưu (đặt tên) để dùng lại cho các file cùng định dạng. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('admin_import_mappings')) {
            return;
        }
        Schema::create('admin_import_mappings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('dataset', 40);
            $table->string('name', 100);
            $table->json('mapping');                                   // { "Tên cột trong file": "field_key" }
            $table->timestamps();

            $table->unique(['user_id', 'dataset', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_import_mappings');
    }
};
