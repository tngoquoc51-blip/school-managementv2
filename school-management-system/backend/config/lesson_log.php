<?php

/** Cấu hình module Sổ đầu bài (Cổng Giáo viên). Sửa tên bảng/cột nếu CSDL của bạn khác. */
return [
    // Bảng dữ liệu có sẵn của hệ thống (sm_*)
    'tables' => [
        'classes' => 'sm_classes', 'students' => 'sm_students', 'enrollments' => 'sm_enrollments',
        'years' => 'sm_school_years', 'staff' => 'sm_staff_accounts',
    ],
    // Cột giáo viên chủ nhiệm trong bảng lớp (nếu có). Có cột này thì chỉ GVCN của lớp mới xác nhận được sổ tuần.
    'homeroom_column' => 'homeroom_teacher_id',
    // true: không tìm thấy cột GVCN thì KHÔNG cho ai (ngoài ban giám hiệu) xác nhận; false: vai trò homeroom_teacher được xác nhận mọi lớp
    'strict_homeroom' => false,

    'edit_days' => 7,            // giáo viên được sửa/ký tiết dạy trong vòng N ngày kể từ ngày dạy
    'max_period' => 10,
    'periods' => [               // giờ học (chỉnh theo trường)
        1 => ['07:00', '07:45'], 2 => ['07:50', '08:35'], 3 => ['08:50', '09:35'], 4 => ['09:40', '10:25'], 5 => ['10:30', '11:15'],
        6 => ['13:00', '13:45'], 7 => ['13:50', '14:35'], 8 => ['14:50', '15:35'], 9 => ['15:40', '16:25'], 10 => ['16:30', '17:15'],
    ],
    'morning_until' => 5,        // tiết 1–5 buổi sáng, còn lại buổi chiều

    'subjects' => [
        'Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lí', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lí', 'Giáo dục kinh tế và pháp luật',
        'Tin học', 'Công nghệ', 'Giáo dục thể chất', 'Giáo dục quốc phòng và an ninh', 'Hoạt động trải nghiệm, hướng nghiệp',
        'Âm nhạc', 'Mĩ thuật', 'Nội dung giáo dục địa phương', 'Chuyên đề học tập', 'Chào cờ', 'Sinh hoạt lớp',
    ],
    // Nếu hệ thống có bảng môn học, môn sẽ được gộp vào danh sách trên
    'subject_table' => ['table' => 'sm_subjects', 'name' => 'name'],

    'ratings' => ['good' => 'Tốt', 'fair' => 'Khá', 'pass' => 'Đạt', 'poor' => 'Chưa đạt'],
    'absence_types' => ['excused' => 'Có phép', 'unexcused' => 'Không phép', 'late' => 'Đi muộn'],

    // Vai trò được dùng sổ đầu bài / vai trò quản trị (xem & mở lại mọi sổ)
    'allowed_roles' => ['teacher', 'homeroom_teacher', 'department_head', 'academic', 'giao_vien', 'gvcn'],
    'admin_roles' => ['super_admin', 'principal', 'vice_principal', 'bgh', 'hieu_truong', 'pho_hieu_truong'],

    // Liên kết nhanh tới các chức năng khác của cổng Giáo viên
    'links' => [
        ['label' => 'Thời khóa biểu', 'url' => '/teacher/timetable'],
        ['label' => 'Điểm danh', 'url' => '/teacher/attendance'],
        ['label' => 'Bài tập', 'url' => '/teacher/homework'],
        ['label' => 'Lớp chủ nhiệm', 'url' => '/teacher/homeroom'],
    ],
];
