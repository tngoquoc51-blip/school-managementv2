<?php

namespace Modules\User\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Modules\User\Support\DeviceParser;

class UserLoginHistory extends Model
{
    public $timestamps = false;

    protected $table = 'user_login_histories';

    protected $fillable = [
        'user_id', 'token_id', 'status', 'ip_address', 'user_agent',
        'device', 'browser', 'platform', 'created_at',
    ];

    protected $casts = ['created_at' => 'datetime'];

    /** Ghi nhận một lần đăng nhập (thành công hoặc thất bại). Không bao giờ làm hỏng luồng đăng nhập. */
    public static function record(int $userId, Request $request, string $status = 'success', ?int $tokenId = null): void
    {
        try {
            $ua = (string) $request->userAgent();
            $d = DeviceParser::parse($ua);

            static::create([
                'user_id' => $userId,
                'token_id' => $tokenId,
                'status' => $status,
                'ip_address' => $request->ip(),
                'user_agent' => mb_substr($ua, 0, 255),
                'device' => $d['device'],
                'browser' => $d['browser'],
                'platform' => $d['platform'],
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
