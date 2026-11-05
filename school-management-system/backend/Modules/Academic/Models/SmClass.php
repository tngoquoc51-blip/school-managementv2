<?php

namespace Modules\Academic\Models;

use Illuminate\Database\Eloquent\Model;

/** Lớp học theo năm học (bảng sm_classes của school_db). */
class SmClass extends Model
{
    protected $table = 'sm_classes';

    protected $fillable = [
        'school_year_id', 'grade', 'name', 'homeroom_teacher_id',
        'room', 'capacity', 'status', 'note',
    ];
}
