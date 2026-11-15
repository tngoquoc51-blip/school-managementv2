<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sm_grade_windows')) {
            Schema::create('sm_grade_windows', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('school_year_id');
                $table->unsignedTinyInteger('semester'); // 1 hoặc 2
                $table->string('status', 10)->default('closed'); // open | closed
                $table->timestamp('opened_at')->nullable();
                $table->unsignedBigInteger('opened_by')->nullable();
                $table->timestamp('closes_at')->nullable(); // tự động đóng sau mốc này (tùy chọn)
                $table->timestamp('closed_at')->nullable();
                $table->unsignedBigInteger('closed_by')->nullable();
                $table->string('note', 255)->nullable();
                $table->timestamps();
                $table->unique(['school_year_id', 'semester']);
            });
        }

        if (! Schema::hasTable('sm_grade_window_exceptions')) {
            Schema::create('sm_grade_window_exceptions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('window_id');
                $table->unsignedInteger('class_id');
                $table->unsignedInteger('subject_id')->nullable(); // null = mở toàn bộ môn của lớp này
                $table->timestamp('expires_at')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->foreign('window_id')->references('id')->on('sm_grade_windows')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('sm_grade_activity')) {
            Schema::create('sm_grade_activity', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('school_year_id');
                $table->unsignedTinyInteger('semester');
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('action', 40); // open_window | close_window | add_exception | remove_exception
                $table->string('detail', 500)->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sm_grade_activity');
        Schema::dropIfExists('sm_grade_window_exceptions');
        Schema::dropIfExists('sm_grade_windows');
    }
};
