<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Dòng thời gian: tạo, sửa, ký, mở lại, xác nhận tuần, bình luận. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('sm_lesson_log_events')) {
            return;
        }
        Schema::create('sm_lesson_log_events', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('log_id');
            $t->string('type', 12);                                     // create | update | sign | unsign | confirm | reopen | comment
            $t->text('message');
            $t->unsignedBigInteger('actor_id')->nullable();
            $t->string('actor_name', 120)->nullable();
            $t->timestamp('created_at')->nullable();

            $t->index(['log_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sm_lesson_log_events');
    }
};
