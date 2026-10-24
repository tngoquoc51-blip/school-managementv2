<?php

namespace App\Support;

use Illuminate\Support\Facades\Crypt;
use Throwable;

/**
 * Mã hóa / giải mã dữ liệu nhạy cảm (PII) khi lưu DB.
 * Dùng APP_KEY của Laravel — không lưu khóa riêng trong code.
 */
class DataCrypto
{
    /** Các cột hồ sơ cần mã hóa khi ghi DB */
    public const SENSITIVE_COLS = [
        'phone',
        'father_phone',
        'mother_phone',
        'guardian_phone',
        'emergency_phone',
        'permanent_address',
        'current_address',
        'health_note',
    ];

    public static function encrypt(?string $plain): ?string
    {
        if ($plain === null || $plain === '') {
            return $plain;
        }
        // Tránh mã hóa 2 lần
        if (self::looksEncrypted($plain)) {
            return $plain;
        }
        return Crypt::encryptString($plain);
    }

    public static function decrypt(?string $stored): ?string
    {
        if ($stored === null || $stored === '') {
            return $stored;
        }
        if (!self::looksEncrypted($stored)) {
            return $stored; // dữ liệu cũ chưa mã hóa
        }
        try {
            return Crypt::decryptString($stored);
        } catch (Throwable $e) {
            return $stored;
        }
    }

    public static function looksEncrypted(string $value): bool
    {
        // Laravel Crypt thường bắt đầu bằng eyJ (base64 JSON)
        return str_starts_with($value, 'eyJ') || str_starts_with($value, 'eyJpdiI6');
    }

    /** Mã hóa mảng field trước khi UPDATE/INSERT */
    public static function encryptFields(array $fields): array
    {
        foreach (self::SENSITIVE_COLS as $col) {
            if (array_key_exists($col, $fields) && is_string($fields[$col])) {
                $fields[$col] = self::encrypt($fields[$col]);
            }
        }
        return $fields;
    }

    /** Giải mã khi đọc ra API */
    public static function decryptFields(array $row): array
    {
        foreach (self::SENSITIVE_COLS as $col) {
            if (isset($row[$col]) && is_string($row[$col])) {
                $row[$col] = self::decrypt($row[$col]);
            }
        }
        return $row;
    }
}
