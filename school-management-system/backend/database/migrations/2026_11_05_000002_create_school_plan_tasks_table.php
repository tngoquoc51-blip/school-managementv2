<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('school_plan_tasks')) {
            return;
        }
        Schema::create('school_plan_tasks', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('plan_id');
            $t->string('title');
            $t->text('description')->nullable();
            $t->unsignedBigInteger('assignee_id')->nullable();
            $t->string('assignee_name', 120)->nullable();
            $t->date('start_date')->nullable();
            $t->date('due_date')->nullable();
            $t->string('status', 12)->default('todo');             // todo | doing | review | done | blocked
            $t->string('priority', 10)->default('normal');
            $t->unsignedTinyInteger('weight')->default(5);         // trọng số tính tiến độ (1–10)
            $t->unsignedInteger('position')->default(0);
            $t->dateTime('completed_at')->nullable();
            $t->unsignedBigInteger('created_by')->nullable();
            $t->timestamps();

            $t->index(['plan_id', 'status']);
            $t->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_plan_tasks');
    }
};
