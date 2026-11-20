<?php

namespace Modules\Roster\Support;

use Illuminate\Support\Facades\Crypt;

/** Các cột hồ sơ học sinh được mã hóa bằng APP_KEY trong cơ sở dữ liệu. */
final class Pii
{
    public const COLUMNS = ['phone', 'permanent_address', 'current_address', 'father_phone', 'mother_phone', 'guardian_phone', 'emergency_phone', 'health_note'];
    public const PHONES = ['phone', 'father_phone', 'mother_phone', 'guardian_phone', 'emergency_phone'];

    public static function decrypt(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return $value; // dữ liệu cũ chưa mã hóa
        }
    }

    public static function encrypt(?string $value): ?string
    {
        return ($value === null || $value === '') ? null : Crypt::encryptString($value);
    }

    /** 0912345678 → 09•••••678 */
    public static function maskPhone(?string $v): ?string
    {
        if (! $v) {
            return null;
        }
        $d = preg_replace('/\s+/', '', $v);

        return mb_strlen($d) <= 5 ? str_repeat('•', mb_strlen($d)) : mb_substr($d, 0, 2) . str_repeat('•', mb_strlen($d) - 5) . mb_substr($d, -3);
    }
}
