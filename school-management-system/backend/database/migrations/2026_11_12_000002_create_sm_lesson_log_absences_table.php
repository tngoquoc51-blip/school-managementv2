<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('sm_lesson_log_absences')) {
            return;
        }
        Schema::create('sm_lesson_log_absences', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('log_id');
            $t->unsignedBigInteger('student_id');
            $t->string('student_name', 120);
            $t->string('student_code', 40)->nullable();
            $t->string('type', 12);                                     // excused | unexcused | late
            $t->string('reason', 255)->nullable();
            $t->timestamps();

            $t->index('log_id');
            $t->index(['student_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sm_lesson_log_absences');
    }
};
