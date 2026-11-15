<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('homeroom_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('class_id');
            $table->unsignedBigInteger('teacher_id');
            $table->enum('report_type', ['weekly', 'monthly', 'semester', 'yearly', 'custom']);
            $table->string('title');
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->string('academic_year', 20)->default('2025-2026');
            $table->tinyInteger('semester')->default(1);
            $table->enum('status', ['draft', 'submitted', 'approved', 'rejected', 'archived'])->default('draft');
            $table->json('summary_json')->nullable();
            $table->longText('content')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['class_id', 'period_start', 'period_end']);
            $table->index(['teacher_id', 'status']);
        });

        Schema::create('homeroom_report_sections', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('report_id');
            $table->string('section_key', 50);
            $table->string('section_title', 150);
            $table->json('data_json')->nullable();
            $table->text('note')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('report_id')->references('id')->on('homeroom_reports')->onDelete('cascade');
        });

        Schema::create('homeroom_report_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('report_id');
            $table->unsignedBigInteger('user_id');
            $table->string('action', 50);
            $table->string('old_status', 30)->nullable();
            $table->string('new_status', 30)->nullable();
            $table->text('note')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('homeroom_report_logs');
        Schema::dropIfExists('homeroom_report_sections');
        Schema::dropIfExists('homeroom_reports');
    }
};
