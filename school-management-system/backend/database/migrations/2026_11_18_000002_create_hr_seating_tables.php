<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Sơ đồ chỗ ngồi
        if (!Schema::hasTable('sm_seat_layouts')) {
            Schema::create('sm_seat_layouts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('class_id');
                $table->unsignedBigInteger('school_year_id');
                $table->unsignedTinyInteger('semester')->default(1);
                $table->string('name', 100);
                $table->string('room_label', 60)->nullable();
                $table->unsignedTinyInteger('rows_n')->default(5);
                $table->unsignedTinyInteger('cols_n')->default(4);
                $table->unsignedTinyInteger('seats_per_desk')->default(2);
                $table->longText('blocked')->nullable();
                $table->string('status', 20)->default('draft');
                $table->unsignedTinyInteger('is_active')->default(0);
                $table->unsignedInteger('version')->default(1);
                $table->dateTime('published_at')->nullable();
                $table->text('note')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->string('created_by_name', 120)->nullable();
                $table->timestamps();

                $table->index(['class_id', 'is_active']);
                $table->index(['class_id', 'school_year_id']);
            });
        }

        // 2. Vị trí chỗ ngồi của từng học sinh
        if (!Schema::hasTable('sm_seat_assignments')) {
            Schema::create('sm_seat_assignments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('layout_id');
                $table->unsignedTinyInteger('seat_row');
                $table->unsignedTinyInteger('seat_col');
                $table->unsignedTinyInteger('seat_pos')->default(0);
                $table->unsignedBigInteger('student_id');
                $table->unsignedTinyInteger('locked')->default(0);
                $table->string('note', 255)->nullable();
                $table->timestamps();

                $table->unique(['layout_id', 'seat_row', 'seat_col', 'seat_pos'], 'uq_seat_slot');
                $table->index(['layout_id', 'student_id']);
            });
        }

        // 3. Nhật ký sự kiện sơ đồ lớp
        if (!Schema::hasTable('sm_seat_events')) {
            Schema::create('sm_seat_events', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('class_id');
                $table->unsignedBigInteger('layout_id')->nullable();
                $table->string('action', 60);
                $table->text('detail')->nullable();
                $table->string('actor_name', 120)->nullable();
                $table->timestamp('created_at')->nullable();

                $table->index(['class_id', 'id']);
            });
        }

        // 4. Lưu ý đặc biệt về chỗ ngồi (thị lực, thính lực, chiều cao...)
        if (!Schema::hasTable('sm_student_seat_flags')) {
            Schema::create('sm_student_seat_flags', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('student_id');
                $table->unsignedBigInteger('school_year_id');
                $table->unsignedTinyInteger('vision')->default(0);
                $table->unsignedTinyInteger('hearing')->default(0);
                $table->unsignedTinyInteger('tall')->default(0);
                $table->unsignedTinyInteger('front_required')->default(0);
                $table->longText('avoid_ids')->nullable();
                $table->string('note', 255)->nullable();
                $table->timestamp('updated_at')->nullable();

                $table->unique(['student_id', 'school_year_id'], 'uq_student_flag_year');
            });
        }

        // 5. Tổ học tập trong lớp
        if (!Schema::hasTable('sm_class_groups')) {
            Schema::create('sm_class_groups', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('class_id');
                $table->unsignedBigInteger('school_year_id');
                $table->unsignedTinyInteger('number');
                $table->string('name', 60);
                $table->string('color', 20)->default('#1d6fe0');
                $table->unsignedBigInteger('leader_student_id')->nullable();
                $table->timestamps();

                $table->unique(['class_id', 'school_year_id', 'number'], 'uq_class_group_num');
            });
        }

        // 6. Thành viên của tổ
        if (!Schema::hasTable('sm_class_group_members')) {
            Schema::create('sm_class_group_members', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('group_id');
                $table->unsignedBigInteger('student_id');
                $table->timestamps();

                $table->unique(['group_id', 'student_id'], 'uq_group_member');
            });
        }

        // 7. Ban cán sự lớp
        if (!Schema::hasTable('sm_class_officers')) {
            Schema::create('sm_class_officers', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('class_id');
                $table->unsignedBigInteger('school_year_id');
                $table->string('role', 40);
                $table->unsignedBigInteger('student_id');
                $table->timestamps();

                $table->unique(['class_id', 'school_year_id', 'role'], 'uq_class_officer_role');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sm_class_officers');
        Schema::dropIfExists('sm_class_group_members');
        Schema::dropIfExists('sm_class_groups');
        Schema::dropIfExists('sm_student_seat_flags');
        Schema::dropIfExists('sm_seat_events');
        Schema::dropIfExists('sm_seat_assignments');
        Schema::dropIfExists('sm_seat_layouts');
    }
};
