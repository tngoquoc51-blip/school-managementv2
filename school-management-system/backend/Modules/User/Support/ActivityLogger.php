<?php

namespace Modules\User\Support;

use Illuminate\Http\Request;
use Modules\User\Models\UserActivityLog;

class ActivityLogger
{
    /**
     * Ghi nhật ký hoạt động. Mã action dùng chung với frontend:
     * login, profile_update, avatar_update, avatar_remove, password_change,
     * session_revoke, settings_update
     */
    public static function log(int $userId, string $action, string $description, ?Request $request = null, array $meta = []): void
    {
        try {
            $request ??= request();

            UserActivityLog::create([
                'user_id' => $userId,
                'action' => $action,
                'description' => $description,
                'ip_address' => $request?->ip(),
                'user_agent' => mb_substr((string) $request?->userAgent(), 0, 255),
                'meta' => $meta ?: null,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
