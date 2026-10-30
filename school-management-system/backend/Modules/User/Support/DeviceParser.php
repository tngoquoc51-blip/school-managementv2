<?php

namespace Modules\User\Support;

class DeviceParser
{
    /** Phân tích User-Agent đơn giản (không cần thư viện ngoài). */
    public static function parse(?string $ua): array
    {
        $ua = (string) $ua;

        $browser = 'Không rõ';
        $rules = [
            'Edge' => '/Edg(e|A|iOS)?\//i',
            'Opera' => '/OPR\/|Opera/i',
            'Coc Coc' => '/coc_coc_browser/i',
            'Chrome' => '/Chrome\/|CriOS/i',
            'Firefox' => '/Firefox\/|FxiOS/i',
            'Safari' => '/Safari\//i',
            'Postman' => '/PostmanRuntime/i',
            'curl' => '/curl\//i',
        ];
        foreach ($rules as $name => $pattern) {
            if (preg_match($pattern, $ua)) {
                $browser = $name;
                break;
            }
        }

        $platform = 'Không rõ';
        $platforms = [
            'Windows' => '/Windows NT/i',
            'Android' => '/Android/i',
            'iOS' => '/iPhone|iPad|iPod/i',
            'macOS' => '/Mac OS X|Macintosh/i',
            'Linux' => '/Linux|X11/i',
        ];
        foreach ($platforms as $name => $pattern) {
            if (preg_match($pattern, $ua)) {
                $platform = $name;
                break;
            }
        }

        $device = 'Máy tính';
        if (preg_match('/iPad|Tablet/i', $ua)) {
            $device = 'Máy tính bảng';
        } elseif (preg_match('/Mobile|iPhone|Android/i', $ua)) {
            $device = 'Điện thoại';
        } elseif (in_array($browser, ['Postman', 'curl'], true)) {
            $device = 'Công cụ API';
        }

        return ['browser' => $browser, 'platform' => $platform, 'device' => $device];
    }
}
