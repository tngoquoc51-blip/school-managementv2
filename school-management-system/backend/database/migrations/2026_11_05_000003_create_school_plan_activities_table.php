<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Dòng thời gian của kế hoạch: tạo, sửa, đổi trạng thái, nhiệm vụ, bình luận, phê duyệt. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('school_plan_activities')) {
            return;
        }
        Schema::create('school_plan_activities', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('plan_id');
            $t->string('type', 20);                                // create | update | status | task | comment | approval | link
            $t->text('message');
            $t->json('meta')->nullable();
            $t->unsignedBigInteger('user_id')->nullable();
            $t->string('user_name', 120)->nullable();
            $t->timestamp('created_at')->nullable();

            $t->index(['plan_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_plan_activities');
    }
};
