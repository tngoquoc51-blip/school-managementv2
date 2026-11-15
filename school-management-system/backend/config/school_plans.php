<?php

/** Cấu hình module Kế hoạch (Ban Giám hiệu). Nhãn tiếng Việt, luật chuyển trạng thái, mẫu kế hoạch, liên kết nhanh. */
return [
    'code_prefix' => 'KH',

    'levels' => ['year' => 'Năm học', 'semester' => 'Học kỳ', 'month' => 'Tháng', 'week' => 'Tuần', 'project' => 'Dự án / Chuyên đề'],

    'categories' => [
        'academic' => 'Chuyên môn', 'activity' => 'Hoạt động – Phong trào', 'admission' => 'Tuyển sinh', 'exam' => 'Thi – Kiểm tra',
        'staff' => 'Nhân sự – Bồi dưỡng', 'facility' => 'Cơ sở vật chất', 'finance' => 'Tài chính', 'emulation' => 'Thi đua – Khen thưởng', 'other' => 'Khác',
    ],

    'statuses' => [
        'draft' => 'Nháp', 'pending' => 'Chờ phê duyệt', 'approved' => 'Đã phê duyệt', 'running' => 'Đang thực hiện',
        'paused' => 'Tạm dừng', 'completed' => 'Hoàn thành', 'rejected' => 'Bị từ chối', 'cancelled' => 'Đã hủy',
    ],

    'priorities' => ['low' => 'Thấp', 'normal' => 'Bình thường', 'high' => 'Cao', 'urgent' => 'Khẩn'],

    'task_statuses' => ['todo' => 'Cần làm', 'doing' => 'Đang làm', 'review' => 'Chờ kiểm tra', 'done' => 'Hoàn thành', 'blocked' => 'Vướng mắc'],

    // trạng thái hiện tại => các trạng thái được chuyển tới
    'transitions' => [
        'draft'     => ['pending', 'cancelled'],
        'pending'   => ['approved', 'rejected', 'draft'],
        'rejected'  => ['draft', 'cancelled'],
        'approved'  => ['running', 'cancelled'],
        'running'   => ['completed', 'paused', 'cancelled'],
        'paused'    => ['running', 'cancelled'],
        'completed' => [],
        'cancelled' => ['draft'],
    ],

    // Mẫu kế hoạch: nhiệm vụ gồm tiêu đề, số ngày kể từ ngày bắt đầu, trọng số, mức ưu tiên
    'templates' => [
        [
            'key' => 'admission', 'title' => 'Kế hoạch tuyển sinh lớp 10', 'level' => 'project', 'category' => 'admission', 'duration_days' => 120,
            'desc' => 'Từ xây dựng chỉ tiêu, truyền thông, tiếp nhận hồ sơ đến công bố kết quả và nhập học.',
            'tasks' => [
                ['title' => 'Xây dựng chỉ tiêu và phương án tuyển sinh', 'due' => 7, 'w' => 8, 'p' => 'high'],
                ['title' => 'Trình Sở GD&ĐT phê duyệt phương án', 'due' => 14, 'w' => 6, 'p' => 'high'],
                ['title' => 'Truyền thông, tư vấn tuyển sinh tại các trường THCS', 'due' => 45, 'w' => 8, 'p' => 'normal'],
                ['title' => 'Tiếp nhận và kiểm tra hồ sơ', 'due' => 75, 'w' => 10, 'p' => 'high'],
                ['title' => 'Công bố kết quả, xác nhận nhập học', 'due' => 100, 'w' => 8, 'p' => 'high'],
                ['title' => 'Xếp lớp và cấp tài khoản Cổng thông tin cho học sinh mới', 'due' => 115, 'w' => 6, 'p' => 'normal'],
            ],
        ],
        [
            'key' => 'midterm', 'title' => 'Kế hoạch kiểm tra giữa học kỳ', 'level' => 'project', 'category' => 'exam', 'duration_days' => 30,
            'desc' => 'Ra đề, coi thi, chấm bài, nhập điểm và tổng hợp kết quả giữa kỳ.',
            'tasks' => [
                ['title' => 'Thống nhất ma trận và đề kiểm tra các tổ', 'due' => 5, 'w' => 6, 'p' => 'high'],
                ['title' => 'Xếp lịch thi, phòng thi, giám thị', 'due' => 10, 'w' => 6, 'p' => 'normal'],
                ['title' => 'Tổ chức kiểm tra', 'due' => 18, 'w' => 10, 'p' => 'high'],
                ['title' => 'Chấm bài, nhập điểm lên hệ thống', 'due' => 25, 'w' => 8, 'p' => 'high'],
                ['title' => 'Họp rút kinh nghiệm, báo cáo kết quả', 'due' => 30, 'w' => 5, 'p' => 'normal'],
            ],
        ],
        [
            'key' => 'opening', 'title' => 'Kế hoạch tổ chức Lễ khai giảng', 'level' => 'project', 'category' => 'activity', 'duration_days' => 21,
            'desc' => 'Chuẩn bị kịch bản, cơ sở vật chất, khách mời và tổng duyệt.',
            'tasks' => [
                ['title' => 'Xây dựng kịch bản và chương trình', 'due' => 4, 'w' => 6, 'p' => 'normal'],
                ['title' => 'Gửi giấy mời đại biểu, phụ huynh', 'due' => 8, 'w' => 4, 'p' => 'normal'],
                ['title' => 'Chuẩn bị sân khấu, âm thanh, cờ hoa', 'due' => 14, 'w' => 6, 'p' => 'normal'],
                ['title' => 'Tổng duyệt chương trình', 'due' => 19, 'w' => 6, 'p' => 'high'],
                ['title' => 'Tổ chức lễ khai giảng và tổng kết', 'due' => 21, 'w' => 8, 'p' => 'high'],
            ],
        ],
        [
            'key' => 'sports', 'title' => 'Kế hoạch Hội thao truyền thống', 'level' => 'project', 'category' => 'activity', 'duration_days' => 45,
            'desc' => 'Điều lệ, đăng ký đội, lịch thi đấu, trọng tài và khen thưởng.',
            'tasks' => [
                ['title' => 'Ban hành điều lệ và kế hoạch', 'due' => 5, 'w' => 5, 'p' => 'normal'],
                ['title' => 'Các lớp đăng ký môn thi đấu', 'due' => 15, 'w' => 5, 'p' => 'normal'],
                ['title' => 'Lập lịch thi đấu, phân công trọng tài', 'due' => 22, 'w' => 6, 'p' => 'normal'],
                ['title' => 'Tổ chức thi đấu', 'due' => 38, 'w' => 10, 'p' => 'high'],
                ['title' => 'Tổng kết, trao giải, đề xuất khen thưởng', 'due' => 45, 'w' => 6, 'p' => 'normal'],
            ],
        ],
        [
            'key' => 'staffdev', 'title' => 'Kế hoạch bồi dưỡng chuyên môn giáo viên', 'level' => 'semester', 'category' => 'staff', 'duration_days' => 150,
            'desc' => 'Chuyên đề, dự giờ, sinh hoạt tổ nhóm và đánh giá giáo viên.',
            'tasks' => [
                ['title' => 'Khảo sát nhu cầu bồi dưỡng', 'due' => 10, 'w' => 4, 'p' => 'normal'],
                ['title' => 'Xây dựng danh mục chuyên đề', 'due' => 20, 'w' => 5, 'p' => 'normal'],
                ['title' => 'Tổ chức chuyên đề cấp trường', 'due' => 90, 'w' => 10, 'p' => 'high'],
                ['title' => 'Dự giờ, góp ý tiết dạy', 'due' => 120, 'w' => 10, 'p' => 'normal'],
                ['title' => 'Đánh giá và báo cáo kết quả bồi dưỡng', 'due' => 150, 'w' => 6, 'p' => 'normal'],
            ],
        ],
        [
            'key' => 'facility', 'title' => 'Kế hoạch sửa chữa, mua sắm cơ sở vật chất', 'level' => 'project', 'category' => 'facility', 'duration_days' => 60,
            'desc' => 'Khảo sát, dự toán, duyệt chi, thực hiện và nghiệm thu.',
            'tasks' => [
                ['title' => 'Khảo sát hiện trạng, lập danh mục', 'due' => 7, 'w' => 5, 'p' => 'normal'],
                ['title' => 'Lập dự toán và trình duyệt chi', 'due' => 15, 'w' => 8, 'p' => 'high'],
                ['title' => 'Lựa chọn nhà cung cấp', 'due' => 25, 'w' => 6, 'p' => 'normal'],
                ['title' => 'Thực hiện sửa chữa / mua sắm', 'due' => 50, 'w' => 10, 'p' => 'high'],
                ['title' => 'Nghiệm thu, thanh quyết toán', 'due' => 60, 'w' => 6, 'p' => 'high'],
            ],
        ],
    ],

    // Liên kết nhanh tới các chức năng khác của cổng Ban Giám hiệu
    'link_targets' => [
        ['kind' => 'approval',  'label' => 'Phê duyệt',            'url' => '/bgh/approval'],
        ['kind' => 'exam',      'label' => 'Lịch thi & Kiểm tra',  'url' => '/bgh/exams'],
        ['kind' => 'timetable', 'label' => 'Thời khóa biểu',       'url' => '/bgh/timetable'],
        ['kind' => 'staff',     'label' => 'Nhân sự',              'url' => '/bgh/staff'],
        ['kind' => 'student',   'label' => 'Học sinh',             'url' => '/bgh/students'],
        ['kind' => 'class',     'label' => 'Lớp học',              'url' => '/bgh/classes'],
        ['kind' => 'attendance', 'label' => 'Chuyên cần',          'url' => '/bgh/attendance'],
        ['kind' => 'reward',    'label' => 'Khen thưởng',          'url' => '/bgh/rewards'],
        ['kind' => 'report',    'label' => 'Báo cáo thống kê',     'url' => '/bgh/reports'],
        ['kind' => 'notice',    'label' => 'Thông báo',            'url' => '/bgh/notices'],
    ],
];
