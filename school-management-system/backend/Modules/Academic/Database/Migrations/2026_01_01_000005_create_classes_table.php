<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subjects', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('code', 20)->nullable();
            $table->string('color', 30)->default('sky');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('class_students', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('class_id');
            $table->unsignedBigInteger('user_id');
            $table->string('academic_year', 20)->default('2025-2026');
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['class_id', 'user_id', 'academic_year'], 'uq_class_student_year');
        });

        Schema::create('timetable_slots', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('class_id');
            $table->unsignedBigInteger('subject_id');
            $table->string('teacher_name', 150);
            $table->unsignedBigInteger('teacher_id')->nullable();
            $table->tinyInteger('day_of_week'); // 1=T2 ... 6=T7
            $table->tinyInteger('period');      // 1..5
            $table->string('room', 50)->default('');
            $table->string('academic_year', 20)->default('2025-2026');
            $table->tinyInteger('semester')->default(1);
            $table->string('note', 255)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(
                ['class_id', 'academic_year', 'semester', 'day_of_week', 'period'],
                'uq_slot'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timetable_slots');
        Schema::dropIfExists('class_students');
        Schema::dropIfExists('subjects');
    }
};
