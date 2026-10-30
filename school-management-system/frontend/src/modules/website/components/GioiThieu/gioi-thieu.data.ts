/* =====================================================================
   NỘI DUNG TRANG "GIỚI THIỆU": toàn bộ lời văn nằm ở file này.
   Muốn sửa chữ trên trang, chỉ cần sửa tại đây, không đụng vào file giao diện.
   Chỗ nào có dấu [ngoặc vuông] là thông tin nhà trường cần điền thật.
   ===================================================================== */

/** Ảnh của trang. Bỏ ảnh vào frontend/public/images/ đúng tên bên dưới. */
export const GT_IMG = {
    hero: '/images/hero-about.jpg',        // nền đầu trang, ảnh ngang 1920×900, nên sáng và thoáng
    story: '/images/gioi-thieu.jpg',       // thầy cô và học sinh, 1200×900
    staff: '/images/doi-ngu.jpg',          // ảnh tập thể giáo viên, 1200×900
    fac: [
        '/images/co-so-1.jpg', '/images/co-so-2.jpg', '/images/co-so-3.jpg',
        '/images/co-so-4.jpg', '/images/co-so-5.jpg', '/images/co-so-6.jpg',
    ],
};

export const GT_HERO = {
    eyebrow: 'Giới thiệu nhà trường',
    title: 'Về Trường Trung học Phổ thông Ngô Sỹ Liên',
    intro: 'Ba năm cấp ba là quãng đường quan trọng nhất của tuổi học trò. Chúng tôi đồng hành để mỗi học sinh có kiến thức vững, kỹ năng tốt và một hướng đi rõ ràng cho tương lai.',
    facts: [
        { icon: 'book', big: 'Chương trình 2018', small: 'Hai tổ hợp môn, chọn theo năng lực' },
        { icon: 'user', big: '3 năm đồng hành', small: 'Một giáo viên chủ nhiệm suốt cấp học' },
        { icon: 'spark', big: 'Hơn 20 câu lạc bộ', small: 'Thể thao, nghệ thuật, học thuật' },
        { icon: 'monitor', big: 'Cổng thông tin', small: 'Điểm, học phí, thông báo trực tuyến' },
    ],
};

/** Thư ngỏ: không ký tên cá nhân. Khi có đồng ý của Hiệu trưởng, điền tên vào signer. */
export const GT_LETTER = {
    eyebrow: 'Thư ngỏ',
    title: 'Gửi các bậc phụ huynh và các em học sinh',
    paras: [
        'Mỗi gia đình khi chọn trường cho con đều mang theo một mong muốn giản dị: con được học tử tế, được an toàn và được trưởng thành. Đó cũng là điều chúng tôi đặt lên hàng đầu mỗi ngày.',
        'Ở Trường THPT Ngô Sỹ Liên, điểm số quan trọng, nhưng không phải là tất cả. Chúng tôi muốn các em rời trường với kiến thức đủ chắc để học tiếp, với sự tự tin để lên tiếng và với trách nhiệm để sống tử tế với mọi người xung quanh.',
        'Chúng tôi tin rằng giáo dục tốt cần sự phối hợp giữa nhà trường và gia đình. Vì vậy, nhà trường luôn mở cửa lắng nghe và chia sẻ thông tin thường xuyên, rõ ràng, kịp thời.',
        'Trân trọng mời quý phụ huynh và các em đến tham quan trường, trò chuyện cùng thầy cô và tự mình cảm nhận môi trường học tập của chúng tôi.',
    ],
    signer: 'Ban giám hiệu nhà trường',
};

export const GT_STORY = {
    eyebrow: 'Câu chuyện nhà trường',
    title: 'Một ngôi trường để các em lớn lên trọn vẹn',
    paras: [
        'Trường Trung học Phổ thông Ngô Sỹ Liên được xây dựng với mong muốn tạo ra một môi trường giáo dục không chỉ chú trọng kiến thức mà còn quan tâm đến sự phát triển toàn diện của mỗi học sinh. Chúng tôi hiểu rằng ba năm cấp ba là giai đoạn các em thay đổi nhiều nhất, từ cậu bé, cô bé cuối cấp hai thành người trẻ biết tự quyết định cho tương lai của mình.',
        'Vì vậy, nhà trường không chỉ dạy kiến thức theo Chương trình Giáo dục phổ thông 2018, mà còn dạy cách học, cách làm việc nhóm, cách đứng lên sau một bài kiểm tra chưa như ý và cách chọn con đường phù hợp với năng lực lẫn đam mê của bản thân.',
        'Mỗi lớp có giáo viên chủ nhiệm đồng hành suốt ba năm. Phụ huynh luôn có đầu mối liên hệ rõ ràng. Mọi thông tin về điểm số, chuyên cần, học phí và thông báo đều được cập nhật minh bạch trên cổng thông tin điện tử của trường.',
    ],
    points: ['Học đi đôi với hành', 'Mỗi học sinh đều được quan tâm', 'Nhà trường và gia đình cùng phối hợp', 'Minh bạch thông tin với phụ huynh'],
};

export const GT_PILLARS = [
    { icon: 'spark', title: 'Tầm nhìn', text: 'Trở thành ngôi trường mà học sinh muốn đến mỗi ngày, nơi các em tự tin học tập, sáng tạo và trưởng thành. Phụ huynh yên tâm gửi gắm con em mình trong ba năm quan trọng nhất của tuổi học trò.' },
    { icon: 'book', title: 'Sứ mệnh', text: 'Trang bị kiến thức vững, kỹ năng sống và định hướng nghề nghiệp để học sinh sẵn sàng bước vào bậc học cao hơn và cuộc sống. Mỗi em được quan tâm, được lắng nghe và được tạo điều kiện phát huy điểm mạnh.' },
    { icon: 'shield', title: 'Triết lý giáo dục', text: 'Học thật vững để bay thật xa. Nền tảng chắc chắn là điều kiện để các em dám mơ ước, dám thử sức và dám theo đuổi con đường của riêng mình.' },
];

export const GT_VALUES = [
    { title: 'Tôn trọng', text: 'Tôn trọng bạn bè, thầy cô và sự khác biệt của mỗi người.' },
    { title: 'Trung thực', text: 'Nói thật, làm thật, nhận trách nhiệm về việc mình làm.' },
    { title: 'Trách nhiệm', text: 'Làm tròn bổn phận với việc học, tập thể và gia đình.' },
    { title: 'Hợp tác', text: 'Biết lắng nghe, chia sẻ và cùng nhau đi xa hơn.' },
    { title: 'Học hỏi', text: 'Luôn tò mò, không ngại sai và không ngừng tiến bộ.' },
];

export const GT_STATS = {
    title: 'Nhà trường trong những con số',
    desc: 'Số liệu lấy trực tiếp từ hệ thống quản lý học sinh của trường, luôn được cập nhật.',
};

export const GT_APPROACH = {
    title: 'Cách chúng tôi dạy và đồng hành',
    desc: 'Bốn việc nhà trường làm đều đặn để mỗi học sinh tiến bộ qua từng kỳ.',
    items: [
        { title: 'Dạy học bám sát chương trình 2018', text: 'Giáo viên thiết kế bài học theo năng lực, tăng thực hành, thảo luận và dự án nhóm để các em hiểu bài thay vì học thuộc.' },
        { title: 'Kiểm tra và hỗ trợ kịp thời', text: 'Điểm thường xuyên, giữa kỳ và cuối kỳ được theo dõi liên tục. Em nào chưa theo kịp sẽ được giáo viên kèm lại sớm, không để dồn đến cuối kỳ.' },
        { title: 'Tư vấn chọn tổ hợp môn và hướng nghiệp', text: 'Từ lớp 10, giáo viên chủ nhiệm cùng giáo viên bộ môn trao đổi với học sinh và phụ huynh để chọn hướng học phù hợp với năng lực và dự định nghề nghiệp.' },
        { title: 'Phối hợp chặt chẽ với gia đình', text: 'Phụ huynh nắm tình hình học tập, chuyên cần và học phí của con qua cổng thông tin, đồng thời gặp giáo viên chủ nhiệm theo lịch và khi cần.' },
    ],
};

export const GT_FACILITIES = {
    title: 'Cơ sở vật chất hiện đại và thân thiện',
    desc: 'Không gian học tập và sinh hoạt được đầu tư để hỗ trợ tốt nhất cho việc dạy và học.',
    items: [
        { title: 'Phòng học thông minh', text: 'Máy chiếu, mạng ổn định và bảng tương tác giúp giờ học sinh động hơn.' },
        { title: 'Phòng thí nghiệm', text: 'Học sinh được tự tay thực hành Lý, Hóa, Sinh trong điều kiện an toàn.' },
        { title: 'Phòng Tin học và STEM', text: 'Nơi các em làm quen lập trình, robot và các dự án STEM.' },
        { title: 'Thư viện', text: 'Không gian đọc sách và tự học yên tĩnh, mở cửa cả giờ nghỉ trưa.' },
        { title: 'Sân thể thao', text: 'Sân chơi và nhà tập cho giờ thể dục và các giải thể thao của trường.' },
        { title: 'Phòng truyền thống và câu lạc bộ', text: 'Nơi lưu giữ kỷ niệm nhà trường và là chỗ sinh hoạt của các câu lạc bộ.' },
    ],
};

export const GT_STAFF = {
    eyebrow: 'Đội ngũ giáo viên',
    title: 'Thầy cô là người làm nên ngôi trường',
    text: 'Đội ngũ giáo viên của trường gồm những người thầy, người cô yêu nghề, được đào tạo bài bản và thường xuyên bồi dưỡng chuyên môn. Các thầy cô không chỉ giảng bài mà còn là người lắng nghe, nhắc nhở và tin vào từng học sinh. Giáo viên bộ môn phối hợp với giáo viên chủ nhiệm để theo dõi sự tiến bộ của các em qua từng kỳ.',
    points: ['Sinh hoạt chuyên môn theo tổ hằng tuần', 'Dự giờ, góp ý và chia sẻ phương pháp giảng dạy', 'Giáo viên chủ nhiệm gặp phụ huynh theo lịch và khi cần', 'Thường xuyên tham gia bồi dưỡng nâng cao nghiệp vụ'],
};

/* MẪU: nhà trường điền năm và sự kiện thật. Khi điền xong, đặt sample = false để ẩn lời nhắc. */
export const GT_HISTORY = {
    title: 'Chặng đường phát triển',
    desc: 'Những dấu mốc quan trọng trong quá trình xây dựng và trưởng thành của nhà trường.',
    sample: true,
    items: [
        { year: '[Năm]', title: 'Thành lập trường', text: '[Điền hoàn cảnh ra đời và những ngày đầu của nhà trường: số lớp, số học sinh, đội ngũ ban đầu.]' },
        { year: '[Năm]', title: 'Mở rộng cơ sở vật chất', text: '[Điền sự kiện: xây thêm khu học tập, phòng thí nghiệm, thư viện, đón học sinh đầu tiên ở khu mới.]' },
        { year: '[Năm]', title: 'Đạt chuẩn quốc gia', text: '[Điền danh hiệu, thành tích nổi bật của nhà trường theo từng giai đoạn.]' },
        { year: '2018', title: 'Triển khai Chương trình Giáo dục phổ thông mới', text: 'Nhà trường đổi mới phương pháp dạy học, tổ chức tư vấn chọn tổ hợp môn cho học sinh.' },
        { year: '2026', title: 'Chuyển đổi số', text: 'Học sinh và phụ huynh xem điểm, học phí và thông báo trực tuyến trên cổng thông tin của trường.' },
    ],
};

/* MẪU: thay bằng tên thật. Chỉ đăng thông tin khi đã được đồng ý. */
export const GT_LEADERS = {
    title: 'Ban lãnh đạo nhà trường',
    desc: 'Những người chịu trách nhiệm định hướng và đồng hành cùng tập thể sư phạm.',
    items: [
        { name: '[Họ và tên]', role: 'Hiệu trưởng', note: 'Phụ trách chung, chuyên môn và đối ngoại.' },
        { name: '[Họ và tên]', role: 'Phó hiệu trưởng', note: 'Phụ trách chuyên môn và đánh giá học sinh.' },
        { name: '[Họ và tên]', role: 'Phó hiệu trưởng', note: 'Phụ trách cơ sở vật chất và hoạt động giáo dục.' },
    ],
};

export const GT_COMMIT = {
    title: 'Cam kết của nhà trường với phụ huynh',
    items: [
        'Môi trường học tập an toàn, thân thiện, không bạo lực học đường.',
        'Thông tin điểm số, chuyên cần, học phí minh bạch và cập nhật kịp thời.',
        'Giáo viên chủ nhiệm liên hệ ngay khi con có dấu hiệu cần hỗ trợ.',
        'Các khoản thu công khai, đúng quy định, có phiếu thu rõ ràng.',
        'Lắng nghe và phản hồi mọi góp ý trong thời gian sớm nhất.',
    ],
};

export const GT_VISIT = {
    title: 'Đến thăm trường',
    desc: 'Nhà trường đón phụ huynh và học sinh tham quan vào giờ hành chính. Hãy liên hệ trước để được sắp xếp người dẫn.',
    steps: [
        { title: 'Đặt lịch', text: 'Gọi điện hoặc gửi biểu mẫu liên hệ trên website.' },
        { title: 'Tham quan', text: 'Xem phòng học, phòng thí nghiệm, thư viện và sân trường.' },
        { title: 'Trao đổi', text: 'Gặp cán bộ tuyển sinh, hỏi mọi điều về chương trình và học phí.' },
    ],
};

export const GT_CTA = {
    title: 'Sẵn sàng đồng hành cùng con em bạn',
    text: 'Hãy để lại thông tin để được tư vấn tuyển sinh, hoặc liên hệ trực tiếp văn phòng nhà trường để được hỗ trợ nhanh nhất.',
};