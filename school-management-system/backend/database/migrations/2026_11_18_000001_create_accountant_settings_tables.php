<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sm_fee_settings')) {
            Schema::create('sm_fee_settings', function (Blueprint $table) {
                $table->string('skey', 60)->primary();
                $table->text('svalue')->nullable();
            });
        }

        if (! Schema::hasTable('sm_fee_items')) {
            Schema::create('sm_fee_items', function (Blueprint $table) {
                $table->id();
                $table->string('code', 30)->unique();
                $table->string('name', 120);
                $table->string('category', 30)->default('tuition');
                $table->unsignedBigInteger('amount')->default(0);
                $table->string('unit', 20)->default('tháng');
                $table->unsignedTinyInteger('grade')->nullable();
                $table->boolean('is_mandatory')->default(true);
                $table->text('note')->nullable();
            });
        }

        if (! Schema::hasTable('sm_reminder_templates')) {
            Schema::create('sm_reminder_templates', function (Blueprint $table) {
                $table->id();
                $table->string('code', 30)->unique();
                $table->string('name', 80);
                $table->unsignedTinyInteger('level')->default(1);
                $table->string('subject', 120);
                $table->text('body');
                $table->boolean('is_active')->default(true);
                $table->boolean('is_system')->default(false);
                $table->string('created_by', 120)->nullable();
                $table->string('updated_by', 120)->nullable();
                $table->timestamps();
            });

            // Mẫu nhắc nợ mẫu mặc định
            DB::table('sm_reminder_templates')->insert([
                [
                    'code' => 'REMIND_L1',
                    'name' => 'Nhắc đóng học phí thông thường (Mức 1)',
                    'level' => 1,
                    'subject' => 'Thông báo thu học phí đợt {period_name}',
                    'body' => 'Kính gửi Quý phụ huynh học sinh {student_name} (Lớp {class_name}), nhà trường xin thông báo khoản học phí đợt {period_name} với số tiền {amount}đ. Hạn nộp là ngày {due_date}. Trân trọng!',
                    'is_active' => 1,
                    'is_system' => 1,
                    'created_by' => 'Hệ thống',
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'code' => 'REMIND_L2',
                    'name' => 'Nhắc nợ sắp quá hạn (Mức 2)',
                    'level' => 2,
                    'subject' => 'Nhắc nộp học phí sắp đến hạn - {student_name}',
                    'body' => 'Kính gửi Quý phụ huynh học sinh {student_name}, khoản học phí đợt {period_name} còn {remaining_amount}đ sẽ đến hạn vào ngày {due_date}. Kính đề nghị Quý phụ huynh hoàn tất đóng phí đúng hạn. Trân trọng!',
                    'is_active' => 1,
                    'is_system' => 1,
                    'created_by' => 'Hệ thống',
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'code' => 'REMIND_L3',
                    'name' => 'Nhắc nợ quá hạn (Mức 3 - Nghiêm trọng)',
                    'level' => 3,
                    'subject' => 'Thông báo học phí quá hạn - {student_name}',
                    'body' => 'Kính gửi Quý phụ huynh, học phí đợt {period_name} của học sinh {student_name} đã quá hạn đóng ({remaining_amount}đ). Xin vui lòng liên hệ phòng Kế toán để được hỗ trợ hoặc đóng phí ngay. Trân trọng!',
                    'is_active' => 1,
                    'is_system' => 1,
                    'created_by' => 'Hệ thống',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            ]);
        }

        if (! Schema::hasTable('sm_acc_setting_log')) {
            Schema::create('sm_acc_setting_log', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('staff_id')->nullable();
                $table->string('staff_name', 120)->nullable();
                $table->string('area', 60);
                $table->string('action', 60);
                $table->text('detail')->nullable();
                $table->string('ip', 45)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('sm_acc_user_prefs')) {
            Schema::create('sm_acc_user_prefs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('staff_id')->unique();
                $table->boolean('notify_new_payment')->default(true);
                $table->boolean('notify_overdue')->default(true);
                $table->boolean('notify_dispute')->default(true);
                $table->boolean('notify_wallet_topup')->default(true);
                $table->boolean('daily_digest')->default(true);
                $table->string('digest_time', 10)->default('07:30');
                $table->integer('overdue_after_days')->default(7);
                $table->string('density', 20)->default('comfortable');
                $table->string('landing_page', 30)->default('dashboard');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('sm_fee_audit')) {
            Schema::create('sm_fee_audit', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('actor_id')->nullable();
                $table->string('action', 60);
                $table->unsignedBigInteger('fee_item_id')->nullable();
                $table->text('detail')->nullable();
                $table->string('ip', 45)->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sm_acc_user_prefs');
        Schema::dropIfExists('sm_acc_setting_log');
        Schema::dropIfExists('sm_reminder_templates');
    }
};
