<?php

namespace App\Support\SystemLog;

/** Làm sạch dữ liệu trước khi ghi nhật ký: che mật khẩu/token, cắt chuỗi dài, giới hạn kích thước. */
class Sanitizer
{
    private const SENSITIVE = '/pass|secret|token|authorization|cookie|otp|pin$|cvv|card|signature|hash|api[_-]?key/i';
    private const MAX_DEPTH = 6;
    private const MAX_KEYS = 60;
    private const MAX_STRING = 500;
    private const MAX_JSON_BYTES = 16000;

    public static function clean(mixed $data, int $depth = 0): mixed
    {
        if (is_array($data) || is_object($data)) {
            if ($depth >= self::MAX_DEPTH) {
                return '[quá sâu]';
            }
            $out = [];
            $i = 0;
            foreach ((array) $data as $k => $v) {
                if (++$i > self::MAX_KEYS) {
                    $out['…'] = '[còn nhiều trường khác]';
                    break;
                }
                $out[$k] = (is_string($k) && preg_match(self::SENSITIVE, $k)) ? '***' : self::clean($v, $depth + 1);
            }

            return $out;
        }

        if (is_string($data)) {
            return mb_strlen($data) > self::MAX_STRING ? mb_substr($data, 0, self::MAX_STRING) . '…' : $data;
        }

        return is_scalar($data) || $data === null ? $data : (string) json_encode($data);
    }

    /** Mã hóa JSON an toàn; null nếu rỗng; nếu quá lớn thì chỉ giữ bản xem trước. */
    public static function json(mixed $data): ?string
    {
        if ($data === null || $data === [] || $data === '') {
            return null;
        }
        $flags = JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR;
        $json = json_encode(self::clean($data), $flags);
        if ($json === false) {
            return null;
        }
        if (strlen($json) > self::MAX_JSON_BYTES) {
            return json_encode(['_truncated' => true, '_preview' => mb_substr($json, 0, 2000)], $flags);
        }

        return $json;
    }
}
