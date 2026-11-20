<?php

return [
    // Bảo vệ API giáo viên: đăng nhập + quyền admin. Dev Laragon chưa có token: đặt TEACHER_API_AUTH=false trong .env
    'middleware' => env('TEACHER_API_AUTH', true)
        ? array_values(array_filter(['auth:sanctum', class_exists(\App\Http\Middleware\AdminAccess::class) ? \App\Http\Middleware\AdminAccess::class : null]))
        : [],

    // Định mức tiết dạy / tuần (chủ nhiệm giảm 4 tiết) — dùng chung với module Môn học
    'teacher_quota'      => (int) env('SUBJECT_TEACHER_QUOTA', 17),
    'homeroom_reduction' => (int) env('SUBJECT_HOMEROOM_REDUCTION', 4),
    // Cảnh báo chứng chỉ sắp hết hạn trong N ngày
    'cert_warn_days'     => (int) env('TEACHER_CERT_WARN_DAYS', 60),
];
