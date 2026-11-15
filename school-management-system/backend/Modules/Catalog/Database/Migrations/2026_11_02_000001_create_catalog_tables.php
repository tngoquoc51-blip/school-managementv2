<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Module Danh mục hệ thống. Mỗi bảng có kiểm tra hasTable nên dùng song song với
 * file SQL (Database/catalog_module.sql) mà không bị lỗi "table already exists".
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('cat_groups')) {
            Schema::create('cat_groups', function (Blueprint $t) {
                $t->id();
                $t->string('code', 50)->unique();
                $t->string('name', 150);
                $t->string('description', 500)->nullable();
                $t->string('icon', 30)->nullable();
                $t->string('color', 20)->nullable();
                $t->boolean('is_system')->default(false);
                $t->boolean('is_active')->default(true);
                $t->integer('sort_order')->default(0);
                $t->unsignedBigInteger('created_by')->nullable();
                $t->unsignedBigInteger('updated_by')->nullable();
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('cat_items')) {
            Schema::create('cat_items', function (Blueprint $t) {
                $t->id();
                $t->foreignId('group_id')->constrained('cat_groups')->cascadeOnDelete();
                $t->string('code', 50);
                $t->string('name', 191);
                $t->string('short_name', 50)->nullable();
                $t->string('description', 500)->nullable();
                $t->string('value', 100)->nullable();
                $t->string('color', 20)->nullable();
                $t->integer('sort_order')->default(0);
                $t->boolean('is_system')->default(false);
                $t->boolean('is_active')->default(true);
                $t->unsignedBigInteger('created_by')->nullable();
                $t->unsignedBigInteger('updated_by')->nullable();
                $t->timestamps();
                $t->unique(['group_id', 'code']);
                $t->index(['group_id', 'is_active', 'sort_order']);
            });
        }

        if (! Schema::hasTable('cat_departments')) {
            Schema::create('cat_departments', function (Blueprint $t) {
                $t->id();
                $t->string('code', 30)->unique();
                $t->string('name', 191);
                $t->string('description', 500)->nullable();
                $t->string('head_name', 120)->nullable();
                $t->string('phone', 20)->nullable();
                $t->string('email', 120)->nullable();
                $t->integer('sort_order')->default(0);
                $t->boolean('is_system')->default(false);
                $t->boolean('is_active')->default(true);
                $t->unsignedBigInteger('created_by')->nullable();
                $t->unsignedBigInteger('updated_by')->nullable();
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('cat_subjects')) {
            Schema::create('cat_subjects', function (Blueprint $t) {
                $t->id();
                $t->string('code', 30)->unique();
                $t->string('name', 191);
                $t->string('short_name', 50)->nullable();
                $t->string('subject_group', 20)->default('other')->index();
                $t->foreignId('department_id')->nullable()->constrained('cat_departments')->nullOnDelete();
                $t->decimal('periods_per_week', 3, 1)->default(1);
                $t->decimal('coefficient', 3, 1)->default(1);
                $t->string('kind', 20)->default('required');
                $t->string('grading_type', 20)->default('score');
                $t->json('applicable_grades')->nullable();
                $t->string('description', 500)->nullable();
                $t->string('color', 20)->nullable();
                $t->integer('sort_order')->default(0);
                $t->boolean('is_system')->default(false);
                $t->boolean('is_active')->default(true);
                $t->unsignedBigInteger('created_by')->nullable();
                $t->unsignedBigInteger('updated_by')->nullable();
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('cat_rooms')) {
            Schema::create('cat_rooms', function (Blueprint $t) {
                $t->id();
                $t->string('code', 30)->unique();
                $t->string('name', 191);
                $t->string('room_type', 20)->default('classroom')->index();
                $t->string('building', 50)->nullable()->index();
                $t->tinyInteger('floor')->default(1);
                $t->unsignedSmallInteger('capacity')->default(0);
                $t->string('facilities', 500)->nullable();
                $t->string('status', 20)->default('available');
                $t->integer('sort_order')->default(0);
                $t->boolean('is_system')->default(false);
                $t->boolean('is_active')->default(true);
                $t->unsignedBigInteger('created_by')->nullable();
                $t->unsignedBigInteger('updated_by')->nullable();
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('cat_audit_logs')) {
            Schema::create('cat_audit_logs', function (Blueprint $t) {
                $t->id();
                $t->string('entity', 20);
                $t->unsignedBigInteger('entity_id');
                $t->string('entity_label', 255)->nullable();
                $t->string('action', 20)->index();
                $t->json('before')->nullable();
                $t->json('after')->nullable();
                $t->unsignedBigInteger('user_id')->nullable();
                $t->string('user_name', 100)->nullable();
                $t->string('ip', 45)->nullable();
                $t->timestamp('restored_at')->nullable();
                $t->timestamp('created_at')->nullable()->index();
                $t->index(['entity', 'entity_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cat_audit_logs');
        Schema::dropIfExists('cat_rooms');
        Schema::dropIfExists('cat_subjects');
        Schema::dropIfExists('cat_departments');
        Schema::dropIfExists('cat_items');
        Schema::dropIfExists('cat_groups');
    }
};
