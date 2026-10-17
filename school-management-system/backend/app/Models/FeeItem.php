<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeeItem extends Model
{
    protected $fillable = [
        'school_year_id', 'name', 'target_type', 'grade_level',
        'amount', 'period_type', 'semester_code', 'status', 'note',
    ];

    protected $casts = [
        'amount' => 'integer',
        'grade_level' => 'integer',
    ];
}
