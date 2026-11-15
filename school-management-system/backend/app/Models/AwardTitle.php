<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AwardTitle extends Model
{
    protected $table = 'award_titles';
    protected $fillable = ['name', 'code', 'type', 'description', 'is_active'];
}
