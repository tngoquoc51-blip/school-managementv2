<?php

namespace Modules\Logs\Support;

use Carbon\Carbon;

/** Thời gian theo múi giờ ứng dụng (đặt APP_TIMEZONE=Asia/Ho_Chi_Minh trong .env). */
class Clock
{
    public static function now(): Carbon
    {
        return Carbon::now(config('app.timezone'));
    }

    public static function nowMs(): string
    {
        return self::now()->format('Y-m-d H:i:s.v');
    }

    public static function nowSql(): string
    {
        return self::now()->format('Y-m-d H:i:s');
    }
}
