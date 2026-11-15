<?php

namespace Modules\Rewards\Services;

use Illuminate\Support\Facades\DB;

class EmulationLogger
{
    public static function log($user, string $action, string $description): void
    {
        DB::table('sm_rw_logs')->insert([
            'user_id' => $user?->id,
            'user_name' => $user?->name ?? 'Hệ thống',
            'action' => $action,
            'description' => mb_substr($description, 0, 255),
            'created_at' => now(),
        ]);
    }
}
