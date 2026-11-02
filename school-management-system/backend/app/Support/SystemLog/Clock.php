<?php

namespace App\Support\SystemLog;

use DateTimeImmutable;
use DateTimeInterface;

/** Thời gian theo múi giờ của ứng dụng (Laravel đã đặt date_default_timezone_set theo APP_TIMEZONE). */
class Clock
{
    public static function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now');
    }

    public static function fmt(DateTimeInterface $d): string
    {
        return $d->format('Y-m-d H:i:s');
    }

    /** vd Clock::ago('24 hours') */
    public static function ago(string $spec): DateTimeImmutable
    {
        return self::now()->modify('-' . $spec);
    }

    public static function iso(?string $dt): ?string
    {
        if (! $dt) {
            return null;
        }
        try {
            return (new DateTimeImmutable($dt))->format(DATE_ATOM);
        } catch (\Throwable) {
            return null;
        }
    }
}
