<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    protected $fillable = [
        'code', 'full_name', 'class_id', 'status',
    ];

    public function classRoom()
    {
        // bảng classes
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function feeDebts()
    {
        return $this->hasMany(StudentFeeDebt::class);
    }
}
