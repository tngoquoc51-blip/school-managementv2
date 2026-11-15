<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tương đương database/school_emulation.sql.
 * Có guard hasTable nên an toàn khi DB đã import bằng file SQL.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('sm_rw_criteria')) {
            Schema::create('sm_rw_criteria', function (Blueprint $t) {
                $t->increments('id');
                $t->string('code', 12)->unique();
                $t->string('name', 150);
                $t->enum('category', ['nenep', 'hoctap', 'vesinh', 'laodong', 'phongtrao', 'khac'])->default('nenep');
                $t->enum('type', ['plus', 'minus']);
                $t->decimal('default_points', 5, 1);
                $t->string('description')->nullable();
                $t->boolean('is_active')->default(true);
                $t->smallInteger('sort_order')->default(0);
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('sm_rw_records')) {
            Schema::create('sm_rw_records', function (Blueprint $t) {
                $t->id();
                $t->unsignedInteger('school_year_id');
                $t->unsignedInteger('class_id');
                $t->unsignedInteger('criteria_id');
                $t->decimal('points', 5, 1);
                $t->date('record_date');
                $t->string('note')->nullable();
                $t->string('source', 10)->default('manual');
                $t->unsignedBigInteger('recorded_by')->nullable();
                $t->string('recorded_by_name', 120)->nullable();
                $t->timestamp('created_at')->nullable();
                $t->index(['class_id', 'record_date']);
                $t->index(['school_year_id', 'record_date']);
                $t->foreign('class_id')->references('id')->on('sm_classes')->cascadeOnDelete();
                $t->foreign('criteria_id')->references('id')->on('sm_rw_criteria');
            });
        }

        if (!Schema::hasTable('sm_rw_awards')) {
            Schema::create('sm_rw_awards', function (Blueprint $t) {
                $t->id();
                $t->unsignedInteger('school_year_id');
                $t->enum('target_type', ['class', 'student'])->default('class');
                $t->unsignedInteger('class_id')->nullable()->index();
                $t->unsignedInteger('student_id')->nullable()->index();
                $t->enum('kind', ['khen_thuong', 'nhac_nho', 'ky_luat'])->default('khen_thuong');
                $t->string('title', 150);
                $t->text('reason');
                $t->string('level', 30)->nullable();
                $t->string('period_label', 60)->nullable();
                $t->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
                $t->unsignedBigInteger('proposed_by')->nullable();
                $t->string('proposed_by_name', 120)->nullable();
                $t->unsignedBigInteger('reviewed_by')->nullable();
                $t->string('reviewed_by_name', 120)->nullable();
                $t->dateTime('reviewed_at')->nullable();
                $t->string('review_note', 500)->nullable();
                $t->timestamps();
                $t->index(['school_year_id', 'status']);
            });
        }

        if (!Schema::hasTable('sm_rw_logs')) {
            Schema::create('sm_rw_logs', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('user_id')->nullable();
                $t->string('user_name', 120);
                $t->string('action', 30);
                $t->string('description');
                $t->dateTime('created_at')->index();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sm_rw_logs');
        Schema::dropIfExists('sm_rw_awards');
        Schema::dropIfExists('sm_rw_records');
        Schema::dropIfExists('sm_rw_criteria');
    }
};
