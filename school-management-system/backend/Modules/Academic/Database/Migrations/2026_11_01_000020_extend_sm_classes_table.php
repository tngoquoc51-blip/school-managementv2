<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mở rộng bảng sm_classes (đã có sẵn trong school_db) + tạo bảng nhật ký thao tác lớp.
 * An toàn khi chạy lại: kiểm tra hasColumn / hasTable trước khi thêm.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sm_classes', function (Blueprint $table) {
            if (! Schema::hasColumn('sm_classes', 'room')) {
                $table->string('room', 30)->nullable()->after('homeroom_teacher_id');
            }
            if (! Schema::hasColumn('sm_classes', 'capacity')) {
                $table->unsignedTinyInteger('capacity')->default(45)->after('room');
            }
            if (! Schema::hasColumn('sm_classes', 'status')) {
                $table->string('status', 20)->default('active')->after('capacity'); // active | paused | closed
            }
            if (! Schema::hasColumn('sm_classes', 'note')) {
                $table->string('note', 255)->nullable()->after('status');
            }
            if (! Schema::hasColumn('sm_classes', 'created_at')) {
                $table->timestamp('created_at')->nullable();
            }
            if (! Schema::hasColumn('sm_classes', 'updated_at')) {
                $table->timestamp('updated_at')->nullable();
            }
        });

        if (! Schema::hasTable('sm_class_activity')) {
            Schema::create('sm_class_activity', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('class_id')->index();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('action', 40);
                $table->string('detail', 500)->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sm_class_activity');
        Schema::table('sm_classes', function (Blueprint $table) {
            foreach (['room', 'capacity', 'status', 'note', 'created_at', 'updated_at'] as $col) {
                if (Schema::hasColumn('sm_classes', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
