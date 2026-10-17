<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentFeeDebt extends Model
{
    protected $fillable = [
        'student_id', 'fee_item_id', 'school_year_id',
        'amount_due', 'amount_paid', 'status',
    ];

    protected $casts = [
        'amount_due' => 'integer',
        'amount_paid' => 'integer',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function feeItem()
    {
        return $this->belongsTo(FeeItem::class, 'fee_item_id');
    }

    public function getAmountRemainAttribute(): int
    {
        return max(0, (int) $this->amount_due - (int) $this->amount_paid);
    }
}
