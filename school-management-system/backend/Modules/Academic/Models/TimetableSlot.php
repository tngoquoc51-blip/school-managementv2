<?php

namespace Modules\Academic\Models;

use App\Core\Models\BaseModel;

class TimetableSlot extends BaseModel
{
    protected $table = 'timetable_slots';

    protected $casts = [
        'day_of_week' => 'integer',
        'period'      => 'integer',
        'semester'    => 'integer',
    ];

    public function subject()
    {
        return $this->belongsTo(Subject::class, 'subject_id');
    }

    public function classRoom()
    {
        return $this->belongsTo(ClassRoom::class, 'class_id');
    }
}
