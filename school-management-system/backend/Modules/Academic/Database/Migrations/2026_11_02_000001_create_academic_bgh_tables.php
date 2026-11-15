<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bảng mới cho khu vực Chuyên môn – BGH. Có kiểm tra hasTable nên an toàn nếu bạn
 * đã chạy file database/sql/academic_bgh_module.sql trước đó (file đó cũng nạp dữ liệu mẫu).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sm_subject_groups')) {
            Schema::create('sm_subject_groups', function (Blueprint $t) {
                $t->increments('id');
                $t->string('code', 20)->unique();
                $t->string('name', 80);
                $t->unsignedInteger('head_teacher_id')->nullable()->index();
                $t->string('color', 9)->default('#6366f1');
                $t->string('description', 255)->nullable();
                $t->dateTime('created_at')->useCurrent();
                $t->foreign('head_teacher_id')->references('id')->on('sm_teachers')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('sm_subject_group_subjects')) {
            Schema::create('sm_subject_group_subjects', function (Blueprint $t) {
                $t->unsignedInteger('group_id');
                $t->unsignedInteger('subject_id')->unique();
                $t->primary(['group_id', 'subject_id']);
                $t->foreign('group_id')->references('id')->on('sm_subject_groups')->cascadeOnDelete();
                $t->foreign('subject_id')->references('id')->on('sm_subjects')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('sm_lesson_plans')) {
            Schema::create('sm_lesson_plans', function (Blueprint $t) {
                $t->increments('id');
                $t->unsignedInteger('teacher_id')->index();
                $t->unsignedInteger('subject_id')->index();
                $t->tinyInteger('grade');
                $t->tinyInteger('week_no');
                $t->string('title', 180);
                $t->text('note')->nullable();
                $t->string('status', 12)->default('pending'); // pending|approved|rejected|revision
                $t->unsignedBigInteger('reviewer_id')->nullable();
                $t->string('reviewer_name', 120)->nullable();
                $t->string('review_note', 500)->nullable();
                $t->dateTime('submitted_at')->useCurrent();
                $t->dateTime('reviewed_at')->nullable();
                $t->index(['status', 'submitted_at'], 'idx_sm_lp_status');
                $t->foreign('teacher_id')->references('id')->on('sm_teachers');
                $t->foreign('subject_id')->references('id')->on('sm_subjects');
            });
        }

        if (! Schema::hasTable('sm_class_observations')) {
            Schema::create('sm_class_observations', function (Blueprint $t) {
                $t->increments('id');
                $t->unsignedInteger('teacher_id');
                $t->unsignedInteger('class_id');
                $t->unsignedInteger('subject_id');
                $t->unsignedBigInteger('observer_id')->nullable();
                $t->string('observer_name', 120);
                $t->date('observed_on')->index();
                $t->tinyInteger('period');
                $t->string('lesson_title', 180);
                $t->decimal('score', 4, 1);
                $t->string('rating', 12); // Tốt|Khá|Đạt|Chưa đạt
                $t->text('strengths')->nullable();
                $t->text('improvements')->nullable();
                $t->dateTime('created_at')->useCurrent();
                $t->index(['teacher_id', 'observed_on'], 'idx_sm_obs_teacher');
                $t->foreign('teacher_id')->references('id')->on('sm_teachers');
                $t->foreign('class_id')->references('id')->on('sm_classes');
                $t->foreign('subject_id')->references('id')->on('sm_subjects');
            });
        }

        if (! Schema::hasTable('sm_academic_requests')) {
            Schema::create('sm_academic_requests', function (Blueprint $t) {
                $t->increments('id');
                $t->string('type', 30); // assignment_change|timetable|exam_schedule|grade_edit|other
                $t->string('title', 180);
                $t->text('detail')->nullable();
                $t->json('payload')->nullable();
                $t->string('requested_by', 120);
                $t->string('priority', 10)->default('normal');
                $t->string('status', 12)->default('pending'); // pending|approved|rejected
                $t->unsignedBigInteger('decided_by')->nullable();
                $t->string('decided_by_name', 120)->nullable();
                $t->string('decision_note', 500)->nullable();
                $t->dateTime('created_at')->useCurrent();
                $t->dateTime('decided_at')->nullable();
                $t->index(['status', 'created_at'], 'idx_sm_ar_status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sm_academic_requests');
        Schema::dropIfExists('sm_class_observations');
        Schema::dropIfExists('sm_lesson_plans');
        Schema::dropIfExists('sm_subject_group_subjects');
        Schema::dropIfExists('sm_subject_groups');
    }
};
