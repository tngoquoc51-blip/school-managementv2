<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeeReceipt extends Model
{
    protected $fillable = [
        'receipt_no', 'student_id', 'total_amount',
        'payment_method', 'paid_at', 'collected_by', 'note',
    ];

    protected $casts = [
        'total_amount' => 'integer',
        'paid_at' => 'date',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function items()
    {
        return $this->hasMany(FeeReceiptItem::class, 'receipt_id');
    }
}
