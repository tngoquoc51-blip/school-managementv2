<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class HomeroomReport extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'class_id', 'teacher_id', 'report_type', 'title',
        'period_start', 'period_end', 'academic_year', 'semester',
        'status', 'summary_json', 'content',
        'submitted_at', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'summary_json' => 'array',
        'period_start' => 'date',
        'period_end' => 'date',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    public function sections()
    {
        return $this->hasMany(HomeroomReportSection::class, 'report_id');
    }

    public function logs()
    {
        return $this->hasMany(HomeroomReportLog::class, 'report_id');
    }
}
