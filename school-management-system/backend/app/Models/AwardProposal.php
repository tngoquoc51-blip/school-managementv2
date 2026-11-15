<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AwardProposal extends Model
{
    use SoftDeletes;

    protected $table = 'award_proposals';

    protected $fillable = [
        'period_id', 'class_id', 'student_id', 'student_code', 'student_name',
        'title_id', 'reason', 'status', 'proposed_by', 'reviewed_by',
        'reviewed_at', 'review_note'
    ];

    public function period()
    {
        return $this->belongsTo(AwardPeriod::class, 'period_id');
    }

    public function title()
    {
        return $this->belongsTo(AwardTitle::class, 'title_id');
    }
}
