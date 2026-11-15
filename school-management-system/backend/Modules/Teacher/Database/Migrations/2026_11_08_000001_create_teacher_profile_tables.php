<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tương đương database/sql/teacher_profile.sql. Có guard hasTable nên an toàn khi DB đã import từ dump.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('teacher_qualifications')) {
            Schema::create('teacher_qualifications', function (Blueprint $t) {
                $t->id();
                $t->unsignedInteger('teacher_id')->index();
                $t->enum('type', ['degree', 'certificate', 'training', 'award'])->default('certificate');
                $t->string('title', 160);
                $t->string('organization', 160)->nullable();
                $t->smallInteger('issued_year')->nullable();
                $t->date('expires_at')->nullable();
                $t->string('note')->nullable();
                $t->timestamps();
            });
        }
        if (! Schema::hasTable('teacher_profile_requests')) {
            Schema::create('teacher_profile_requests', function (Blueprint $t) {
                $t->id();
                $t->unsignedInteger('teacher_id');
                $t->string('field_key', 40);
                $t->string('old_value')->nullable();
                $t->string('new_value');
                $t->string('reason');
                $t->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])->default('pending');
                $t->string('review_note')->nullable();
                $t->string('reviewed_by', 80)->nullable();
                $t->dateTime('reviewed_at')->nullable();
                $t->dateTime('created_at')->useCurrent();
                $t->index(['teacher_id', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_profile_requests');
        Schema::dropIfExists('teacher_qualifications');
    }
};
