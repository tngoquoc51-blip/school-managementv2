<?php

return [
    // Middleware bảo vệ API môn học. Mặc định yêu cầu đăng nhập (Sanctum).
    // Khi dev trên Laragon chưa có token có thể đặt SUBJECT_API_AUTH=false trong .env
    'middleware' => env('SUBJECT_API_AUTH', true) ? ['auth:sanctum'] : [],

    // Định mức tiết dạy / tuần của giáo viên THPT (chủ nhiệm được giảm 4 tiết)
    'teacher_quota' => (int) env('SUBJECT_TEACHER_QUOTA', 17),
    'homeroom_reduction' => (int) env('SUBJECT_HOMEROOM_REDUCTION', 4),

    // Ngưỡng điểm đạt môn
    'pass_score' => (float) env('SUBJECT_PASS_SCORE', 5.0),
];
