<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeeReceiptItem extends Model
{
    protected $fillable = [
        'receipt_id', 'student_fee_debt_id', 'amount',
    ];

    protected $casts = [
        'amount' => 'integer',
    ];

    public function receipt()
    {
        return $this->belongsTo(FeeReceipt::class, 'receipt_id');
    }

    public function debt()
    {
        return $this->belongsTo(StudentFeeDebt::class, 'student_fee_debt_id');
    }
}
