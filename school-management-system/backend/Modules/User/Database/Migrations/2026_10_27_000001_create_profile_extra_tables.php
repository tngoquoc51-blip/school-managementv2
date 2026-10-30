<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'avatar')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('avatar')->nullable()->after('phone');
            });
        }

        if (! Schema::hasTable('user_settings')) {
            Schema::create('user_settings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
                $table->string('theme', 10)->default('light');
                $table->string('language', 5)->default('vi');
                $table->string('timezone', 50)->default('Asia/Ho_Chi_Minh');
                $table->string('date_format', 12)->default('DD/MM/YYYY');
                $table->string('density', 12)->default('comfortable');
                $table->json('notification_prefs')->nullable();
                $table->timestamp('password_changed_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('user_activity_logs')) {
            Schema::create('user_activity_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('action', 50);
                $table->string('description');
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent', 255)->nullable();
                $table->json('meta')->nullable();
                $table->timestamp('created_at')->useCurrent();
                $table->index(['user_id', 'created_at']);
                $table->index(['user_id', 'action']);
            });
        }

        if (! Schema::hasTable('user_login_histories')) {
            Schema::create('user_login_histories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedBigInteger('token_id')->nullable()->index();
                $table->string('status', 10)->default('success');
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent', 255)->nullable();
                $table->string('device', 40)->nullable();
                $table->string('browser', 40)->nullable();
                $table->string('platform', 40)->nullable();
                $table->timestamp('created_at')->useCurrent();
                $table->index(['user_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_login_histories');
        Schema::dropIfExists('user_activity_logs');
        Schema::dropIfExists('user_settings');
        Schema::dropIfExists('user_profiles');
    }
};
