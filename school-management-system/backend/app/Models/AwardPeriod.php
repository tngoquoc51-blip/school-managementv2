<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AwardPeriod extends Model
{
    protected $table = 'award_periods';
    protected $fillable = ['name', 'school_year', 'month', 'start_date', 'end_date', 'status'];
}
