<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Xác nhận sổ theo tuần của giáo viên chủ nhiệm. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('sm_lesson_log_weeks')) {
            return;
        }
        Schema::create('sm_lesson_log_weeks', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('class_id');
            $t->date('week_start');                                     // thứ Hai của tuần
            $t->string('status', 12)->default('open');                  // open | confirmed
            $t->unsignedBigInteger('confirmed_by')->nullable();
            $t->string('confirmed_name', 120)->nullable();
            $t->dateTime('confirmed_at')->nullable();
            $t->string('note', 500)->nullable();
            $t->timestamps();

            $t->unique(['class_id', 'week_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sm_lesson_log_weeks');
    }
};
