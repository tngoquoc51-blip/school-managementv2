/* =====================================================================
   NỘI DUNG TRANG "LIÊN HỆ": toàn bộ lời văn nằm ở file này.
   Muốn sửa chữ trên trang, chỉ sửa tại đây, không đụng vào file giao diện.
   Địa chỉ, điện thoại, email, giờ làm việc lấy từ data/school.ts (SCHOOL).
   Chỗ nào có [ngoặc vuông] là nhà trường cần điền thông tin thật.
   ===================================================================== */

/** Ảnh nền đầu trang: bỏ vào frontend/public/images/, ngang 1920×800. */
export const LH_IMG = { hero: '/images/hero-lien-he.jpg' };

/** Dán địa chỉ nhúng Google Maps vào đây (Google Maps > Chia sẻ > Nhúng bản đồ > chép phần src="..."). Để trống thì hiện khung chờ. */
export const LH_MAP_EMBED = '';
/** Đường dẫn mở Google Maps khi bấm "Chỉ đường". Để trống thì ẩn nút. */
export const LH_MAP_LINK = '';

export const LH_HERO = {
    eyebrow: 'Liên hệ nhà trường',
    title: 'Chúng tôi luôn sẵn sàng lắng nghe',
    intro: 'Phụ huynh và học sinh có thể gọi điện, gửi tin nhắn hoặc đến trực tiếp văn phòng nhà trường. Mọi tin nhắn đều được trả lời trong vòng một ngày làm việc.',
};

export const LH_CHANNELS = {
    phone: { title: 'Gọi điện', hint: 'Trong giờ làm việc' },
    mail: { title: 'Gửi email', hint: 'Trả lời trong 1 ngày làm việc' },
    address: { title: 'Đến trường', hint: 'Văn phòng ở khu nhà hiệu bộ' },
    hours: { title: 'Giờ làm việc', hint: 'Nghỉ thứ Bảy, Chủ nhật và ngày lễ' },
};

export const LH_FORM = {
    title: 'Gửi tin nhắn cho nhà trường',
    desc: 'Điền thông tin bên dưới. Bạn chỉ cần để lại số điện thoại hoặc email, một trong hai, để nhà trường trả lời.',
    topics: ['Tuyển sinh', 'Học phí', 'Học tập', 'Cổng thông tin', 'Khác'],
    placeholders: {
        full_name: 'Ví dụ: Nguyễn Văn An',
        phone: '09xx xxx xxx',
        email: 'ten@email.com',
        message: 'Bạn cần hỏi điều gì? Hãy mô tả càng rõ càng tốt, nhà trường sẽ trả lời chính xác hơn.',
    },
    privacy: 'Thông tin bạn gửi chỉ dùng để nhà trường liên hệ trả lời, không chia sẻ cho bên thứ ba.',
    ok: 'Nhà trường đã nhận được tin nhắn của bạn và sẽ trả lời trong vòng một ngày làm việc.',
};

/** Mỗi bộ phận phụ trách một nhóm việc. Điền số máy lẻ nếu trường có tổng đài. */
export const LH_DEPTS = {
    title: 'Bạn cần liên hệ bộ phận nào',
    desc: 'Chọn đúng bộ phận để được hỗ trợ nhanh hơn.',
    items: [
        { icon: 'user', name: 'Tuyển sinh', text: 'Hồ sơ nhập học, tổ hợp môn, lịch tham quan trường, tra cứu tiến độ hồ sơ.', ext: '[Số máy lẻ]', topic: 'Tuyển sinh' },
        { icon: 'book', name: 'Giáo vụ', text: 'Thời khóa biểu, điểm số, xác nhận học sinh, học bạ, chuyển trường.', ext: '[Số máy lẻ]', topic: 'Học tập' },
        { icon: 'monitor', name: 'Kế toán', text: 'Các khoản thu, phiếu thu, công nợ, miễn giảm học phí, hoàn tiền.', ext: '[Số máy lẻ]', topic: 'Học phí' },
        { icon: 'shield', name: 'Hỗ trợ cổng thông tin', text: 'Quên mật khẩu, không đăng nhập được, cập nhật thông tin tài khoản.', ext: '[Số máy lẻ]', topic: 'Cổng thông tin' },
    ],
};

export const LH_VISIT = {
    title: 'Đến trường như thế nào',
    desc: 'Thông tin giúp phụ huynh tìm đến trường và làm việc thuận lợi.',
    cards: [
        { icon: 'pin', title: 'Địa chỉ và đường đi', lines: ['Cổng chính của trường mở từ 6:45 sáng.', '[Điền tuyến đường, mốc dễ nhận biết gần trường]'] },
        { icon: 'spark', title: 'Phương tiện', lines: ['[Điền tuyến xe buýt đi qua trường]', '[Điền nơi gửi xe dành cho phụ huynh]'] },
        { icon: 'clock', title: 'Lịch tiếp phụ huynh', lines: ['Tiếp theo lịch hẹn vào giờ làm việc.', '[Điền buổi tiếp cố định trong tuần, nếu có]'] },
    ],
    steps: [
        'Vào cổng chính, xuất trình giấy tờ cho bảo vệ và nói rõ việc cần gặp.',
        'Đến văn phòng nhà trường, cán bộ sẽ hướng dẫn gặp đúng bộ phận.',
        'Phụ huynh nên gọi điện đặt lịch trước để không phải chờ đợi.',
    ],
};

export const LH_FAQ = {
    title: 'Câu hỏi thường gặp',
    items: [
        { q: 'Bao lâu thì nhà trường trả lời tin nhắn?', a: 'Nhà trường trả lời trong vòng một ngày làm việc. Tin gửi vào thứ Bảy, Chủ nhật hoặc ngày lễ sẽ được trả lời vào ngày làm việc kế tiếp.' },
        { q: 'Tôi quên mật khẩu cổng thông tin thì làm sao?', a: 'Bạn liên hệ giáo viên chủ nhiệm hoặc bộ phận hỗ trợ cổng thông tin để được cấp lại mật khẩu. Khi liên hệ hãy cung cấp họ tên, lớp và mã học sinh.' },
        { q: 'Xin giấy xác nhận học sinh ở đâu?', a: 'Phụ huynh liên hệ bộ phận Giáo vụ tại văn phòng nhà trường. Hãy mang theo giấy tờ tùy thân và cho biết mục đích sử dụng giấy xác nhận.' },
        { q: 'Tôi muốn hỏi về học phí và các khoản thu.', a: 'Bạn xem chi tiết từng khoản và hạn nộp trên cổng thông tin. Nếu cần hỏi thêm hoặc xin miễn giảm, hãy liên hệ bộ phận Kế toán.' },
        { q: 'Tôi muốn góp ý hoặc phản ánh về nhà trường.', a: 'Bạn chọn chủ đề "Khác" khi gửi tin nhắn và nêu rõ nội dung. Mọi góp ý đều được ghi nhận và chuyển đến người phụ trách để phản hồi.' },
    ],
};

export const LH_CTA = {
    title: 'Con bạn sắp vào lớp 10?',
    text: 'Đăng ký trực tuyến để nhận mã hồ sơ, nhà trường sẽ gọi lại tư vấn tổ hợp môn và hướng dẫn nộp hồ sơ.',
};