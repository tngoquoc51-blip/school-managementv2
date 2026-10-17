/* ===================================================================
   DỮ LIỆU WEBSITE GIỚI THIỆU TRƯỜNG
   Sửa file này là đổi nội dung toàn website, không cần động vào giao diện.
   Mục có chữ [ ... ] là chỗ cần điền thông tin thật của trường.
   Mục ghi "SỐ LIỆU MẪU" chỉ là ví dụ, hãy thay bằng số liệu thật trước khi công bố.
   =================================================================== */

export const SCHOOL = {
    name: 'Trường THPT',
    fullName: 'Trường Trung học Phổ thông',
    slogan: 'Môi trường học tập thân thiện, hiện đại, nơi mỗi học sinh được phát triển toàn diện.',
    schoolYear: '2026 – 2027',
    admissionYear: '2027 – 2028',
    address: '[Số nhà, đường, phường/xã, tỉnh/thành phố]',
    phone: '[Số điện thoại nhà trường]',
    email: '[email@truong.edu.vn]',
    hours: '[Giờ làm việc, ví dụ: Thứ Hai – Thứ Sáu, 7:00 – 16:30]',
};

export const NAV = [
    { href: '/#gioi-thieu', label: 'Giới thiệu' },
    { href: '/#chuong-trinh', label: 'Chương trình' },
    { href: '/#doi-song', label: 'Đời sống học đường' },
    { href: '/#tin-tuc', label: 'Tin tức' },
    { href: '/tuyen-sinh', label: 'Tuyển sinh' },
    { href: '/#lien-he', label: 'Liên hệ' },
];

/* SỐ LIỆU MẪU */
export const STATS: [string, string][] = [
    ['38', 'Lớp học'],
    ['1.500+', 'Học sinh'],
    ['90', 'Cán bộ, giáo viên'],
    ['20+', 'Câu lạc bộ'],
];

export const PILLARS = [
    { title: 'Tầm nhìn', text: 'Trở thành ngôi trường mà học sinh muốn đến mỗi ngày, nơi các em tự tin học tập, sáng tạo và trưởng thành.' },
    { title: 'Sứ mệnh', text: 'Trang bị kiến thức vững, kỹ năng sống và định hướng nghề nghiệp để học sinh sẵn sàng cho bậc học cao hơn và cuộc sống.' },
    { title: 'Giá trị cốt lõi', text: 'Tôn trọng, trung thực, trách nhiệm, hợp tác và không ngừng học hỏi.' },
];

/* Theo Chương trình Giáo dục phổ thông 2018 */
export const PROGRAMS = [
    {
        title: 'Khoa học tự nhiên',
        text: 'Nền tảng cho các ngành kỹ thuật, công nghệ, y dược và khoa học.',
        subjects: ['Toán', 'Vật lí', 'Hóa học', 'Sinh học', 'Tin học'],
        tone: 'a',
    },
    {
        title: 'Khoa học xã hội',
        text: 'Nền tảng cho các ngành kinh tế, luật, báo chí, sư phạm và ngoại ngữ.',
        subjects: ['Ngữ văn', 'Lịch sử', 'Địa lí', 'Giáo dục kinh tế và pháp luật', 'Ngoại ngữ'],
        tone: 'b',
    },
    {
        title: 'Trải nghiệm và hướng nghiệp',
        text: 'Giúp học sinh hiểu bản thân, thử sức nhiều lĩnh vực và chọn đúng ngành.',
        subjects: ['Hoạt động trải nghiệm', 'STEM', 'Kỹ năng sống', 'Tư vấn hướng nghiệp'],
        tone: 'c',
    },
];

/* Mỗi mục có thể thêm  image: '/images/ten-anh.jpg'  (ảnh đặt trong thư mục public/images) */
export const FACILITIES: { title: string; text: string; icon: string; size?: 'lg'; image?: string }[] = [
    { title: 'Phòng học thông minh', text: 'Phòng học có máy chiếu, mạng ổn định và bảng tương tác.', icon: 'monitor', size: 'lg' },
    { title: 'Phòng thí nghiệm và STEM', text: 'Thực hành Lý, Hóa, Sinh và các dự án STEM.', icon: 'flask' },
    { title: 'Thư viện', text: 'Không gian đọc sách và tự học yên tĩnh.', icon: 'book' },
    { title: 'Sân thể thao', text: 'Sân chơi và nhà tập cho giờ thể dục, các giải thể thao của trường.', icon: 'ball' },
    { title: 'Câu lạc bộ', text: 'Văn nghệ, bóng đá, tiếng Anh, tin học và nhiều hơn nữa.', icon: 'spark' },
];

/* SỐ LIỆU MẪU */
export const NEWS = [
    { tag: 'Tuyển sinh', date: 'Tháng 10/2026', title: 'Mở đăng ký trực tuyến tuyển sinh lớp 10 năm học 2027 – 2028', text: 'Phụ huynh và học sinh có thể để lại thông tin để nhà trường tư vấn và liên hệ.' },
    { tag: 'Hoạt động', date: 'Tháng 10/2026', title: 'Học sinh khối 10 tham gia ngày hội câu lạc bộ', text: 'Các em làm quen với hơn 20 câu lạc bộ và chọn hoạt động phù hợp với sở thích.' },
    { tag: 'Học tập', date: 'Tháng 9/2026', title: 'Nhà trường triển khai hệ thống quản lý học sinh trực tuyến', text: 'Học sinh và phụ huynh xem điểm, thời khóa biểu và thông báo ngay trên cổng thông tin.' },
];

export const ADMISSION_STEPS = [
    { title: 'Đăng ký trực tuyến', text: 'Điền biểu mẫu để nhà trường ghi nhận và tư vấn cho bạn.' },
    { title: 'Nộp hồ sơ', text: 'Mang hồ sơ bản giấy đến trường theo lịch hẹn để được xác nhận.' },
    { title: 'Nhập học', text: 'Nhận lớp, hoàn tất học phí và nhận tài khoản vào cổng thông tin.' },
];

export const ADMISSION_DOCS = [
    'Bản sao giấy khai sinh',
    'Học bạ trung học cơ sở',
    'Bằng hoặc giấy chứng nhận tốt nghiệp trung học cơ sở (tạm thời)',
    'Ảnh thẻ 3×4',
    'Giấy tờ ưu tiên, miễn giảm (nếu có)',
];

export const FAQ = [
    { q: 'Khi nào nhà trường nhận hồ sơ tuyển sinh?', a: 'Thời gian cụ thể sẽ được công bố trên website và thông báo của nhà trường. Bạn có thể đăng ký trực tuyến trước để nhà trường liên hệ và nhắc lịch.' },
    { q: 'Đăng ký trực tuyến có thay thế hồ sơ bản giấy không?', a: 'Không. Đăng ký trực tuyến giúp nhà trường ghi nhận và tư vấn sớm. Bạn vẫn cần nộp hồ sơ bản giấy theo hướng dẫn để hoàn tất tuyển sinh.' },
    { q: 'Học phí và các khoản thu được quy định như thế nào?', a: 'Học phí và các khoản thu theo quy định hiện hành và được thông báo công khai khi nhập học. Vui lòng liên hệ nhà trường để biết chi tiết.' },
    { q: 'Sau khi nhập học, học sinh xem điểm ở đâu?', a: 'Nhà trường cấp tài khoản để học sinh và phụ huynh đăng nhập cổng thông tin, xem điểm, thời khóa biểu, nhận xét và thông báo.' },
];

export const TRACK_OPTIONS = ['Khoa học tự nhiên', 'Khoa học xã hội', 'Chưa xác định'];
