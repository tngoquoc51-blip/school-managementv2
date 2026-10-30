<?php

namespace Modules\User\Models;

use Illuminate\Database\Eloquent\Model;

class UserSetting extends Model
{
    protected $table = 'user_settings';

    protected $fillable = [
        'user_id', 'theme', 'language', 'timezone', 'date_format', 'density',
        'notification_prefs', 'password_changed_at',
    ];

    protected $casts = [
        'notification_prefs' => 'array',
        'password_changed_at' => 'datetime',
    ];
}
