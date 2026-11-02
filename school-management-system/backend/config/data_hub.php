<?php

/**
 * Trung tâm dữ liệu (Admin → Nhập / Xuất dữ liệu).
 * Mỗi loại dữ liệu (dataset) khai báo: bảng, cột khóa dùng để nhận diện bản ghi ('upsert'), danh sách trường,
 * luật kiểm tra, từ đồng nghĩa tên cột ('aliases') để tự ghép cột, trường nhạy cảm ('sensitive') để che khi xuất.
 *
 * Tên bảng / cột khác với CSDL của bạn → sửa ở đây. Cột không tồn tại trong bảng sẽ tự bị bỏ qua (và được báo trên giao diện).
 *
 * type: text | email | phone | date | number | select | checkbox | lookup | textarea
 * lookup: giá trị trong file là TÊN (ví dụ tên lớp) → hệ thống tự tra ra ID.
 */
return [
    'max_rows_per_chunk' => 500,
    'max_rows_total'     => 20000,
    'undo_days'          => 14,
    // Mật khẩu ban đầu khi nhập học sinh kèm tạo tài khoản (hãy đổi, và bắt buộc đổi ở lần đăng nhập đầu)
    'default_password'   => env('DATA_HUB_DEFAULT_PASSWORD', 'ChangeMe@2026'),

    'datasets' => [

        'students' => [
            'title' => 'Học sinh', 'noun' => 'học sinh', 'icon' => 'student',
            'table' => 'students', 'upsert' => 'student_code', 'order' => 'student_code',
            'search' => ['student_code', 'name', 'email', 'phone'],
            'sensitive' => ['phone', 'email', 'parent_phone', 'address', 'birth_date'],
            'account' => ['password' => 'password', 'must_change' => 'must_change_password'],
            'fields' => [
                'student_code' => ['label' => 'Mã học sinh', 'type' => 'text', 'rules' => ['required', 'string', 'max:30'],
                                   'aliases' => ['ma hs', 'ma hoc sinh', 'mahs', 'msv', 'student code', 'student_code', 'code']],
                'name'         => ['label' => 'Họ và tên', 'type' => 'text', 'rules' => ['required', 'string', 'max:255'],
                                   'aliases' => ['ho ten', 'ho va ten', 'ten', 'full name', 'name', 'hoc sinh']],
                'birth_date'   => ['label' => 'Ngày sinh', 'type' => 'date', 'rules' => ['nullable', 'date'],
                                   'aliases' => ['ngay sinh', 'dob', 'birthday', 'birth date', 'ns']],
                'gender'       => ['label' => 'Giới tính', 'type' => 'select', 'rules' => ['nullable', 'in:male,female,other'],
                                   'map' => ['nam' => 'male', 'nu' => 'female', 'khac' => 'other', 'male' => 'male', 'female' => 'female', 'm' => 'male', 'f' => 'female'],
                                   'aliases' => ['gioi tinh', 'gioi', 'sex', 'gender']],
                'class_id'     => ['label' => 'Lớp', 'type' => 'lookup', 'rules' => ['nullable', 'integer'],
                                   'lookup' => ['table' => 'classes', 'match' => 'name'],
                                   'aliases' => ['lop', 'ten lop', 'class', 'lop hoc']],
                'email'        => ['label' => 'Email', 'type' => 'email', 'rules' => ['nullable', 'email', 'max:255'], 'aliases' => ['e-mail', 'mail', 'gmail', 'email hoc sinh']],
                'phone'        => ['label' => 'Số điện thoại', 'type' => 'phone', 'rules' => ['nullable', 'string', 'max:20'], 'aliases' => ['sdt', 'dien thoai', 'so dt', 'phone', 'tel']],
                'address'      => ['label' => 'Địa chỉ', 'type' => 'text', 'rules' => ['nullable', 'string', 'max:255'], 'aliases' => ['dia chi', 'noi o', 'address']],
                'parent_name'  => ['label' => 'Phụ huynh', 'type' => 'text', 'rules' => ['nullable', 'string', 'max:255'], 'aliases' => ['ho ten phu huynh', 'ten phu huynh', 'phu huynh', 'bo me', 'parent']],
                'parent_phone' => ['label' => 'SĐT phụ huynh', 'type' => 'phone', 'rules' => ['nullable', 'string', 'max:20'], 'aliases' => ['sdt phu huynh', 'dien thoai phu huynh', 'sdt ph', 'parent phone']],
            ],
        ],

        'classes' => [
            'title' => 'Lớp học', 'noun' => 'lớp', 'icon' => 'layers',
            'table' => 'classes', 'upsert' => 'name', 'order' => 'name',
            'search' => ['name'], 'sensitive' => [],
            'fields' => [
                'name'                => ['label' => 'Tên lớp', 'type' => 'text', 'rules' => ['required', 'string', 'max:50'], 'aliases' => ['lop', 'ten lop', 'class', 'class name']],
                'grade'               => ['label' => 'Khối', 'type' => 'number', 'rules' => ['nullable', 'integer', 'in:10,11,12'], 'aliases' => ['khoi', 'grade', 'khoi lop']],
                'homeroom_teacher_id' => ['label' => 'Giáo viên chủ nhiệm (mã GV)', 'type' => 'lookup', 'rules' => ['nullable', 'integer'],
                                          'lookup' => ['table' => 'teachers', 'match' => 'code'], 'aliases' => ['gvcn', 'ma gvcn', 'chu nhiem', 'ma gv chu nhiem']],
                'room'                => ['label' => 'Phòng học', 'type' => 'text', 'rules' => ['nullable', 'string', 'max:50'], 'aliases' => ['phong', 'phong hoc', 'room']],
                'capacity'            => ['label' => 'Sĩ số tối đa', 'type' => 'number', 'rules' => ['nullable', 'integer', 'min:0', 'max:100'], 'aliases' => ['si so', 'si so toi da', 'capacity']],
            ],
        ],

        'teachers' => [
            'title' => 'Giáo viên', 'noun' => 'giáo viên', 'icon' => 'teacher',
            'table' => 'teachers', 'upsert' => 'code', 'order' => 'name',
            'search' => ['code', 'name', 'email', 'phone'], 'sensitive' => ['phone', 'email'],
            'fields' => [
                'code'       => ['label' => 'Mã giáo viên', 'type' => 'text', 'rules' => ['required', 'string', 'max:30'], 'aliases' => ['ma gv', 'ma giao vien', 'magv', 'code']],
                'name'       => ['label' => 'Họ và tên', 'type' => 'text', 'rules' => ['required', 'string', 'max:255'], 'aliases' => ['ho ten', 'ho va ten', 'ten', 'name', 'giao vien']],
                'email'      => ['label' => 'Email', 'type' => 'email', 'rules' => ['nullable', 'email', 'max:255'], 'aliases' => ['mail', 'gmail', 'e-mail']],
                'phone'      => ['label' => 'Số điện thoại', 'type' => 'phone', 'rules' => ['nullable', 'string', 'max:20'], 'aliases' => ['sdt', 'dien thoai', 'phone']],
                'subject_id' => ['label' => 'Môn giảng dạy (tên môn)', 'type' => 'lookup', 'rules' => ['nullable', 'integer'],
                                 'lookup' => ['table' => 'subjects', 'match' => 'name'], 'aliases' => ['mon', 'mon day', 'mon giang day', 'bo mon', 'subject']],
                'is_active'  => ['label' => 'Đang công tác', 'type' => 'checkbox', 'rules' => ['boolean'], 'aliases' => ['dang cong tac', 'trang thai', 'active']],
            ],
        ],

        'subjects' => [
            'title' => 'Môn học', 'noun' => 'môn học', 'icon' => 'book',
            'table' => 'subjects', 'upsert' => 'code', 'order' => 'name',
            'search' => ['code', 'name'], 'sensitive' => [],
            'fields' => [
                'code'       => ['label' => 'Mã môn', 'type' => 'text', 'rules' => ['required', 'string', 'max:30'], 'aliases' => ['ma mon', 'code', 'mamon']],
                'name'       => ['label' => 'Tên môn học', 'type' => 'text', 'rules' => ['required', 'string', 'max:255'], 'aliases' => ['ten mon', 'mon hoc', 'mon', 'name']],
                'department' => ['label' => 'Tổ bộ môn', 'type' => 'text', 'rules' => ['nullable', 'string', 'max:255'], 'aliases' => ['to bo mon', 'to', 'department']],
                'is_active'  => ['label' => 'Đang giảng dạy', 'type' => 'checkbox', 'rules' => ['boolean'], 'aliases' => ['dang giang day', 'trang thai', 'active']],
            ],
        ],

        'rooms' => [
            'title' => 'Phòng học', 'noun' => 'phòng', 'icon' => 'door',
            'table' => 'rooms', 'upsert' => 'name', 'order' => 'name',
            'search' => ['name', 'building'], 'sensitive' => [],
            'fields' => [
                'name'      => ['label' => 'Tên phòng', 'type' => 'text', 'rules' => ['required', 'string', 'max:100'], 'aliases' => ['phong', 'ten phong', 'room']],
                'building'  => ['label' => 'Dãy / tòa nhà', 'type' => 'text', 'rules' => ['nullable', 'string', 'max:100'], 'aliases' => ['day', 'toa nha', 'building']],
                'capacity'  => ['label' => 'Sức chứa', 'type' => 'number', 'rules' => ['nullable', 'integer', 'min:0', 'max:1000'], 'aliases' => ['suc chua', 'si so', 'capacity']],
                'type'      => ['label' => 'Loại phòng', 'type' => 'select', 'rules' => ['nullable', 'in:lecture,lab,computer,gym,other'],
                                'map' => ['phong hoc' => 'lecture', 'hoc' => 'lecture', 'thi nghiem' => 'lab', 'phong thi nghiem' => 'lab', 'phong may' => 'computer', 'tin hoc' => 'computer', 'the chat' => 'gym', 'nha the chat' => 'gym', 'khac' => 'other',
                                         'lecture' => 'lecture', 'lab' => 'lab', 'computer' => 'computer', 'gym' => 'gym', 'other' => 'other'],
                                'aliases' => ['loai phong', 'loai', 'type']],
                'is_active' => ['label' => 'Đang sử dụng', 'type' => 'checkbox', 'rules' => ['boolean'], 'aliases' => ['dang su dung', 'trang thai', 'active']],
            ],
        ],

        'school-years' => [
            'title' => 'Năm học', 'noun' => 'năm học', 'icon' => 'calendar',
            'table' => 'school_years', 'upsert' => 'label', 'order' => 'label',
            'search' => ['label'], 'sensitive' => [],
            'fields' => [
                'label'      => ['label' => 'Năm học (2026-2027)', 'type' => 'text', 'rules' => ['required', 'string', 'max:20'], 'aliases' => ['nam hoc', 'label', 'ten nam hoc']],
                'start_date' => ['label' => 'Bắt đầu', 'type' => 'date', 'rules' => ['nullable', 'date'], 'aliases' => ['ngay bat dau', 'bat dau', 'start']],
                'end_date'   => ['label' => 'Kết thúc', 'type' => 'date', 'rules' => ['nullable', 'date'], 'aliases' => ['ngay ket thuc', 'ket thuc', 'end']],
                'is_current' => ['label' => 'Năm học hiện hành', 'type' => 'checkbox', 'rules' => ['boolean'], 'aliases' => ['hien hanh', 'hien tai', 'current']],
            ],
        ],
    ],
];
