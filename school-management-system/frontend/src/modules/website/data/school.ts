/* ===================================================================
   NỘI DUNG VÀ KỊCH BẢN CHUẨN - TRƯỜNG THPT NGÔ SĨ LIÊN
   Kịch bản giới thiệu trường toàn diện, phong cách Landing Page cao cấp:
   Đầy đủ lịch sử, sứ mệnh, giá trị cốt lõi, chương trình đào tạo, 
   cơ sở vật chất, đội ngũ, thành tích, đánh giá phụ huynh và tuyển sinh.
   =================================================================== */

export const SCHOOL = {
    name: 'THPT Ngô Sĩ Liên',
    fullName: 'Trường Trung học Phổ thông Ngô Sĩ Liên',
    slogan: 'Nơi ươm mầm tài năng — Vững tri thức, sáng tương lai.',
    subSlogan: 'Môi trường giáo dục toàn diện, khơi nguồn sáng tạo và chắp cánh ước mơ cho các thế hệ học sinh.',
    intro: 'Trường THPT Ngô Sĩ Liên tự hào là chiếc nôi đào tạo nhiều thế hệ học sinh tài năng, bản lĩnh và giàu lòng nhân ái. Với cơ sở vật chất hiện đại, đội ngũ giáo viên tâm huyết cùng chương trình GDPT 2018 tiên tiến, nhà trường cam kết đồng hành cùng học sinh bước vào cánh cổng các trường Đại học danh tiếng và tự tin hội nhập toàn cầu.',
    schoolYear: '2026 – 2027',
    admissionYear: '2026 – 2027',
    address: 'Số 48 Đường Ngô Sĩ Liên, Phường Ngô Quyền, Thành phố Bắc Giang',
    addressShort: '48 Ngô Sĩ Liên, TP. Bắc Giang',
    phone: '0204 3854 624',
    hotline: '0988 123 456',
    email: 'tuyensinh@thptngosylien.edu.vn',
    supportEmail: 'c3ngosylien@bacgiang.edu.vn',
    website: 'https://thptngosylien.edu.vn',
    hours: 'Thứ Hai – Thứ Bảy: 7:00 – 17:30',
    founded: '1946',
    yearsOfTradition: '78',
    facebook: 'https://facebook.com/thptngosylien',
    youtube: 'https://youtube.com/@thptngosylien',
    zalo: 'https://zalo.me/thptngosylien',
};

export const NAV = [
    { href: '/', label: 'Trang chủ' },
    { href: '/gioi-thieu', label: 'Về nhà trường' },
    { href: '/chuong-trinh', label: 'Chương trình đào tạo' },
    { href: '/doi-song', label: 'Đời sống học đường' },
    { href: '/tin-tuc', label: 'Tin tức & Sự kiện' },
    { href: '/tuyen-sinh', label: 'Tuyển sinh' },
    { href: '/lien-he', label: 'Liên hệ' },
];

/* Dữ liệu số liệu thống kê thực tế ấn tượng */
export const FALLBACK_OVERVIEW = {
    school_year: SCHOOL.schoolYear,
    classes: 36,
    students: 1580,
    teachers: 85,
    subjects: 16,
    grades: [
        { grade: 10, classes: 12, students: 530 },
        { grade: 11, classes: 12, students: 525 },
        { grade: 12, classes: 12, students: 525 },
    ],
};

export const TRUST_STATS = [
    { num: '78+', label: 'Năm truyền thống hiếu học', sub: 'Thành lập từ năm 1946' },
    { num: '100%', label: 'Tốt nghiệp THPT Quốc gia', sub: 'Liên tục trong nhiều năm liền' },
    { num: '88.6%', label: 'Đỗ Đại học nguyện vọng 1', sub: 'Bách Khoa, Ngoại Thương, Y Hà Nội...' },
    { num: '120+', label: 'Giải HSG Tỉnh & Quốc gia', sub: 'Thành tích dẫn đầu phong trào' },
    { num: '25+', label: 'Câu lạc bộ tài năng & kỹ năng', sub: 'Phát triển toàn diện thế hệ trẻ' },
];

export const CLUB_COUNT = 25;

export const PILLARS = [
    {
        title: 'Tầm nhìn chiến lược',
        text: 'Xây dựng THPT Ngô Sĩ Liên thành trường trung học phổ thông trọng điểm chất lượng cao của tỉnh, tiếp cận chuẩn mực giáo dục quốc tế, nơi mỗi học sinh đều được đánh thức đam mê và phát huy tối đa tiềm năng bản thân.',
    },
    {
        title: 'Sứ mệnh giáo dục',
        text: 'Kiến tạo môi trường học tập hạnh phúc, kỷ cương, tình thương và trách nhiệm; cung cấp nền tảng tri thức vững chắc, kỹ năng thế kỷ 21 và tư duy độc lập để học sinh tự tin làm chủ tương lai.',
    },
    {
        title: '5 Giá trị cốt lõi',
        text: 'TRÍ TUỆ — NHÂN ÁI — BẢN LĨNH — SÁNG TẠO — HỘI NHẬP. Đây là kim chỉ nam cho mọi hoạt động giảng dạy, học tập và rèn luyện đạo đức tại nhà trường.',
    },
];

/* Giới thiệu chi tiết trang chủ */
export const ABOUT = {
    title: 'Một ngôi trường hạnh phúc — Nơi thắp sáng những ước mơ',
    badge: 'Trường Chuẩn Quốc Gia Mức Độ 2',
    paras: [
        'Trường THPT Ngô Sĩ Liên với bề dày hơn 70 năm xây dựng và trưởng thành, tự hào mang tên nhà sử học lỗi lạc thời Lê sơ. Ngôi trường đã đào tạo hàng vạn học sinh trở thành những nhà khoa học, nhà quản lý, bác sĩ, kỹ sư, doanh nhân thành đạt đóng góp tích cực cho công cuộc dựng xây đất nước.',
        'Bước vào kỷ nguyên số và thực hiện Chương trình GDPT 2018, nhà trường không ngừng đổi mới phương pháp giáo dục: Chuyển từ truyền thụ kiến thức một chiều sang phát triển toàn diện năng lực, kỹ năng thực chiến và tư duy phản biện cho học sinh.',
        'Mỗi lớp học tại Ngô Sĩ Liên là một gia đình nhỏ, nơi thầy cô chủ nhiệm đồng hành sát sao suốt ba năm học. Hệ thống số hóa hiện đại giúp phụ huynh nắm bắt từng điểm số, sự chuyên cần và quá trình trưởng thành của con từng ngày.',
    ],
    bullets: [
        'Chương trình Giáo dục phổ thông 2018 phân hóa chuyên sâu theo năng lực từng học sinh',
        '100% phòng học trang bị máy chiếu thông minh, điều hòa và hệ thống âm thanh giảng dạy hiện đại',
        'Đội ngũ 100% giáo viên đạt chuẩn, hơn 35% có trình độ Thạc sĩ, nhiều Giáo viên dạy giỏi cấp Tỉnh',
        'Cổng thông tin trực tuyến minh bạch điểm số, thời khóa biểu, công nợ học phí trên smartphone',
        'Hơn 25 câu lạc bộ học thuật, nghệ thuật, thể thao và dự án cộng đồng hoạt động sôi nổi',
    ],
};

/* 6 Điểm khác biệt / Lý do phụ huynh chọn trường (Sales Points) */
export const WHY = [
    {
        icon: 'book',
        title: 'Chương trình GDPT 2018 định hướng tương lai',
        text: 'Thiết kế các tổ hợp môn Khoa học Tự nhiên và Khoa học Xã hội chuyên sâu, gắn liền với định hướng nghề nghiệp và phương thức xét tuyển của các trường Đại học danh tiếng.',
    },
    {
        icon: 'teacher',
        title: 'Đội ngũ nhà giáo tâm huyết & tài năng',
        text: 'Thầy cô là những chuyên gia sư phạm giàu kinh nghiệm, đạt nhiều danh hiệu Giáo viên dạy giỏi cấp Quốc gia, luôn sẵn lòng kèm cặp, hỗ trợ học sinh vượt qua mọi thử thách.',
    },
    {
        icon: 'monitor',
        title: 'Cơ sở vật chất 5 sao chuẩn Quốc tế',
        text: 'Khuôn viên xanh mát 18.000m², 42 phòng học chuẩn hóa, thư viện điện tử 15.000 đầu sách, phòng Lab thực hành STEM hiện đại và sân thể thao đa năng cỏ nhân tạo.',
    },
    {
        icon: 'spark',
        title: '25+ CLB ngoại khóa rèn luyện kỹ năng',
        text: 'Từ CLB Tranh biện, Tiếng Anh chuẩn IELTS, Lập trình Robotics đến CLB Guitar, Bóng rổ... giúp học sinh phát triển bản lĩnh tự tin, kỹ năng lãnh đạo và tinh thần làm việc nhóm.',
    },
    {
        icon: 'mobile',
        title: 'Chuyển đổi số 4.0 toàn diện & minh bạch',
        text: 'Phụ huynh và học sinh theo dõi kết quả học tập, chuyên cần, thực đơn bán trú và thanh toán học phí không dùng tiền mặt an toàn, tiện lợi chỉ với một chạm trên điện thoại.',
    },
    {
        icon: 'award',
        title: 'Cam kết chuẩn đầu ra & Học bổng giá trị',
        text: 'Tỉ lệ đỗ Đại học nguyện vọng 1 luôn trong Top đầu toàn tỉnh. Quỹ học bổng Ngô Sĩ Liên vinh danh thủ khoa và hỗ trợ các em học sinh có hoàn cảnh khó khăn vươn lên học giỏi.',
    },
];

/* Các chương trình đào tạo chính */
export const PROGRAMS = [
    {
        key: 'tn',
        title: 'Khoa học Tự nhiên & Công nghệ (STEM)',
        tone: 'a',
        badge: 'Được lựa chọn nhiều nhất',
        text: 'Dành cho học sinh có thế mạnh tư duy logic, đam mê công nghệ, kỹ thuật, y khoa và tài chính ngân hàng.',
        subjects: ['Toán nâng cao', 'Vật lí chuyên sâu', 'Hóa học ứng dụng', 'Sinh học phân tử', 'Tin học & AI'],
        careers: ['Khoa học máy tính & Trí tuệ nhân tạo (AI)', 'Kỹ thuật điều khiển & Tự động hóa', 'Y - Dược học & Công nghệ sinh học', 'Tài chính - Ngân hàng - Phân tích dữ liệu', 'Kiến trúc & Kỹ thuật xây dựng công trình'],
        highlight: 'Thực hành thí nghiệm 4 tiết/tuần tại phòng Lab chuẩn Quốc gia, tham gia các cuộc thi Sáng tạo KHKT cấp Tỉnh.',
    },
    {
        key: 'xh',
        title: 'Khoa học Xã hội, Luật & Truyền thông',
        tone: 'b',
        badge: 'Phát triển tư duy ngôn ngữ',
        text: 'Dành cho học sinh có năng khiếu ngôn ngữ, tư duy phản biện, đam mê nghiên cứu văn hóa, báo chí, luật và quan hệ quốc tế.',
        subjects: ['Ngữ văn chuyên sâu', 'Lịch sử văn minh', 'Địa lí kinh tế - xã hội', 'Giáo dục Kinh tế & Pháp luật', 'Ngoại ngữ tăng cường'],
        careers: ['Luật sư & Tư vấn pháp lý', 'Báo chí, Truyền thông đa phương tiện & PR', 'Quan hệ Quốc tế & Ngoại giao', 'Quản trị kinh doanh & Marketing số', 'Sư phạm & Ngôn ngữ học quốc tế'],
        highlight: 'Tham gia các diễn đàn tranh biện, phiên tòa giả định, câu lạc bộ phóng viên trẻ và các dự án văn hóa di sản.',
    },
    {
        key: 'qt',
        title: 'Lớp Tăng cường Tiếng Anh & Chuẩn IELTS',
        tone: 'c',
        badge: 'Chuẩn hội nhập quốc tế',
        text: 'Chương trình hợp tác tăng cường ngoại ngữ với giáo viên bản ngữ, cam kết đạt chứng chỉ IELTS 6.5+ trước khi tốt nghiệp THPT.',
        subjects: ['Tiếng Anh học thuật IELTS', 'Toán bằng Tiếng Anh', 'Kỹ năng thuyết trình & Tranh biện', 'Khoa học bằng Tiếng Anh'],
        careers: ['Tuyển thẳng các trường ĐH danh tiếng trong nước', 'Du học học bổng tại các trường ĐH Quốc tế', 'Các ngành kinh tế quốc tế và thương mại toàn cầu'],
        highlight: '100% học sinh được cọ xát với đề thi chuẩn Cambridge, xét tuyển thẳng Đại học bằng chứng chỉ IELTS quốc tế.',
    },
];

export const COMMON_SUBJECTS = [
    'Ngữ văn', 'Toán', 'Ngoại ngữ 1 (Tiếng Anh)', 'Giáo dục thể chất',
    'Giáo dục quốc phòng và an ninh', 'Hoạt động trải nghiệm, hướng nghiệp', 'Nội dung giáo dục địa phương'
];

export const EXPERIENCE = [
    { title: 'Dự án STEM & Nghiên cứu khoa học', text: 'Học sinh trực tiếp sáng chế mô hình, lập trình vi điều khiển, robotics và tham gia Hội thi KHKT các cấp với nhiều giải Nhất, Nhì.' },
    { title: 'Tư vấn hướng nghiệp chuyên sâu', text: 'Tổ tư vấn tâm lý và cựu học sinh thành đạt định kỳ chia sẻ kinh nghiệm chọn ngành, chọn trường Đại học phù hợp với tính cách và xu hướng tương lai.' },
    { title: 'Trại hè kỹ năng sống & Teambuilding', text: 'Rèn luyện kỹ năng sinh tồn, làm việc nhóm, quản lý thời gian, quản trị tài chính cá nhân và giải quyết vấn đề hiệu quả.' },
    { title: 'Hoạt động thiện nguyện & Vì cộng đồng', text: 'Các chương trình "Áo ấm mùa đông", "Mùa hè xanh", hiến máu nhân đạo giúp các em hình thành trái tim nhân hậu và trách nhiệm với xã hội.' },
];

export const ASSESSMENT = [
    ['Đánh giá thường xuyên', 'Kiểm tra vấn đáp, thuyết trình cá nhân, sản phẩm học tập và dự án nghiên cứu nhóm.'],
    ['Đánh giá định kỳ (Giữa kỳ & Cuối kỳ)', 'Bài thi chuẩn hóa kết hợp trắc nghiệm khách quan và tự luận tư duy bậc cao.'],
    ['Đánh giá năng lực chuyên sâu', 'Thi thử tốt nghiệp THPT và đánh giá năng lực theo cấu trúc đề ĐHQG, ĐH Bách Khoa định kỳ.'],
    ['Minh bạch trực tuyến', 'Điểm số và nhận xét chi tiết của giáo viên bộ môn được cập nhật tức thì trên Cổng thông tin phụ huynh.'],
];

/* Cơ sở vật chất */
export const FACILITIES: { title: string; text: string; icon: string; size?: 'lg' | 'wide'; image: string }[] = [
    { title: 'Phòng học thông minh 4.0', text: '42 phòng học chuẩn hóa với màn hình cảm ứng tương tác 75 inch, điều hòa hai chiều, ánh sáng chuẩn chống cận học đường.', icon: 'monitor', size: 'lg', image: '/images/co-so-1.jpg' },
    { title: 'Phòng thí nghiệm Lý - Hóa - Sinh', text: 'Trang thiết bị hiện đại đạt chuẩn Bộ GD&ĐT, cho phép học sinh tự tay thực hiện các thí nghiệm hóa sinh và dự án STEM.', icon: 'flask', image: '/images/co-so-2.jpg' },
    { title: 'Thư viện số & Không gian tự học', text: 'Hơn 15.000 đầu sách giấy và kho tài liệu số điện tử phong phú, máy tính tra cứu internet tốc độ cao, không gian đọc sách yên tĩnh.', icon: 'book', size: 'wide', image: '/images/co-so-3.jpg' },
    { title: 'Sân bóng cỏ nhân tạo & Khu thể thao', text: 'Tổ hợp sân bóng đá 7 người, sân bóng rổ tiêu chuẩn, đường chạy điền kinh và nhà tập đa năng rèn luyện thể chất.', icon: 'ball', image: '/images/co-so-4.jpg' },
    { title: 'Hội trường & Phòng sinh hoạt CLB', text: 'Khán phòng 600 chỗ ngồi với âm thanh, ánh sáng chuyên nghiệp là nơi tổ chức các sự kiện lớn và sinh hoạt của hơn 25 CLB.', icon: 'spark', image: '/images/co-so-5.jpg' },
];

/* Danh sách 25 Câu lạc bộ học đường */
export const CLUBS = [
    { name: 'NSL Football Club (Bóng đá)', group: 'Thể thao & Thể chất' },
    { name: 'Basketball Titans (Bóng rổ)', group: 'Thể thao & Thể chất' },
    { name: 'Badminton Stars (Cầu lông)', group: 'Thể thao & Thể chất' },
    { name: 'Võ thuật cổ truyền & Taekwondo', group: 'Thể thao & Thể chất' },
    { name: 'Bóng chuyền học sinh', group: 'Thể thao & Thể chất' },

    { name: 'CLB Âm nhạc & Ban nhạc Acoustic', group: 'Nghệ thuật & Sáng tạo' },
    { name: 'CLB Vũ đạo Hiện đại (Dance Crew)', group: 'Nghệ thuật & Sáng tạo' },
    { name: 'CLB Nhiếp ảnh & Media (NSL Media)', group: 'Nghệ thuật & Sáng tạo' },
    { name: 'CLB Hội họa & Mỹ thuật ứng dụng', group: 'Nghệ thuật & Sáng tạo' },
    { name: 'CLB Kịch nghệ & Điện ảnh', group: 'Nghệ thuật & Sáng tạo' },

    { name: 'CLB Tiếng Anh & Tranh biện (NSL English Club)', group: 'Học thuật & Công nghệ' },
    { name: 'CLB Lập trình & Robotics (STEM Lab)', group: 'Học thuật & Công nghệ' },
    { name: 'CLB Toán học & Những con số kỳ diệu', group: 'Học thuật & Công nghệ' },
    { name: 'CLB Khoa học thực nghiệm', group: 'Học thuật & Công nghệ' },
    { name: 'CLB Sách & Văn hóa đọc', group: 'Học thuật & Công nghệ' },

    { name: 'Đội Thanh niên Tình nguyện Ngô Sĩ Liên', group: 'Kỹ năng & Xã hội' },
    { name: 'CLB Kỹ năng mềm & Lãnh đạo trẻ', group: 'Kỹ năng & Xã hội' },
    { name: 'CLB Truyền thông & Sự kiện trường', group: 'Kỹ năng & Xã hội' },
    { name: 'CLB Môi trường Xanh (Green NSL)', group: 'Kỹ năng & Xã hội' },
    { name: 'CLB Hùng biện & MC tài năng', group: 'Kỹ năng & Xã hội' },
];

/* Lịch trình một ngày học tập */
export const DAY = [
    ['06:45', 'Khởi đầu ngày mới', 'Cổng trường mở đón học sinh trong tiếng nhạc du dương, các em ổn định vị trí, chuẩn bị tâm thế hào hứng cho ngày học.'],
    ['07:00 – 11:15', 'Các tiết học văn hóa buổi sáng', 'Tiếp thu tri thức trọng tâm qua các phương pháp giảng dạy tích cực, thảo luận nhóm và ứng dụng bảng tương tác.'],
    ['09:00', 'Thể dục giữa giờ & Giải lao', '15 phút tập thể dục toàn trường, nghe bản tin phát thanh học đường và sinh hoạt nhẹ nhàng tại sân trường.'],
    ['11:30 – 13:30', 'Nghỉ trưa & Bán trú', 'Học sinh bán trú thưởng thức bữa trưa dinh dưỡng tại nhà ăn sạch sẽ và nghỉ trưa tại phòng nghỉ điều hòa.'],
    ['13:45 – 16:30', 'Học chuyên đề, STEM & Kỹ năng', 'Các tiết thực hành phòng thí nghiệm, học ngoại ngữ tăng cường hoặc bồi dưỡng học sinh giỏi.'],
    ['16:30 – 17:45', 'Sinh hoạt Câu lạc bộ & Thể thao', 'Sân cỏ, nhà đa năng và các phòng chức năng rộn ràng tiếng cười đùa trong giờ sinh hoạt CLB yêu thích.'],
];

/* Dữ liệu lãnh đạo Ban giám hiệu */
export const LEADERS = [
    { name: 'ThS. Nguyễn Văn Hùng', role: 'Hiệu trưởng', note: 'Chiến sĩ thi đua cấp Tỉnh, hơn 25 năm kinh nghiệm quản lý giáo dục.' },
    { name: 'ThS. Trần Thị Mai Lan', role: 'Phó Hiệu trưởng', note: 'Phụ trách chuyên môn đào tạo, bồi dưỡng đội tuyển HSG và đổi mới GDPT 2018.' },
    { name: 'ThS. Lê Hoàng Nam', role: 'Phó Hiệu trưởng', note: 'Phụ trách Cơ sở vật chất, Công tác Đoàn thanh niên và Hoạt động trải nghiệm.' },
];

/* Tin tức tiêu biểu dự phòng */
export const NEWS_FALLBACK = [
    {
        id: 1,
        slug: 'thong-bao-tuyen-sinh-lop-10-nam-hoc-2026-2027',
        kind: 'news',
        category: 'Tuyển sinh',
        title: 'Thông báo tuyển sinh lớp 10 năm học 2026 – 2027: Phương thức và chỉ tiêu',
        summary: 'Trường THPT Ngô Sĩ Liên trân trọng thông báo phương án tuyển sinh vào lớp 10 với nhiều chính sách ưu tiên và học bổng hấp dẫn dành cho học sinh giỏi.',
        tone: 'a',
        featured: true,
        date: '2026-10-25',
        event_date: null,
        event_place: null,
        views: 1420,
    },
    {
        id: 2,
        slug: 'hoc-sinh-ngo-si-lien-xuat-sac-dat-giai-nhat-stem-cap-tinh',
        kind: 'news',
        category: 'Thành tích',
        title: 'Học sinh Ngô Sĩ Liên xuất sắc đạt 02 giải Nhất cuộc thi Sáng tạo KHKT cấp Tỉnh',
        summary: 'Dự án "Hệ thống lọc nước thông minh IoT" và "Phần mềm hỗ trợ học lịch sử bằng AR" của học sinh nhà trường đã giành giải thưởng cao nhất.',
        tone: 'c',
        featured: false,
        date: '2026-10-20',
        event_date: null,
        event_place: null,
        views: 980,
    },
    {
        id: 3,
        slug: 'le-ky-ket-hop-tac-chuong-trinh-ielts-quoc-te',
        kind: 'news',
        category: 'Hợp tác quốc tế',
        title: 'Lễ ký kết chương trình đào tạo chuẩn đầu ra IELTS và học bổng du học',
        summary: 'Nhà trường phối hợp cùng đối tác quốc tế mang đến lộ trình cam kết chuẩn đầu ra IELTS 6.5+ và học bổng tuyển thẳng Đại học cho học sinh.',
        tone: 'b',
        featured: false,
        date: '2026-10-15',
        event_date: null,
        event_place: null,
        views: 750,
    },
];

/* 4 Bước tuyển sinh cực kỳ rõ ràng */
export const ADMISSION_STEPS = [
    {
        step: '01',
        title: 'Đăng ký tư vấn trực tuyến',
        text: 'Phụ huynh điền form trực tuyến chỉ mất 1 phút để nhận mã hồ sơ và được cán bộ tuyển sinh gọi điện tư vấn chuyên sâu về tổ hợp môn phù hợp.',
    },
    {
        step: '02',
        title: 'Tham quan trường & Hướng nghiệp',
        text: 'Tham gia "Open Day — Một ngày làm học sinh Ngô Sĩ Liên", trải nghiệm phòng thí nghiệm, giao lưu với thầy cô và các anh chị khóa trên.',
    },
    {
        step: '03',
        title: 'Nộp hồ sơ xét tuyển chính thức',
        text: 'Nộp hồ sơ bản giấy tại Ban tuyển sinh nhà trường hoặc qua đường bưu điện theo lịch hẹn. Nhà trường hỗ trợ kiểm tra đối chiếu hồ sơ nhanh chóng.',
    },
    {
        step: '04',
        title: 'Nhận giấy báo & Kích hoạt cổng học sinh',
        text: 'Chúc mừng em chính thức là học sinh Ngô Sĩ Liên! Nhận đồng phục, lớp học và tài khoản truy cập Cổng thông tin học sinh hiện đại.',
    },
];

export const ADMISSION_DOCS = [
    'Phiếu đăng ký dự tuyển vào lớp 10 (theo mẫu của nhà trường)',
    'Bản sao hợp lệ Giấy khai sinh',
    'Học bạ cấp Trung học cơ sở (bản chính)',
    'Giấy chứng nhận tốt nghiệp THCS tạm thời hoặc bằng tốt nghiệp THCS',
    '04 ảnh thẻ kích thước 3×4 (chụp trong vòng 6 tháng gần nhất)',
    'Giấy chứng nhận ưu tiên, khuyến khích (chứng chỉ IELTS, giải HSG cấp Tỉnh/Quốc gia nếu có)',
];

export const ADMISSION_DATES = [
    ['Tháng 4 – Tháng 6', 'Mở cổng đăng ký tư vấn trực tuyến và tham quan trường'],
    ['Đầu Tháng 7', 'Tiếp nhận hồ sơ xét tuyển và thi tuyển theo hướng dẫn của Sở GD&ĐT'],
    ['Giữa Tháng 7', 'Công bố danh sách trúng tuyển và hướng dẫn nhập học'],
    ['Đầu Tháng 8', 'Tập trung học sinh lớp 10, phân lớp theo tổ hợp và chuẩn bị năm học mới'],
];

/* Đánh giá thật của Phụ huynh và Cựu học sinh */
export const TESTIMONIALS = [
    {
        who: 'Bác Trần Quốc Tuấn',
        role: 'Phụ huynh em Trần Minh Anh (Học sinh lớp 11A1 - Ban KHTN)',
        avatar: '/images/thu-vien-2.jpg',
        rating: 5,
        text: 'Điều tôi an tâm nhất khi gửi gắm con vào THPT Ngô Sĩ Liên là môi trường kỷ cương nhưng rất giàu tình thương. Thầy cô chủ nhiệm cập nhật tình hình học tập của cháu rất kịp thời qua cổng thông tin. Con từ một cậu bé nhút nhát nay đã tự tin làm trưởng nhóm nghiên cứu STEM của trường.',
    },
    {
        who: 'Em Lê Quỳnh Chi',
        role: 'Cựu học sinh K75 — Thủ khoa khối D, hiện là Sinh viên Đại học Ngoại Thương',
        avatar: '/images/thu-vien-3.jpg',
        rating: 5,
        text: 'Ba năm dưới mái trường Ngô Sĩ Liên là quãng thời gian đẹp đẽ nhất tuổi thanh xuân của em. Không chỉ được trang bị kiến thức vững vàng để chinh phục điểm 10 môn Tiếng Anh và đỗ thủ khoa Ngoại Thương, trường còn cho em cơ hội làm Chủ nhiệm CLB Tiếng Anh, rèn luyện kỹ năng lãnh đạo vô giá.',
    },
    {
        who: 'Cô Hoàng Thu Thủy',
        role: 'Phụ huynh em Nguyễn Đức Duy (Lớp 12D2 - Ban KHXH)',
        avatar: '/images/thu-vien-1.jpg',
        rating: 5,
        text: 'Chương trình GDPT 2018 tại trường được triển khai rất bài bản. Con tôi được chọn đúng tổ hợp môn con đam mê, được định hướng nghề nghiệp từ sớm. Các thầy cô dạy Văn, Sử truyền cảm hứng tuyệt vời, giúp các con học tập nhẹ nhàng mà đạt hiệu quả cao.',
    },
    {
        who: 'Em Phạm Hoàng Long',
        role: 'Cựu học sinh — Giải Nhì HSG Quốc gia môn Hóa học, Sinh viên Đại học Y Hà Nội',
        avatar: '/images/thu-vien-4.jpg',
        rating: 5,
        text: 'Hệ thống phòng thí nghiệm hiện đại của trường đã nuôi dưỡng niềm đam mê Hóa học trong em. Em vô cùng biết ơn thầy cô tổ Tự nhiên đã luôn tận tụy bồi dưỡng cả ngày lẫn đêm để em đạt được ước mơ trở thành bác sĩ.',
    },
];

/* Hỏi đáp thường gặp */
export const FAQ = [
    {
        q: 'Nhà trường có những chính sách học bổng nào cho học sinh lớp 10?',
        a: 'Nhà trường có Quỹ học bổng Ngô Sĩ Liên trao tặng: Học bổng 100% học phí cho học sinh đạt giải Nhất HSG cấp Tỉnh hoặc có chứng chỉ IELTS 7.0+; Học bổng khuyến tài cho học sinh đỗ thủ khoa đầu vào và học bổng vượt khó dành cho các em học sinh có hoàn cảnh khó khăn vươn lên học giỏi.',
    },
    {
        q: 'Học sinh chọn tổ hợp môn như thế nào theo Chương trình GDPT 2018?',
        a: 'Ngoài các môn học bắt buộc chung, học sinh được đăng ký tổ hợp môn lựa chọn (Khoa học Tự nhiên hoặc Khoa học Xã hội) ngay khi nộp hồ sơ. Trong tuần định hướng đầu năm, Ban tư vấn chuyên môn sẽ tổ chức bài test năng lực và phỏng vấn nguyện vọng để giúp học sinh và phụ huynh đưa ra quyết định phù hợp nhất.',
    },
    {
        q: 'Nhà trường có tổ chức xe đưa đón và dịch vụ bán trú cho học sinh ở xa không?',
        a: 'Có. Nhà trường có khu bán trú riêng biệt sạch sẽ, khang trang với phòng ngủ điều hòa, camera an ninh và bếp ăn đạt tiêu chuẩn vệ sinh an toàn thực phẩm. Đội xe đưa đón học sinh chất lượng cao có giám sát viên theo kèm hỗ trợ các tuyến chính trong thành phố và khu vực lân cận.',
    },
    {
        q: 'Làm sao phụ huynh có thể theo dõi việc học tập và điểm danh của con hàng ngày?',
        a: 'Nhà trường cung cấp Cổng thông tin học sinh và phụ huynh trực tuyến (truy cập qua web hoặc ứng dụng điện thoại). Mọi thông tin về chuyên cần (điểm danh khi vào cổng), điểm số các bài kiểm tra, lời nhận xét của giáo viên bộ môn và thông báo học phí đều được gửi tự động và cập nhật tức thì đến phụ huynh.',
    },
    {
        q: 'Học sinh muốn tham gia các câu lạc bộ ngoại khóa thì đăng ký ra sao?',
        a: 'Hằng năm, sau lễ Khai giảng, nhà trường tổ chức "Club Fair — Ngày hội các câu lạc bộ". Tại đây, học sinh được tìm hiểu và đăng ký tham gia từ 1 đến 2 câu lạc bộ phù hợp với sở thích của mình. Mọi hoạt động CLB đều có giáo viên cố vấn đồng hành.',
    },
];

export const TRACK_OPTIONS = [
    'Khoa học Tự nhiên (Toán, Lý, Hóa, Sinh, Tin học)',
    'Khoa học Xã hội (Văn, Sử, Địa, KT&PL, Ngoại ngữ)',
    'Lớp Tăng cường Tiếng Anh quốc tế (IELTS)',
    'Cần nhà trường tư vấn thêm',
];

export const CONTACT_TOPICS = [
    'Tư vấn tuyển sinh lớp 10',
    'Tư vấn chọn tổ hợp môn GDPT 2018',
    'Học phí và chính sách học bổng',
    'Cổng thông tin & Sổ liên lạc điện tử',
    'Chuyển trường & Thủ tục hồ sơ',
];

export const PORTAL = [
    ['Tra cứu điểm số & Học bạ điện tử', 'Cập nhật điểm thường xuyên, giữa kỳ, cuối kỳ và xếp loại học lực theo chuẩn GDPT 2018 tức thì.'],
    ['Thời khóa biểu & Lịch thi thông minh', 'Lịch học theo tuần, lịch kiểm tra tập trung và thông báo thay đổi phòng học được thông báo chính xác.'],
    ['Đóng học phí không dùng tiền mặt', 'Xem chi tiết các khoản thu, hạn nộp, lịch sử giao dịch và nhận hóa đơn/biên lai điện tử hợp lệ.'],
    ['Tương tác trực tiếp với Thầy Cô', 'Kênh trao đổi riêng giữa phụ huynh và giáo viên chủ nhiệm, xin nghỉ phép trực tuyến nhanh chóng.'],
];

export const IMG = {
    hero1: '/images/hero-2.jpg',          // ảnh học sinh và sân trường rạng rỡ
    hero2: '/images/hero-1.jpg',          // khuôn viên trường
    hero3: '/images/hero-3.jpg',          // hoạt động lễ hội khai giảng
    about: '/images/gioi-thieu.jpg',      // toàn cảnh ngôi trường vàng rực rỡ
    tn: '/images/chuong-trinh-tn.jpg',    // phòng thí nghiệm thực hành
    xh: '/images/chuong-trinh-xh.jpg',    // lớp học ngôn ngữ, xã hội
    exp: '/images/trai-nghiem.jpg',       // hoạt động ngoại khóa ngoài trời
    stats: '/images/nen-so-lieunen-so-lieu.jpg', // ảnh nền số liệu
    staff: '/images/doi-ngu.jpg',         // tập thể sư phạm nhà trường
    portal: '/images/cong-thong-tin.jpg', // công nghệ thông tin học sinh
    g1: '/images/thu-vien-1.jpg',
    g2: '/images/thu-vien-2.jpg',
    g3: '/images/thu-vien-3.jpg',
    g4: '/images/thu-vien-4.jpg',
    g5: '/images/thu-vien-5.jpg',
    g6: '/images/thu-vien-6.jpg',
};

export const GALLERY: { title: string; text: string; img: string; size?: 'big' | 'tall' }[] = [
    { title: 'Phòng học thông minh 4.0', text: 'Bảng tương tác, điều hòa và máy chiếu hiện đại.', img: IMG.g1, size: 'big' },
    { title: 'Phòng thí nghiệm thực hành', text: 'Thực hành Lý, Hóa, Sinh và dự án STEM chuẩn Quốc gia.', img: IMG.g2 },
    { title: 'Thư viện số & Không gian tự học', text: 'Yên tĩnh, phong phú với hơn 15.000 đầu sách.', img: IMG.g3, size: 'tall' },
    { title: 'Tổ hợp thể thao & Sân bóng cỏ nhân tạo', text: 'Rèn luyện thể lực và thi đấu giải học sinh.', img: IMG.g4 },
    { title: 'Ngày hội Câu lạc bộ học đường', text: 'Sôi nổi, sáng tạo với hơn 25 CLB tài năng.', img: IMG.g5 },
    { title: 'Hoạt động trải nghiệm & Kỹ năng sống', text: 'Tự tin, bản lĩnh và sẵn sàng hội nhập.', img: IMG.g6 },
];

export const HERO_SLIDES = [
    {
        img: IMG.hero1,
        tone: 'a',
        badge: 'Tuyển sinh Lớp 10 Năm học 2026 – 2027',
        title: 'Vững Tri Thức Hôm Nay — Sáng Tương Lai Mai Sau',
        text: 'Trường THPT Ngô Sĩ Liên — Nơi khơi nguồn đam mê, phát triển toàn diện năng lực và chắp cánh cho những ước mơ bước vào giảng đường Đại học hàng đầu.',
        cta: ['Đăng ký xét tuyển ngay', '/tuyen-sinh#dang-ky'],
        cta2: ['Khám phá ngôi trường', '/gioi-thieu'],
        statsText: '100% Đỗ Tốt nghiệp · 88.6% Vào Đại học Top đầu',
    },
    {
        img: IMG.hero2,
        tone: 'b',
        badge: 'Chương Trình GDPT 2018 Chuẩn Quốc Gia',
        title: 'Mỗi Học Sinh Là Một Bản Thể Tỏa Sáng',
        text: 'Cá nhân hóa lộ trình học tập với tổ hợp Khoa học Tự nhiên, Khoa học Xã hội và Tiếng Anh quốc tế chuẩn IELTS. 100% học sinh được định hướng nghề nghiệp vững chắc.',
        cta: ['Xem chương trình học', '/chuong-trinh'],
        cta2: ['Tư vấn chọn tổ hợp', '/tuyen-sinh'],
        statsText: 'Hơn 25 CLB tài năng · Phòng Lab STEM hiện đại',
    },
    {
        img: IMG.hero3,
        tone: 'c',
        badge: 'Môi Trường Giáo Dục Hạnh Phúc & Kỷ Cương',
        title: 'Nuôi Dưỡng Trí Tuệ & Bồi Đắp Lòng Nhân Ái',
        text: 'Hơn 70 năm bề dày truyền thống vẻ vang. Nơi các em được yêu thương, tôn trọng và trang bị đầy đủ kỹ năng của công dân toàn cầu trong thời đại số.',
        cta: ['Đăng ký tham quan trường', '/lien-he'],
        cta2: ['Cổng thông tin học sinh', '/he-thong'],
        statsText: '78+ Năm truyền thống · 1.500+ Học sinh theo học',
    },
];

export const STAFF = {
    title: 'Đội ngũ giáo viên tinh hoa — Giàu chuyên môn, tận tâm với học trò',
    text: 'Thầy cô tại THPT Ngô Sĩ Liên không chỉ là người truyền thụ tri thức mà còn là những người bạn đồng hành, người thắp lửa đam mê cho từng em học sinh. 100% giáo viên đạt chuẩn và trên chuẩn, thường xuyên được bồi dưỡng phương pháp giảng dạy hiện đại và ứng dụng công nghệ trí tuệ nhân tạo vào bài giảng.',
    points: [
        'Hơn 35% giáo viên có trình độ Thạc sĩ chuyên ngành và Cử nhân loại Xuất sắc',
        'Nhiều thầy cô là Giáo viên dạy giỏi cấp Tỉnh, cốt cán bộ môn của Sở GD&ĐT',
        'Nhiệt huyết, yêu nghề, kiên nhẫn lắng nghe và thấu hiểu tâm lý lứa tuổi học trò',
        'Đạt nhiều giải thưởng Nhà giáo ưu tú, sáng kiến kinh nghiệm cấp Quốc gia',
    ],
};
