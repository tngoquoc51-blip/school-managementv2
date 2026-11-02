/* =====================================================================
   NỘI DUNG TRANG "TUYỂN SINH" VÀ "TRA CỨU HỒ SƠ": toàn bộ lời văn nằm ở file này.
   Muốn sửa chữ trên trang, chỉ sửa tại đây, không đụng vào file giao diện.
   Năm học tuyển sinh, điện thoại, giờ làm việc lấy từ data/school.ts (SCHOOL).
   Chỗ nào có [ngoặc vuông] là nhà trường cần điền thông tin thật theo thông báo của Sở GD&ĐT.
   ===================================================================== */

/** Ảnh: bỏ vào frontend/public/images/. Thiếu ảnh thì tự dùng hero-chung.jpg. */
export const TS_IMG = {
    hero: '/images/hero-tuyen-sinh.jpg',   // ngang 1920×800
    side: '/images/tuyen-sinh-1.jpg',      // ngang 1200×900, cạnh biểu mẫu
};

export const TS_HERO = {
    eyebrow: 'Tuyển sinh lớp 10',
    title: 'Bước vào ngôi trường của những người trẻ giàu khát vọng',
    intro: 'Đăng ký trực tuyến chỉ mất vài phút. Sau khi gửi, bạn nhận một mã hồ sơ để theo dõi tiến độ, và cán bộ tuyển sinh sẽ gọi điện tư vấn tổ hợp môn phù hợp với em.',
};

export const TS_FACTS = [
    { icon: 'user', title: 'Đối tượng', text: 'Học sinh tốt nghiệp trung học cơ sở, đủ điều kiện dự tuyển theo quy định của Sở GD&ĐT.' },
    { icon: 'book', title: 'Hình thức', text: 'Xét tuyển hoặc thi tuyển theo thông báo chính thức hằng năm của tỉnh.' },
    { icon: 'monitor', title: 'Đăng ký', text: 'Điền biểu mẫu trực tuyến ngay trên trang này, không cần đến trường.' },
    { icon: 'clock', title: 'Phản hồi', text: 'Nhà trường gọi lại trong vòng 1 đến 2 ngày làm việc.' },
];

export const TS_WHY = {
    title: 'Vì sao phụ huynh chọn trường',
    desc: 'Bốn điều mà gia đình thường quan tâm nhất khi chọn trường cho con.',
    items: [
        { icon: 'teacher', title: 'Thầy cô tận tâm', text: 'Giáo viên chủ nhiệm theo sát từng em, thường xuyên trao đổi với phụ huynh qua cổng thông tin.' },
        { icon: 'book', title: 'Chương trình rõ ràng', text: 'Theo Chương trình giáo dục phổ thông 2018, học sinh được hướng dẫn chọn môn theo năng lực và dự định nghề nghiệp.' },
        { icon: 'spark', title: 'Đời sống phong phú', text: 'Câu lạc bộ, hoạt động trải nghiệm và ngày hội của trường giúp các em tự tin, năng động.' },
        { icon: 'shield', title: 'Minh bạch, an toàn', text: 'Điểm số, học phí, thông báo đều xem được trên cổng thông tin. Môi trường học đường an toàn, văn minh.' },
    ],
};

export const TS_STEPS = {
    title: 'Quy trình bốn bước',
    desc: 'Từ lúc đăng ký đến ngày nhận lớp, mỗi bước đều có người hướng dẫn.',
    items: [
        { icon: 'monitor', title: 'Đăng ký trực tuyến', who: 'Phụ huynh', text: 'Điền biểu mẫu bên dưới. Hệ thống cấp một mã hồ sơ để bạn tra cứu tiến độ.' },
        { icon: 'phone', title: 'Nhà trường tư vấn', who: 'Cán bộ tuyển sinh', text: 'Cán bộ tuyển sinh gọi điện, tư vấn tổ hợp môn và hẹn lịch nộp hồ sơ.' },
        { icon: 'book', title: 'Nộp hồ sơ bản giấy', who: 'Phụ huynh', text: 'Mang hồ sơ đến trường theo lịch hẹn để được kiểm tra và xác nhận.' },
        { icon: 'check', title: 'Nhập học', who: 'Nhà trường', text: 'Nhận lớp, hoàn tất các khoản thu và nhận tài khoản vào cổng thông tin.' },
    ],
};

export const TS_DOCS = {
    title: 'Hồ sơ cần chuẩn bị',
    desc: 'Chuẩn bị sẵn để buổi nộp hồ sơ diễn ra nhanh gọn. Bản sao cần có công chứng hoặc mang theo bản chính để đối chiếu.',
    must: {
        title: 'Hồ sơ bắt buộc',
        items: [
            'Phiếu đăng ký dự tuyển (nhà trường cung cấp khi nộp hồ sơ)',
            'Bản sao giấy khai sinh',
            'Học bạ trung học cơ sở (bản chính)',
            'Giấy chứng nhận tốt nghiệp trung học cơ sở tạm thời hoặc bằng tốt nghiệp',
            '04 ảnh thẻ kích thước 3×4 (chụp trong vòng 6 tháng gần nhất)',
            'Sổ hộ khẩu hoặc giấy xác nhận thông tin cư trú (bản sao)',
        ],
    },
    extra: {
        title: 'Giấy tờ ưu tiên, khuyến khích (nếu có)',
        items: [
            'Giấy xác nhận đối tượng ưu tiên theo quy định',
            'Chứng chỉ ngoại ngữ (ví dụ IELTS)',
            'Giấy chứng nhận học sinh giỏi cấp tỉnh hoặc quốc gia',
            'Giấy chứng nhận giải thưởng văn nghệ, thể thao',
        ],
    },
    note: 'Danh sách có thể thay đổi theo hướng dẫn của Sở GD&ĐT mỗi năm. Khi có khác biệt, nhà trường sẽ báo khi tư vấn qua điện thoại.',
};

/* MẪU: thay bằng lịch tuyển sinh thật khi có thông báo của Sở */
export const TS_DATES = {
    title: 'Các mốc thời gian',
    desc: 'Nhà trường sẽ cập nhật ngày cụ thể ngay khi có thông báo chính thức.',
    items: [
        { when: '[Ngày/tháng]', title: 'Mở đăng ký trực tuyến', text: 'Phụ huynh điền biểu mẫu và nhận mã hồ sơ.' },
        { when: '[Ngày/tháng]', title: 'Nhận hồ sơ bản giấy', text: 'Nộp tại văn phòng nhà trường theo lịch hẹn.' },
        { when: '[Ngày/tháng]', title: 'Xét tuyển hoặc thi tuyển', text: 'Theo hướng dẫn của Sở GD&ĐT.' },
        { when: '[Ngày/tháng]', title: 'Công bố kết quả', text: 'Đăng trên website và gửi thông báo qua điện thoại.' },
        { when: '[Ngày/tháng]', title: 'Nhập học, nhận lớp', text: 'Hoàn tất các khoản thu, nhận tài khoản cổng thông tin.' },
    ],
};

export const TS_TRACKS = {
    title: 'Hai hướng học bạn có thể chọn',
    desc: 'Ở lớp 10, em chưa phải quyết định ngay. Nhà trường tổ chức tư vấn chọn môn trước khi xếp lớp. Các tổ hợp dưới đây chỉ để tham khảo.',
    items: [
        { icon: 'flask', name: 'Khoa học tự nhiên', text: 'Phù hợp với em yêu thích Toán, Lý, Hóa, Sinh, Tin học; định hướng kỹ thuật, công nghệ, y dược, kinh tế.', tags: ['Toán', 'Vật lí', 'Hóa học', 'Sinh học', 'Tin học'] },
        { icon: 'book', name: 'Khoa học xã hội', text: 'Phù hợp với em yêu thích Văn, Sử, Địa, Giáo dục kinh tế và pháp luật; định hướng báo chí, luật, sư phạm, du lịch.', tags: ['Ngữ văn', 'Lịch sử', 'Địa lí', 'GD KT&PL', 'Ngoại ngữ'] },
    ],
    link: 'Xem chương trình đào tạo',
};

export const TS_FORM = {
    eyebrow: 'Đăng ký trực tuyến',
    title: 'Đăng ký nhập học trực tuyến',
    desc: 'Điền thông tin của học sinh và phụ huynh. Các ô có dấu * là bắt buộc.',
    side: {
        title: 'Trước khi điền, bạn nên biết',
        points: [
            'Thông tin chỉ dùng để tư vấn tuyển sinh, nhà trường không chia sẻ cho bên thứ ba.',
            'Mỗi em chỉ cần đăng ký một lần. Gửi lặp lại, hệ thống sẽ trả lại mã hồ sơ cũ.',
            'Đăng ký trực tuyến không thay thế hồ sơ bản giấy. Bạn vẫn cần nộp hồ sơ để hoàn tất tuyển sinh.',
            'Mỗi mạng được gửi tối đa 5 lần trong một giờ.',
        ],
    },
    consent: 'Tôi xác nhận thông tin khai là đúng và đồng ý để nhà trường liên hệ tư vấn.',
    consentErr: 'Bạn cần xác nhận trước khi gửi.',
    tracks: ['Khoa học tự nhiên', 'Khoa học xã hội', 'Chưa xác định'],
    note: 'Đăng ký trực tuyến giúp nhà trường ghi nhận và tư vấn sớm. Bạn vẫn cần nộp hồ sơ bản giấy để hoàn tất tuyển sinh.',
};

export const TS_DONE = {
    title: 'Đã nhận đăng ký của bạn',
    dupTitle: 'Hồ sơ này đã được ghi nhận',
    codeLabel: 'Mã hồ sơ của bạn',
    keep: 'Hãy lưu mã này cùng số điện thoại để tra cứu tiến độ. Cán bộ tuyển sinh sẽ gọi cho bạn trong giờ làm việc.',
    next: ['Chụp màn hình hoặc sao chép mã hồ sơ.', 'Chờ cuộc gọi tư vấn của nhà trường.', 'Chuẩn bị hồ sơ bản giấy theo danh sách ở trên.'],
};

export const TS_LOOKUP_CTA = {
    title: 'Đã đăng ký rồi?',
    text: 'Xem hồ sơ của em đang ở bước nào chỉ với mã hồ sơ và số điện thoại đã khai.',
    btn: 'Tra cứu hồ sơ',
};

export const TS_FAQ = {
    title: 'Câu hỏi thường gặp về tuyển sinh',
    items: [
        { q: 'Khi nào nhà trường nhận hồ sơ tuyển sinh?', a: 'Thời gian cụ thể được công bố trên website và thông báo của nhà trường theo kế hoạch của Sở GD&ĐT. Bạn có thể đăng ký trực tuyến trước để nhà trường liên hệ và nhắc lịch.' },
        { q: 'Đăng ký trực tuyến có thay thế hồ sơ bản giấy không?', a: 'Không. Đăng ký trực tuyến giúp nhà trường ghi nhận và tư vấn sớm. Bạn vẫn cần nộp hồ sơ bản giấy theo hướng dẫn để hoàn tất tuyển sinh.' },
        { q: 'Tôi quên mã hồ sơ thì làm thế nào?', a: 'Hãy gọi điện đến nhà trường trong giờ làm việc, đọc họ tên học sinh, ngày sinh và số điện thoại đã khai. Cán bộ tuyển sinh sẽ giúp bạn tìm lại mã.' },
        { q: 'Tôi điền sai thông tin thì sửa ở đâu?', a: 'Bạn báo cho cán bộ tuyển sinh khi nhận cuộc gọi tư vấn, hoặc gọi điện đến nhà trường. Thông tin sẽ được chỉnh lại ngay trên hệ thống.' },
        { q: 'Làm sao biết hồ sơ của tôi đã được xử lý?', a: 'Dùng mã hồ sơ và số điện thoại đã khai ở trang Tra cứu hồ sơ. Trạng thái cập nhật khi cán bộ tuyển sinh liên hệ với bạn.' },
        { q: 'Em chưa biết chọn tổ hợp môn nào thì sao?', a: 'Bạn cứ chọn "Chưa xác định". Nhà trường sẽ tư vấn dựa trên học lực và nguyện vọng của em, và còn có buổi tư vấn chọn môn trước khi xếp lớp.' },
        { q: 'Học phí và các khoản thu được quy định như thế nào?', a: 'Học phí và các khoản thu theo quy định hiện hành, được thông báo công khai khi nhập học. Phụ huynh xem từng khoản và đóng tiền trên cổng thông tin.' },
        { q: 'Sau khi nhập học, học sinh xem điểm ở đâu?', a: 'Nhà trường cấp tài khoản để học sinh đăng nhập cổng thông tin, xem điểm, thời khóa biểu, học phí và thông báo.' },
        { q: 'Có được tham quan trường trước khi quyết định không?', a: 'Có. Phụ huynh và học sinh có thể đến văn phòng trong giờ làm việc để được hướng dẫn tham quan. Bạn nên gọi điện báo trước để nhà trường bố trí người đón.' },
    ],
};

export const TS_CTA = {
    title: 'Cần hỏi thêm trước khi đăng ký?',
    text: 'Gọi điện hoặc gửi tin nhắn, cán bộ tuyển sinh sẽ giải đáp trong giờ làm việc.',
};

/* ---------- Trang tra cứu hồ sơ ---------- */
export const TL_HERO = {
    eyebrow: 'Tra cứu hồ sơ',
    title: 'Hồ sơ của em đang ở bước nào?',
    intro: 'Nhập mã hồ sơ nhận được khi đăng ký và số điện thoại phụ huynh đã khai. Kết quả hiện ngay, không cần đăng nhập.',
};

export const TL_FORM = {
    title: 'Nhập thông tin tra cứu',
    code: { label: 'Mã hồ sơ', hint: 'Ví dụ: TS26-AB3CD. Chữ hoa hay thường đều được.' },
    phone: { label: 'Số điện thoại đã khai', hint: 'Số phụ huynh đã nhập lúc đăng ký.' },
    btn: 'Tra cứu',
    busy: 'Đang tra cứu…',
    empty: 'Nhập mã hồ sơ và số điện thoại.',
};

export const TL_HELP = {
    title: 'Không tra cứu được?',
    items: [
        'Kiểm tra lại mã hồ sơ: chữ O và số 0, chữ I và số 1 dễ bị nhầm.',
        'Số điện thoại phải đúng số đã khai lúc đăng ký.',
        'Hồ sơ vừa gửi có thể mất vài giây để cập nhật, bạn thử lại sau.',
        'Quên mã? Gọi điện cho nhà trường trong giờ làm việc để được tìm lại.',
    ],
};