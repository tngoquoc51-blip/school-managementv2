export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'toggle' | 'color' | 'secret' | 'time';
export interface Field {
    key: string; label: string; type: FieldType; hint?: string; placeholder?: string;
    options?: { value: string; label: string }[]; suffix?: string; wide?: boolean;
}
export interface Section { title: string; desc?: string; icon: string; fields: Field[] }
export interface GroupDef { title: string; desc: string; sections: Section[] }

const yesNo = (key: string, label: string, hint?: string): Field => ({ key, label, type: 'toggle', hint });

export const GROUPS: Record<string, GroupDef> = {
    general: {
        title: 'Thông tin nhà trường',
        desc: 'Thông tin hiển thị trên báo cáo, phiếu thu, giấy tờ và trang đăng nhập.',
        sections: [
            { title: 'Hồ sơ trường', icon: 'school', fields: [
                    { key: 'school_name', label: 'Tên trường (đầy đủ)', type: 'text', wide: true, placeholder: 'Trường THPT ...' },
                    { key: 'school_short_name', label: 'Tên viết tắt', type: 'text' },
                    { key: 'school_code', label: 'Mã trường (Sở GD&ĐT)', type: 'text' },
                    { key: 'principal_name', label: 'Hiệu trưởng', type: 'text' },
                    { key: 'established_year', label: 'Năm thành lập', type: 'number' },
                    { key: 'tax_code', label: 'Mã số thuế', type: 'text' },
                ]},
            { title: 'Liên hệ', icon: 'phone', fields: [
                    { key: 'address', label: 'Địa chỉ', type: 'text', wide: true },
                    { key: 'phone', label: 'Điện thoại', type: 'text' },
                    { key: 'email', label: 'Email trường', type: 'text' },
                    { key: 'website', label: 'Website', type: 'text', placeholder: 'https://' },
                ]},
            { title: 'Khu vực & định dạng', icon: 'globe', fields: [
                    { key: 'timezone', label: 'Múi giờ', type: 'select', options: [
                            { value: 'Asia/Ho_Chi_Minh', label: '(UTC+7) Hồ Chí Minh / Hà Nội' }, { value: 'UTC', label: 'UTC' }] },
                    { key: 'date_format', label: 'Định dạng ngày', type: 'select', options: [
                            { value: 'd/m/Y', label: '31/12/2026' }, { value: 'd-m-Y', label: '31-12-2026' }, { value: 'Y-m-d', label: '2026-12-31' }] },
                ]},
        ],
    },
    appearance: {
        title: 'Giao diện & thương hiệu',
        desc: 'Màu sắc, logo và lời chào áp dụng cho toàn hệ thống.',
        sections: [
            { title: 'Màu sắc chủ đạo', icon: 'palette', fields: [
                    { key: 'primary_color', label: 'Màu chính', type: 'color', hint: 'Nút bấm, liên kết, mục đang chọn' },
                    { key: 'accent_color', label: 'Màu nhấn', type: 'color', hint: 'Biểu đồ, huy hiệu, điểm nhấn' },
                    { key: 'theme_mode', label: 'Chế độ hiển thị', type: 'select', options: [
                            { value: 'light', label: 'Sáng' }, { value: 'dark', label: 'Tối' }, { value: 'auto', label: 'Theo thiết bị' }] },
                    yesNo('compact_mode', 'Chế độ gọn', 'Giảm khoảng cách, hiển thị nhiều dòng hơn trong bảng'),
                ]},
            { title: 'Nhận diện', icon: 'image', fields: [
                    { key: 'logo_url', label: 'Đường dẫn logo', type: 'text', wide: true, placeholder: '/storage/logo.png hoặc https://...' },
                    { key: 'favicon_url', label: 'Đường dẫn favicon', type: 'text', wide: true },
                    { key: 'login_banner_text', label: 'Tiêu đề trang đăng nhập', type: 'text', wide: true },
                    { key: 'footer_text', label: 'Chân trang', type: 'text', wide: true },
                ]},
        ],
    },
    security: {
        title: 'Bảo mật & mật khẩu',
        desc: 'Chính sách mật khẩu, khóa tài khoản, thời hạn phiên và giới hạn truy cập quản trị.',
        sections: [
            { title: 'Chính sách mật khẩu', icon: 'key', fields: [
                    { key: 'min_password_length', label: 'Độ dài tối thiểu', type: 'number', suffix: 'ký tự' },
                    { key: 'password_expire_days', label: 'Hết hạn mật khẩu', type: 'number', suffix: 'ngày', hint: '0 = không hết hạn' },
                    yesNo('require_uppercase', 'Yêu cầu chữ hoa'),
                    yesNo('require_number', 'Yêu cầu chữ số'),
                    yesNo('require_special', 'Yêu cầu ký tự đặc biệt'),
                    yesNo('force_change_first_login', 'Bắt đổi mật khẩu lần đầu', 'Áp dụng cho tài khoản học sinh / giáo viên mới'),
                ]},
            { title: 'Khóa đăng nhập & phiên', icon: 'lock', fields: [
                    { key: 'max_login_attempts', label: 'Số lần sai tối đa', type: 'number', suffix: 'lần' },
                    { key: 'lockout_minutes', label: 'Thời gian khóa', type: 'number', suffix: 'phút' },
                    { key: 'session_timeout_minutes', label: 'Thời hạn phiên đăng nhập', type: 'number', suffix: 'phút', hint: 'Áp dụng cho lần đăng nhập mới' },
                ]},
            { title: 'Giới hạn truy cập quản trị', icon: 'shield', fields: [
                    { key: 'admin_ip_whitelist', label: 'Danh sách IP được vào khu Cài đặt', type: 'textarea', wide: true,
                        placeholder: '192.168.1.10, 113.160.x.x', hint: 'Để trống = cho phép mọi IP. localhost luôn được phép. Cách nhau bằng dấu phẩy hoặc xuống dòng.' },
                ]},
        ],
    },
    mail: {
        title: 'Email (SMTP)',
        desc: 'Máy chủ gửi thư cho thông báo, quên mật khẩu, phiếu thu. Mật khẩu được mã hóa trong CSDL.',
        sections: [
            { title: 'Máy chủ gửi thư', icon: 'mail', fields: [
                    yesNo('mail_enabled', 'Bật gửi email', 'Tắt = hệ thống không gửi bất kỳ email nào'),
                    { key: 'smtp_host', label: 'SMTP host', type: 'text', placeholder: 'smtp.gmail.com' },
                    { key: 'smtp_port', label: 'Cổng', type: 'number' },
                    { key: 'smtp_encryption', label: 'Mã hóa', type: 'select', options: [
                            { value: 'tls', label: 'TLS (587)' }, { value: 'ssl', label: 'SSL (465)' }, { value: 'none', label: 'Không' }] },
                    { key: 'smtp_username', label: 'Tài khoản', type: 'text' },
                    { key: 'smtp_password', label: 'Mật khẩu / App password', type: 'secret' },
                ]},
            { title: 'Người gửi', icon: 'user', fields: [
                    { key: 'from_address', label: 'Email người gửi', type: 'text' },
                    { key: 'from_name', label: 'Tên hiển thị', type: 'text' },
                ]},
        ],
    },
    notification: {
        title: 'Thông báo',
        desc: 'Chọn sự kiện nào gửi thông báo và gửi qua kênh nào.',
        sections: [
            { title: 'Sự kiện', icon: 'bell', fields: [
                    yesNo('notify_new_account', 'Tạo tài khoản mới', 'Gửi thông tin đăng nhập cho người dùng'),
                    yesNo('notify_grade_published', 'Công bố điểm', 'Báo cho học sinh & phụ huynh'),
                    yesNo('notify_absence_parent', 'Học sinh vắng mặt', 'Báo cho phụ huynh trong ngày'),
                    yesNo('notify_fee_due', 'Nhắc học phí đến hạn'),
                ]},
            { title: 'Kênh gửi', icon: 'send', fields: [
                    yesNo('channel_inapp', 'Trong hệ thống (chuông thông báo)'),
                    yesNo('channel_email', 'Email', 'Cần bật & cấu hình mục Email'),
                    yesNo('channel_sms', 'Tin nhắn SMS'),
                    { key: 'sms_provider', label: 'Nhà cung cấp SMS', type: 'select', options: [
                            { value: 'none', label: 'Chưa chọn' }, { value: 'esms', label: 'eSMS.vn' }, { value: 'speedsms', label: 'SpeedSMS' }, { value: 'twilio', label: 'Twilio' }] },
                    { key: 'sms_api_key', label: 'API key SMS', type: 'secret' },
                    { key: 'digest_hour', label: 'Giờ gửi tổng hợp hằng ngày', type: 'number', suffix: 'giờ (0–23)' },
                ]},
        ],
    },
    academic: {
        title: 'Quy chế học vụ',
        desc: 'Thang điểm, ngưỡng xếp loại và các quy định áp dụng cho điểm danh, nhập điểm, xếp lớp.',
        sections: [
            { title: 'Thang điểm & xếp loại', icon: 'award', fields: [
                    { key: 'grade_scale', label: 'Thang điểm', type: 'select', options: [{ value: '10', label: 'Thang 10' }, { value: '100', label: 'Thang 100' }] },
                    { key: 'score_decimals', label: 'Số chữ số thập phân', type: 'number' },
                    { key: 'pass_score', label: 'Điểm Đạt (Trung bình) từ', type: 'number' },
                    { key: 'good_score', label: 'Điểm Khá từ', type: 'number' },
                    { key: 'excellent_score', label: 'Điểm Giỏi từ', type: 'number' },
                ]},
            { title: 'Quy định vận hành', icon: 'clipboard', fields: [
                    { key: 'max_absent_percent', label: 'Tỷ lệ vắng tối đa', type: 'number', suffix: '%', hint: 'Vượt ngưỡng sẽ có cảnh báo học vụ' },
                    { key: 'grade_lock_days', label: 'Khóa sửa điểm sau', type: 'number', suffix: 'ngày' },
                    { key: 'periods_per_day', label: 'Số tiết / ngày', type: 'number' },
                    { key: 'lesson_minutes', label: 'Thời lượng 1 tiết', type: 'number', suffix: 'phút' },
                    { key: 'class_max_students', label: 'Sĩ số tối đa / lớp', type: 'number' },
                ]},
        ],
    },
    audit: {
        title: 'Chính sách nhật ký',
        desc: 'Thời gian lưu và quyền riêng tư của nhật ký hệ thống.',
        sections: [
            { title: 'Lưu trữ & xuất dữ liệu', icon: 'file', fields: [
                    { key: 'retention_days', label: 'Thời gian lưu nhật ký', type: 'number', suffix: 'ngày' },
                    { key: 'export_max_rows', label: 'Số dòng tối đa khi xuất CSV', type: 'number' },
                    yesNo('mask_ip', 'Che một phần địa chỉ IP', 'Hiển thị 113.160.*.* thay vì IP đầy đủ'),
                ]},
        ],
    },
};

export interface NavItem { id: string; label: string; icon: string; desc: string; badge?: string }
export interface NavGroup { title: string; items: NavItem[] }

export const NAV: NavGroup[] = [
    { title: 'Tổng quan', items: [
            { id: 'overview', label: 'Bảng điều khiển', icon: 'dashboard', desc: 'Sức khỏe & thống kê hệ thống' },
        ]},
    { title: 'Nhà trường', items: [
            { id: 'general', label: 'Thông tin trường', icon: 'school', desc: 'Hồ sơ, liên hệ, múi giờ' },
            { id: 'appearance', label: 'Giao diện & thương hiệu', icon: 'palette', desc: 'Màu sắc, logo, chân trang' },
            { id: 'years', label: 'Năm học & học kỳ', icon: 'calendar', desc: 'Quản lý niên khóa' },
            { id: 'academic', label: 'Quy chế học vụ', icon: 'award', desc: 'Thang điểm, ngưỡng xếp loại' },
        ]},
    { title: 'Bảo mật & truy cập', items: [
            { id: 'security', label: 'Bảo mật & mật khẩu', icon: 'shield', desc: 'Chính sách, khóa đăng nhập' },
            { id: 'sessions', label: 'Phiên đăng nhập', icon: 'monitor', desc: 'Thu hồi token đang hoạt động' },
            { id: 'audit', label: 'Nhật ký hệ thống', icon: 'file', desc: 'Kiểm toán mọi thao tác' },
        ]},
    { title: 'Vận hành', items: [
            { id: 'mail', label: 'Email (SMTP)', icon: 'mail', desc: 'Máy chủ gửi thư' },
            { id: 'notification', label: 'Thông báo', icon: 'bell', desc: 'Sự kiện & kênh gửi' },
            { id: 'backup', label: 'Sao lưu & phục hồi', icon: 'database', desc: 'Bản sao lưu, lịch tự động' },
            { id: 'maintenance', label: 'Bảo trì hệ thống', icon: 'wrench', desc: 'Chế độ bảo trì, xóa cache' },
        ]},
];