/* =====================================================================
   NỘI DUNG TRANG "TIN TỨC VÀ SỰ KIỆN": lời văn, nhãn và ảnh nằm ở file này.
   Danh sách bài viết lấy từ hệ thống (bảng sm_news), không viết ở đây.
   Muốn sửa chữ trên trang, chỉ sửa tại đây, không đụng vào file giao diện.
   ===================================================================== */

/** Ảnh nền đầu trang: bỏ vào frontend/public/images/, ngang 1920×800. Chưa có thì dùng hero-chung.jpg. */
export const TT_IMG = { hero: '/images/hero-tin-tuc.jpg' };

export const TT_HERO = {
    eyebrow: 'Tin tức và sự kiện',
    title: 'Mọi điều đang diễn ra ở trường',
    intro: 'Thông báo từ nhà trường, hoạt động của học sinh và những sự kiện sắp tới. Đây là nơi chính thức để phụ huynh và học sinh theo dõi tin tức của trường.',
};

/** Các nhóm lọc theo loại tin. Giá trị trống là "tất cả". */
export const TT_KINDS: [string, string][] = [['', 'Tất cả'], ['news', 'Tin tức'], ['event', 'Sự kiện']];

export const TT_TEXT = {
    searchPlaceholder: 'Tìm bài viết, thông báo, sự kiện',
    allCategories: 'Mọi chuyên mục',
    featured: 'Tin nổi bật',
    latest: 'Bài mới nhất',
    results: (n: number) => `${n} bài viết`,
    empty: 'Không có bài nào khớp với bộ lọc của bạn.',
    clear: 'Xóa bộ lọc',
    down: 'Chưa tải được tin tức. Máy chủ chưa phản hồi, vui lòng thử lại sau ít phút.',
    reload: 'Tải lại trang',
    prev: 'Trang trước',
    next: 'Trang sau',
    readMore: 'Đọc tiếp',
};

export const TT_ASIDE = {
    events: { title: 'Sự kiện sắp diễn ra', empty: 'Chưa có sự kiện nào được lên lịch.' },
    channels: {
        title: 'Kênh thông tin chính thức',
        text: 'Để không bỏ lỡ thông báo quan trọng, phụ huynh và học sinh nên theo dõi các kênh sau.',
        items: [
            { icon: 'monitor', title: 'Cổng thông tin', text: 'Thông báo riêng cho từng lớp, điểm số và học phí.', href: '/he-thong' },
            { icon: 'search', title: 'Tra cứu hồ sơ tuyển sinh', text: 'Biết ngay hồ sơ của con đã được xử lý tới đâu.', href: '/tuyen-sinh/tra-cuu' },
            { icon: 'mail', title: 'Liên hệ văn phòng', text: 'Gửi câu hỏi, nhà trường trả lời trong một ngày làm việc.', href: '/lien-he' },
        ],
    },
    note: 'Nhà trường chỉ đăng thông báo chính thức trên website và cổng thông tin. Phụ huynh cảnh giác với tin nhắn, đường dẫn lạ yêu cầu chuyển tiền hoặc cung cấp mật khẩu.',
};

export const TT_POST = {
    back: 'Tất cả tin tức',
    views: 'lượt xem',
    read: 'phút đọc',
    event: 'Thông tin sự kiện',
    share: 'Chia sẻ bài viết',
    copy: 'Sao chép liên kết',
    copied: 'Đã sao chép',
    print: 'In bài viết',
    related: 'Có thể bạn quan tâm',
    notice: 'Cần hỏi thêm về nội dung này? Liên hệ văn phòng nhà trường trong giờ làm việc để được hỗ trợ.',
    down: { title: 'Chưa tải được bài viết', desc: 'Máy chủ tin tức tạm thời chưa phản hồi. Vui lòng tải lại trang sau ít phút.' },
};

export const TT_CTA = {
    title: 'Quý phụ huynh cần tư vấn trực tiếp?',
    text: 'Đội ngũ tư vấn của nhà trường luôn sẵn sàng giải đáp mọi thắc mắc về hồ sơ, tổ hợp môn và học phí.',
};