<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('school_plans')) {
            return;
        }
        Schema::create('school_plans', function (Blueprint $t) {
            $t->id();
            $t->string('code', 30)->unique();
            $t->string('title');
            $t->string('level', 20)->default('project');          // year | semester | month | week | project
            $t->string('category', 30)->default('other');
            $t->string('school_year', 9)->nullable();              // 2026-2027
            $t->string('term', 10)->nullable();                    // HK1 | HK2 | CN
            $t->unsignedBigInteger('parent_id')->nullable();       // kế hoạch cha (năm học → học kỳ → tháng…)
            $t->unsignedBigInteger('owner_id')->nullable();
            $t->string('owner_name', 120)->nullable();
            $t->string('department', 120)->nullable();             // tổ / phòng phụ trách
            $t->date('start_date')->nullable();
            $t->date('end_date')->nullable();
            $t->string('status', 20)->default('draft');
            $t->string('priority', 10)->default('normal');
            $t->unsignedTinyInteger('progress')->default(0);       // 0–100, tự tính từ nhiệm vụ nếu có
            $t->unsignedBigInteger('budget')->nullable();          // dự toán (đồng)
            $t->unsignedBigInteger('spent')->default(0);           // đã chi
            $t->text('objectives')->nullable();
            $t->longText('content')->nullable();
            $t->text('result')->nullable();
            $t->dateTime('submitted_at')->nullable();
            $t->unsignedBigInteger('approved_by')->nullable();
            $t->dateTime('approved_at')->nullable();
            $t->string('approval_note', 500)->nullable();
            $t->dateTime('completed_at')->nullable();
            $t->unsignedBigInteger('created_by')->nullable();
            $t->timestamps();
            $t->softDeletes();

            $t->index(['status', 'end_date']);
            $t->index(['school_year', 'level']);
            $t->index('parent_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_plans');
    }
};
