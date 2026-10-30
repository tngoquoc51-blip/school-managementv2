<?php

namespace Modules\User\Models;

use Illuminate\Database\Eloquent\Model;

class UserActivityLog extends Model
{
    public $timestamps = false;

    protected $table = 'user_activity_logs';

    protected $fillable = ['user_id', 'action', 'description', 'ip_address', 'user_agent', 'meta', 'created_at'];

    protected $casts = [
        'meta' => 'array',
        'created_at' => 'datetime',
    ];
}
