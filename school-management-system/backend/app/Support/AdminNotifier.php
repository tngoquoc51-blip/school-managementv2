<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Gửi thông báo vào hộp thư của tài khoản (bảng admin_notifications). */
class AdminNotifier
{
    public static function push(int $userId, string $type, string $title, string $body = '', string $level = 'info'): void
    {
        DB::table('admin_notifications')->insert([
            'user_id' => $userId, 'type' => $type, 'level' => $level,
            'title' => $title, 'body' => mb_substr($body, 0, 500), 'created_at' => now(),
        ]);
    }

    /** Gọi 1 dòng sau khi đăng nhập thành công. Tôn trọng tuỳ chọn "Cảnh báo đăng nhập". */
    public static function loginAlert($user, Request $r): void
    {
        $p = DB::table('admin_profiles')->where('user_id', $user->id)->first();
        if ($p && !$p->notify_login) return;
        self::push($user->id, 'security', 'Có lượt đăng nhập mới',
            'IP ' . $r->ip() . ' lúc ' . now()->format('H:i d/m/Y') . '. Nếu không phải bạn, hãy đổi mật khẩu ngay.', 'warning');
    }
}
