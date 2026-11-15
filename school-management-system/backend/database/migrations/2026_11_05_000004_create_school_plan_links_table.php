<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Liên kết kế hoạch với chức năng/tài liệu khác (lịch thi, nhân sự, báo cáo, công văn…). */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('school_plan_links')) {
            return;
        }
        Schema::create('school_plan_links', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('plan_id');
            $t->string('kind', 20)->default('other');
            $t->string('label', 150);
            $t->string('url', 500)->nullable();
            $t->unsignedBigInteger('created_by')->nullable();
            $t->timestamps();

            $t->index('plan_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_plan_links');
    }
};
