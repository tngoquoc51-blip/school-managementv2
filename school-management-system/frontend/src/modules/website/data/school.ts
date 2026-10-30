/* ===================================================================
   NỘI DUNG WEBSITE TRƯỜNG
   Sửa file này là đổi nội dung cả website, không cần động vào giao diện.
   Chỗ ghi [ ... ] là thông tin nhà trường cần điền. Chỗ ghi "MẪU" là ví dụ, hãy thay bằng nội dung thật.
   Số lớp, học sinh, giáo viên và tin tức lấy từ hệ thống; file này chỉ là dữ liệu dự phòng khi API chưa chạy.
   =================================================================== */

export const SCHOOL = {
    name: 'THPT Ngô Sỹ Liên',
    fullName: 'Trường Trung học Phổ thông Ngô Sỹ Liên',
    slogan: 'Học thật vững để bay thật xa.',
    intro: 'Ba năm cấp ba là quãng đường quan trọng nhất của tuổi học trò. Chúng tôi đồng hành để học sinh có kiến thức chắc, nhiều trải nghiệm và hướng đi rõ ràng.',
    schoolYear: '',
    admissionYear: '',
    address: '[Số nhà, đường, phường/xã, tỉnh/thành phố]',
    phone: '',
    email: '',
    hours: 'Thứ Hai – Thứ Sáu, 7:00 – 16:30',
    founded: '[Năm thành lập]',
};

export const NAV = [
    { href: '/gioi-thieu', label: 'Giới thiệu' },
    { href: '/chuong-trinh', label: 'Chương trình' },
    { href: '/doi-song', label: 'Đời sống học đường' },
    { href: '/tin-tuc', label: 'Tin tức' },
    { href: '/tuyen-sinh', label: 'Tuyển sinh' },
    { href: '/lien-he', label: 'Liên hệ' },
];

/* Số liệu dự phòng khi chưa gọi được API */
export const FALLBACK_OVERVIEW = {
    school_year: SCHOOL.schoolYear, classes: 18, students: 720, teachers: 60, subjects: 15,
    grades: [
        { grade: 10, classes: 6, students: 240 }, { grade: 11, classes: 6, students: 240 }, { grade: 12, classes: 6, students: 240 },
    ],
};

export const CLUB_COUNT = 20;

export const PILLARS = [
    { title: 'Tầm nhìn', text: 'Trở thành ngôi trường mà học sinh muốn đến mỗi ngày, nơi các em tự tin học tập, sáng tạo và trưởng thành.' },
    { title: 'Sứ mệnh', text: 'Trang bị kiến thức vững, kỹ năng sống và định hướng nghề nghiệp để học sinh sẵn sàng cho bậc học cao hơn và cuộc sống.' },
    { title: 'Giá trị cốt lõi', text: 'Tôn trọng, trung thực, trách nhiệm, hợp tác và không ngừng học hỏi.' },
];

/* Theo Chương trình Giáo dục phổ thông 2018 */
export const PROGRAMS = [
    {
        key: 'tn', title: 'Khoa học tự nhiên', tone: 'a',
        text: 'Nền tảng cho các ngành kỹ thuật, công nghệ, y dược và khoa học cơ bản.',
        subjects: ['Toán', 'Vật lí', 'Hóa học', 'Sinh học', 'Tin học'],
        careers: ['Kỹ thuật, công nghệ thông tin', 'Y, dược', 'Khoa học dữ liệu', 'Kiến trúc, xây dựng'],
    },
    {
        key: 'xh', title: 'Khoa học xã hội', tone: 'b',
        text: 'Nền tảng cho các ngành kinh tế, luật, báo chí, sư phạm và ngoại ngữ.',
        subjects: ['Ngữ văn', 'Lịch sử', 'Địa lí', 'Giáo dục kinh tế và pháp luật', 'Ngoại ngữ'],
        careers: ['Kinh tế, tài chính', 'Luật', 'Báo chí, truyền thông', 'Sư phạm, ngoại ngữ'],
    },
];

export const COMMON_SUBJECTS = ['Ngữ văn', 'Toán', 'Ngoại ngữ 1', 'Giáo dục thể chất', 'Giáo dục quốc phòng và an ninh', 'Hoạt động trải nghiệm, hướng nghiệp', 'Nội dung giáo dục địa phương'];

export const EXPERIENCE = [
    { title: 'Hoạt động trải nghiệm', text: 'Mỗi học kỳ có chuyên đề về bản thân, nhà trường, cộng đồng và nghề nghiệp.' },
    { title: 'STEM và dự án', text: 'Học sinh làm dự án nhóm, thực hành ở phòng thí nghiệm và trình bày trước lớp.' },
    { title: 'Tư vấn hướng nghiệp', text: 'Giáo viên chủ nhiệm và tổ tư vấn đồng hành chọn tổ hợp môn, ngành học và trường đại học.' },
    { title: 'Kỹ năng sống', text: 'Giao tiếp, làm việc nhóm, quản lý thời gian và an toàn trên mạng.' },
];

export const ASSESSMENT = [
    ['Thường xuyên', 'Kiểm tra miệng, bài tập, dự án trong quá trình học.'],
    ['Giữa kỳ', 'Một bài kiểm tra tập trung vào giữa mỗi học kỳ.'],
    ['Cuối kỳ', 'Bài kiểm tra tổng hợp cuối học kỳ.'],
    ['Điểm trung bình môn', 'Hệ thống tự tính theo trọng số, học sinh xem trực tuyến trên cổng thông tin.'],
];

/* Mỗi mục có thể thêm  image: '/images/ten-anh.jpg'  (ảnh đặt trong public/images) */
export const FACILITIES: { title: string; text: string; icon: string; size?: 'lg' | 'wide'; image?: string }[] = [
    { title: 'Phòng học thông minh', text: 'Máy chiếu, mạng ổn định và bảng tương tác ở các phòng học.', icon: 'monitor', size: 'lg' },
    { title: 'Phòng thí nghiệm và STEM', text: 'Thực hành Lý, Hóa, Sinh và các dự án STEM.', icon: 'flask' },
    { title: 'Thư viện', text: 'Không gian đọc sách và tự học yên tĩnh.', icon: 'book' },
    { title: 'Sân thể thao', text: 'Sân chơi và nhà tập cho giờ thể dục, các giải thể thao của trường.', icon: 'ball' },
    { title: 'Phòng truyền thống và câu lạc bộ', text: 'Nơi sinh hoạt văn nghệ, tiếng Anh, tin học và nhiều hơn nữa.', icon: 'spark' },
];

/* MẪU: danh sách câu lạc bộ, thay bằng câu lạc bộ thật của trường */
export const CLUBS = [
    { name: 'Bóng đá', group: 'Thể thao' }, { name: 'Bóng rổ', group: 'Thể thao' }, { name: 'Cầu lông', group: 'Thể thao' }, { name: 'Võ thuật', group: 'Thể thao' },
    { name: 'Văn nghệ', group: 'Nghệ thuật' }, { name: 'Nhiếp ảnh', group: 'Nghệ thuật' }, { name: 'Vẽ', group: 'Nghệ thuật' }, { name: 'Âm nhạc', group: 'Nghệ thuật' },
    { name: 'Tiếng Anh', group: 'Học thuật' }, { name: 'Tin học và robot', group: 'Học thuật' }, { name: 'Toán', group: 'Học thuật' }, { name: 'Khoa học vui', group: 'Học thuật' },
    { name: 'Tình nguyện', group: 'Cộng đồng' }, { name: 'Truyền thông trường', group: 'Cộng đồng' }, { name: 'Đoàn thanh niên', group: 'Cộng đồng' }, { name: 'Môi trường xanh', group: 'Cộng đồng' },
];

/* MẪU: một ngày ở trường */
export const DAY = [
    ['6:45', 'Đón học sinh', 'Cổng trường mở, học sinh vào lớp và ổn định chỗ ngồi.'],
    ['7:00', 'Các tiết buổi sáng', 'Năm tiết học, xen kẽ giờ giải lao và thể dục giữa giờ.'],
    ['11:30', 'Nghỉ trưa', 'Ăn trưa, nghỉ ngơi hoặc đọc sách ở thư viện.'],
    ['13:30', 'Học buổi chiều', 'Môn tự chọn, thực hành, hoạt động trải nghiệm.'],
    ['16:00', 'Câu lạc bộ', 'Học sinh chọn câu lạc bộ theo sở thích, sinh hoạt hằng tuần.'],
];

/* MẪU: mốc lịch sử, thay bằng mốc thật của trường */
export const HISTORY = [
    ['[Năm]', 'Thành lập trường', '[Điền hoàn cảnh ra đời và những ngày đầu của nhà trường.]'],
    ['[Năm]', 'Chuyển sang cơ sở mới', '[Điền sự kiện: mở rộng, xây thêm khu học tập, đón học sinh đầu tiên.]'],
    ['[Năm]', 'Đạt chuẩn quốc gia', '[Điền danh hiệu, thành tích nổi bật theo từng giai đoạn.]'],
    ['2026', 'Chuyển đổi số', 'Học sinh xem điểm, học phí và thông báo trực tuyến trên cổng thông tin của trường.'],
];

/* MẪU: thay bằng tên và ảnh thật. Không điền thông tin chưa được đồng ý công bố. */
export const LEADERS = [
    { name: '[Họ và tên]', role: 'Hiệu trưởng', note: 'Phụ trách chung, chuyên môn và đối ngoại.' },
    { name: '[Họ và tên]', role: 'Phó hiệu trưởng', note: 'Phụ trách chuyên môn và đánh giá học sinh.' },
    { name: '[Họ và tên]', role: 'Phó hiệu trưởng', note: 'Phụ trách cơ sở vật chất, hoạt động giáo dục.' },
];

/* Dữ liệu dự phòng khi chưa gọi được API tin tức */
export const NEWS_FALLBACK = [
    { id: 1, slug: '', kind: 'news', category: 'Tuyển sinh', title: 'Mở đăng ký trực tuyến tuyển sinh lớp 10', summary: 'Phụ huynh và học sinh để lại thông tin trên website, nhà trường sẽ gọi lại tư vấn.', tone: 'a', featured: true, date: '2026-10-01', event_date: null, event_place: null, views: 0 },
    { id: 2, slug: '', kind: 'news', category: 'Thông báo', title: 'Hướng dẫn đăng nhập cổng thông tin học sinh', summary: 'Xem điểm, thời khóa biểu, học phí và thông báo bằng tài khoản do nhà trường cấp.', tone: 'c', featured: false, date: '2026-09-28', event_date: null, event_place: null, views: 0 },
];

export const ADMISSION_STEPS = [
    { title: 'Đăng ký trực tuyến', text: 'Điền biểu mẫu bên dưới. Hệ thống cấp một mã hồ sơ để bạn tra cứu tiến độ.' },
    { title: 'Nhà trường tư vấn', text: 'Cán bộ tuyển sinh gọi điện, tư vấn tổ hợp môn và hẹn lịch nộp hồ sơ.' },
    { title: 'Nộp hồ sơ bản giấy', text: 'Mang hồ sơ đến trường theo lịch hẹn để được xác nhận.' },
    { title: 'Nhập học', text: 'Nhận lớp, hoàn tất các khoản thu và nhận tài khoản vào cổng thông tin.' },
];

export const ADMISSION_DOCS = [
    'Bản sao giấy khai sinh',
    'Học bạ trung học cơ sở',
    'Bằng hoặc giấy chứng nhận tốt nghiệp trung học cơ sở (tạm thời)',
    'Ảnh thẻ 3×4',
    'Giấy tờ ưu tiên, miễn giảm (nếu có)',
];

/* MẪU: thay bằng lịch tuyển sinh thật khi có thông báo của Sở */
export const ADMISSION_DATES = [
    ['[Ngày]', 'Mở đăng ký trực tuyến'],
    ['[Ngày]', 'Nhận hồ sơ bản giấy'],
    ['[Ngày]', 'Công bố kết quả'],
    ['[Ngày]', 'Nhập học và nhận lớp'],
];

export const FAQ = [
    { q: 'Khi nào nhà trường nhận hồ sơ tuyển sinh?', a: 'Thời gian cụ thể được công bố trên website và thông báo của nhà trường. Bạn có thể đăng ký trực tuyến trước để nhà trường liên hệ và nhắc lịch.' },
    { q: 'Đăng ký trực tuyến có thay thế hồ sơ bản giấy không?', a: 'Không. Đăng ký trực tuyến giúp nhà trường ghi nhận và tư vấn sớm. Bạn vẫn cần nộp hồ sơ bản giấy theo hướng dẫn để hoàn tất tuyển sinh.' },
    { q: 'Làm sao biết hồ sơ của tôi đã được xử lý?', a: 'Dùng mã hồ sơ và số điện thoại đã khai ở trang Tra cứu hồ sơ. Trạng thái cập nhật khi cán bộ tuyển sinh liên hệ với bạn.' },
    { q: 'Học phí và các khoản thu được quy định như thế nào?', a: 'Học phí và các khoản thu theo quy định hiện hành, được thông báo công khai khi nhập học. Phụ huynh xem từng khoản và đóng tiền trên cổng thông tin.' },
    { q: 'Sau khi nhập học, học sinh xem điểm ở đâu?', a: 'Nhà trường cấp tài khoản để học sinh đăng nhập cổng thông tin, xem điểm, thời khóa biểu, học phí và thông báo.' },
];

export const TRACK_OPTIONS = ['Khoa học tự nhiên', 'Khoa học xã hội', 'Chưa xác định'];
export const CONTACT_TOPICS = ['Tuyển sinh', 'Học phí', 'Học tập', 'Cổng thông tin', 'Khác'];

export const PORTAL = [
    ['Xem điểm và nhận xét', 'Điểm thường xuyên, giữa kỳ, cuối kỳ và điểm trung bình môn cập nhật ngay khi giáo viên nhập.'],
    ['Thời khóa biểu và lịch thi', 'Lịch học theo lớp, lịch kiểm tra và thay đổi đột xuất.'],
    ['Học phí', 'Xem từng khoản phải đóng, hạn nộp, lịch sử thanh toán và biên lai.'],
    ['Thông báo', 'Thông báo của nhà trường, nhắc đóng học phí và tin từ giáo viên chủ nhiệm.'],
];

/* ===================================================================
   ẢNH THẬT CỦA TRƯỜNG
   Đặt ảnh vào thư mục  frontend/public/images/  với đúng tên bên dưới (đuôi .jpg).
   Chưa có ảnh thì website tự hiện nền màu thay thế, không bị lỗi. Khi bạn bỏ ảnh vào là ảnh hiện ngay.
   Kích thước gợi ý: ảnh banner 1920×900, ảnh thẻ 1200×800, ảnh vuông 900×900. Mỗi ảnh nên dưới 400 KB.
   Chỉ dùng ảnh nhà trường tự chụp hoặc có quyền sử dụng. Ảnh học sinh cần có sự đồng ý của phụ huynh.
   =================================================================== */
export const IMG = {
    hero1: '/images/hero-1.jpg',       // toàn cảnh cổng trường hoặc sân trường
    hero2: '/images/hero-2.jpg',       // học sinh trong giờ học
    hero3: '/images/hero-3.jpg',       // lễ khai giảng hoặc hoạt động ngoại khóa
    about: '/images/gioi-thieu.jpg',   // thầy cô và học sinh
    tn: '/images/chuong-trinh-tn.jpg', // giờ thực hành Lý, Hóa, Sinh, Tin
    xh: '/images/chuong-trinh-xh.jpg', // giờ học Văn, Sử, Địa, Ngoại ngữ
    exp: '/images/trai-nghiem.jpg',    // hoạt động trải nghiệm, hướng nghiệp
    stats: '/images/nen-so-lieu.jpg',  // ảnh nền tối màu: toàn trường hoặc sân khấu
    staff: '/images/doi-ngu.jpg',      // ảnh tập thể giáo viên
    portal: '/images/cong-thong-tin.jpg', // học sinh dùng điện thoại hoặc máy tính
    g1: '/images/thu-vien-1.jpg', g2: '/images/thu-vien-2.jpg', g3: '/images/thu-vien-3.jpg',
    g4: '/images/thu-vien-4.jpg', g5: '/images/thu-vien-5.jpg', g6: '/images/thu-vien-6.jpg',
};

/* Các slide ở đầu trang chủ (mỗi slide một ảnh, một thông điệp) */
export const HERO_SLIDES = [
    {
        img: IMG.hero1, tone: 'a',
        title: 'Học thật vững để bay thật xa',
        text: 'Ba năm cấp ba là quãng đường quan trọng nhất của tuổi học trò. Chúng tôi đồng hành để mỗi em có kiến thức chắc, nhiều trải nghiệm và một hướng đi rõ ràng.',
        cta: ['Đăng ký nhập học', '/tuyen-sinh#dang-ky'], cta2: ['Tìm hiểu về trường', '/gioi-thieu'],
    },
    {
        img: IMG.hero2, tone: 'b',
        title: 'Mỗi học sinh một cách để tỏa sáng',
        text: 'Hai tổ hợp môn, hơn 20 câu lạc bộ và giáo viên chủ nhiệm theo sát từng em. Ở đây, học giỏi và sống tử tế quan trọng ngang nhau.',
        cta: ['Xem chương trình học', '/chuong-trinh'], cta2: ['Đời sống học đường', '/doi-song'],
    },
    {
        img: IMG.hero3, tone: 'c',
        title: 'Tuyển sinh lớp 10 năm học 2027 – 2028',
        text: 'Đăng ký trực tuyến trong vài phút, nhận mã hồ sơ và theo dõi tiến độ bất cứ lúc nào. Cán bộ tuyển sinh sẽ gọi lại tư vấn tổ hợp môn phù hợp với con.',
        cta: ['Đăng ký ngay', '/tuyen-sinh#dang-ky'], cta2: ['Tra cứu hồ sơ', '/tuyen-sinh/tra-cuu'],
    },
];

export const ABOUT = {
    title: 'Một ngôi trường để các em lớn lên',
    paras: [
        'Trường THPT Ngô Sỹ Liên đón học sinh ở lứa tuổi nhiều thay đổi nhất: từ cậu bé, cô bé cuối cấp hai thành người trẻ biết tự quyết định cho mình. Vì vậy, chúng tôi không chỉ dạy kiến thức. Chúng tôi dạy các em cách học, cách làm việc nhóm, cách đứng lên sau một bài kiểm tra chưa như ý.',
        'Mỗi lớp có một giáo viên chủ nhiệm theo sát suốt ba năm. Thầy cô biết em nào cần được nhắc, em nào cần được khích lệ, em nào đang có chuyện ở nhà. Phụ huynh có đầu mối liên hệ rõ ràng, không phải chờ đến buổi họp cuối kỳ mới biết con học thế nào.',
        'Mọi thông tin của học sinh gồm điểm số, chuyên cần, học phí và thông báo đều nằm trên một cổng thông tin trực tuyến. Điều này giúp nhà trường làm việc minh bạch, và gia đình luôn nắm được tình hình của con.',
    ],
    bullets: ['Chương trình Giáo dục phổ thông 2018', 'Giáo viên chủ nhiệm đồng hành suốt ba năm', 'Cổng thông tin điểm số, học phí, thông báo', 'Hơn 20 câu lạc bộ cho mọi sở thích'],
};

export const WHY = [
    { icon: 'book', title: 'Học vững từ nền tảng', text: 'Giáo viên bám sát Chương trình 2018, kiểm tra thường xuyên để phát hiện sớm chỗ học sinh còn hổng và kèm lại kịp thời, thay vì để dồn đến cuối kỳ.' },
    { icon: 'flask', title: 'Chọn tổ hợp môn theo năng lực', text: 'Từ lớp 10, học sinh được tư vấn chọn hướng Khoa học tự nhiên hoặc Khoa học xã hội dựa trên điểm mạnh và ngành học dự định, không chọn theo phong trào.' },
    { icon: 'shield', title: 'Môi trường an toàn, thân thiện', text: 'Quy tắc ứng xử rõ ràng, thầy cô lắng nghe và học sinh tôn trọng nhau. Nhà trường quan tâm cả sức khỏe tinh thần, không chỉ điểm số.' },
    { icon: 'monitor', title: 'Phụ huynh nắm tình hình mỗi ngày', text: 'Điểm, chuyên cần, thời khóa biểu, các khoản học phí và thông báo đều xem được trên điện thoại. Không còn chuyện đến cuối kỳ mới biết kết quả.' },
    { icon: 'spark', title: 'Hơn 20 câu lạc bộ', text: 'Từ bóng đá, văn nghệ, nhiếp ảnh đến tin học và tình nguyện. Học sinh có chỗ để thử sức, tìm bạn cùng sở thích và rèn kỹ năng ngoài sách vở.' },
    { icon: 'teacher', title: 'Định hướng nghề nghiệp sớm', text: 'Tư vấn hướng nghiệp bắt đầu từ lớp 10: tìm hiểu bản thân, gặp gỡ người làm nghề, cân nhắc ngành và trường đại học trước khi quyết định.' },
];

export const GALLERY: { title: string; text: string; img: string; size?: 'big' | 'tall' }[] = [
    { title: 'Phòng học thông minh', text: 'Máy chiếu, bảng tương tác, mạng ổn định.', img: IMG.g1, size: 'big' },
    { title: 'Phòng thí nghiệm', text: 'Thực hành Lý, Hóa, Sinh an toàn.', img: IMG.g2 },
    { title: 'Thư viện', text: 'Yên tĩnh để đọc và tự học.', img: IMG.g3, size: 'tall' },
    { title: 'Sân thể thao', text: 'Giờ thể dục và giải đấu của trường.', img: IMG.g4 },
    { title: 'Ngày hội câu lạc bộ', text: 'Học sinh chọn nơi mình thuộc về.', img: IMG.g5 },
    { title: 'Lễ khai giảng', text: 'Khởi đầu mỗi năm học.', img: IMG.g6 },
];

export const STAFF = {
    title: 'Thầy cô là người làm nên ngôi trường',
    text: 'Đội ngũ giáo viên của trường gồm những người thầy, người cô yêu nghề, được đào tạo bài bản và thường xuyên bồi dưỡng chuyên môn. Các thầy cô không chỉ giảng bài mà còn là người lắng nghe, nhắc nhở và tin vào từng học sinh. Giáo viên bộ môn phối hợp với giáo viên chủ nhiệm để theo dõi sự tiến bộ của các em qua từng kỳ.',
    points: ['Sinh hoạt chuyên môn theo tổ hằng tuần', 'Dự giờ, góp ý và chia sẻ phương pháp giảng dạy', 'Giáo viên chủ nhiệm gặp phụ huynh theo lịch và khi cần'],
};

/* MẪU: các lời chia sẻ dưới đây chỉ để minh họa bố cục. Hãy thay bằng chia sẻ thật (có sự đồng ý của người nói)
   rồi đổi sample thành false. Khi còn sample = true, website hiện nhãn "Nội dung mẫu" bên cạnh. */
export const TESTIMONIALS = [
    { who: 'Phụ huynh học sinh lớp 10', text: 'Điều tôi thích nhất là xem được điểm và thông báo của con ngay trên điện thoại. Có việc gì cô chủ nhiệm cũng báo sớm, nên gia đình yên tâm.', sample: true },
    { who: 'Học sinh lớp 11', text: 'Mình vào câu lạc bộ nhiếp ảnh từ lớp 10. Ngoài giờ học, đây là nơi mình học được rất nhiều và có những người bạn thân.', sample: true },
    { who: 'Học sinh lớp 12', text: 'Thầy cô tư vấn rất kỹ khi mình chọn ngành. Nhờ vậy mình biết mình hợp với gì và cần chuẩn bị những gì cho kỳ thi.', sample: true },
];