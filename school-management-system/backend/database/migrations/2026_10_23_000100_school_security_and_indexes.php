<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('sm_security_audit')) {
            Schema::create('sm_security_audit', function (Blueprint $t) {
                $t->id();
                $t->string('actor_type', 20);
                $t->unsignedBigInteger('actor_id')->nullable();
                $t->string('action', 64);
                $t->string('target_table', 64)->nullable();
                $t->string('target_id', 64)->nullable();
                $t->string('ip', 45)->nullable();
                $t->json('meta_json')->nullable();
                $t->timestamp('created_at')->useCurrent();
                $t->index(['actor_type', 'actor_id']);
                $t->index(['action', 'created_at']);
            });
        }

        if (!Schema::hasTable('sm_system_settings')) {
            Schema::create('sm_system_settings', function (Blueprint $t) {
                $t->increments('id');
                $t->string('setting_key', 64)->unique();
                $t->text('setting_value')->nullable();
                $t->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            });
            DB::table('sm_system_settings')->insertOrIgnore([
                ['setting_key' => 'encryption_pii_enabled', 'setting_value' => '1'],
                ['setting_key' => 'api_version', 'setting_value' => 'v1'],
            ]);
        }
    }

    public function down(): void
    {
        // Không drop để tránh mất audit khi rollback nhầm
    }
};
