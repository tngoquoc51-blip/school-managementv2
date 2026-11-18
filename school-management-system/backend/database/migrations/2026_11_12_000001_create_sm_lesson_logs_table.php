<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Sổ đầu bài: mỗi dòng = một tiết học của một lớp. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('sm_lesson_logs')) {
            return;
        }
        Schema::create('sm_lesson_logs', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('school_year_id')->nullable();
            $t->unsignedBigInteger('class_id');
            $t->string('class_name', 60);
            $t->string('subject_name', 120);
            $t->date('lesson_date');
            $t->unsignedTinyInteger('period');                         // tiết 1–10
            $t->unsignedBigInteger('teacher_id')->nullable();           // sm_staff_accounts.id
            $t->string('teacher_name', 120)->nullable();
            $t->unsignedSmallInteger('lesson_no')->nullable();          // tiết theo phân phối chương trình
            $t->string('title', 255)->nullable();                       // tên bài học
            $t->text('content')->nullable();                            // nội dung đã dạy
            $t->string('equipment', 255)->nullable();                   // thiết bị / đồ dùng dạy học
            $t->text('homework')->nullable();                           // bài tập về nhà
            $t->string('rating', 10)->nullable();                       // good | fair | pass | poor
            $t->unsignedSmallInteger('total_students')->default(0);
            $t->unsignedSmallInteger('absent_excused')->default(0);
            $t->unsignedSmallInteger('absent_unexcused')->default(0);
            $t->unsignedSmallInteger('late_count')->default(0);
            $t->text('discipline_note')->nullable();                    // vi phạm, nhắc nhở
            $t->text('remark')->nullable();                             // nhận xét chung của giáo viên
            $t->text('homeroom_note')->nullable();                      // ý kiến giáo viên chủ nhiệm
            $t->string('status', 12)->default('draft');                 // draft | signed | confirmed
            $t->dateTime('signed_at')->nullable();
            $t->unsignedBigInteger('confirmed_by')->nullable();
            $t->dateTime('confirmed_at')->nullable();
            $t->unsignedBigInteger('created_by')->nullable();
            $t->timestamps();

            $t->unique(['class_id', 'lesson_date', 'period'], 'uq_lesson_slot');
            $t->index(['teacher_id', 'lesson_date']);
            $t->index(['status', 'lesson_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sm_lesson_logs');
    }
};
