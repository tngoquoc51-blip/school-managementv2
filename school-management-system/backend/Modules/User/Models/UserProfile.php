<?php

namespace Modules\User\Models;

use Illuminate\Database\Eloquent\Model;

class UserProfile extends Model
{
    protected $table = 'user_profiles';

    protected $fillable = [
        'user_id', 'gender', 'birth_date', 'id_number', 'address', 'job_title',
        'department', 'employee_code', 'joined_at', 'bio',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
    ];

    protected $casts = [
        'birth_date' => 'date',
        'joined_at' => 'date',
    ];
}
