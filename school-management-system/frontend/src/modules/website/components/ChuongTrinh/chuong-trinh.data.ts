/* =====================================================================
   NỘI DUNG TRANG "CHƯƠNG TRÌNH HỌC": toàn bộ lời văn nằm ở file này.
   Muốn sửa chữ trên trang, chỉ sửa tại đây, không đụng vào file giao diện.
   Chỗ nào có chữ "ví dụ" hoặc [ngoặc vuông] là nhà trường cần điền theo thực tế.
   Căn cứ: Chương trình Giáo dục phổ thông 2018 và Thông tư 22/2021/TT-BGDĐT.
   ===================================================================== */

/** Ảnh của trang. Bỏ ảnh vào frontend/public/images/ đúng tên bên dưới. */
export const CT_IMG = {
    hero: '/images/hero-chuong-trinh.jpg', // nền đầu trang, ngang 1920×900
    tn: '/images/chuong-trinh-tn.jpg',     // giờ thực hành Lý, Hóa, Sinh, Tin, 1200×900
    xh: '/images/chuong-trinh-xh.jpg',     // giờ học Văn, Sử, Địa, Ngoại ngữ, 1200×900
    exp: '/images/trai-nghiem.jpg',        // hoạt động trải nghiệm, hướng nghiệp, 1200×900
};

export const CT_HERO = {
    eyebrow: 'Chương trình học',
    title: 'Học vững nền tảng, chọn đúng hướng đi',
    intro: 'Nhà trường dạy theo Chương trình Giáo dục phổ thông 2018. Học sinh học các môn chung, tự chọn môn theo năng lực và dự định nghề nghiệp, được thầy cô tư vấn trước khi quyết định.',
    facts: [
        { icon: 'book', big: '35 tuần mỗi năm', small: 'Hai học kỳ, 18 và 17 tuần thực học' },
        { icon: 'user', big: '3 năm học', small: 'Lớp 10, lớp 11 và lớp 12' },
        { icon: 'flask', big: '2 hướng học', small: 'Khoa học tự nhiên, Khoa học xã hội' },
        { icon: 'spark', big: '5 môn tự chọn', small: 'Chọn theo năng lực và sở thích' },
    ],
};

export const CT_OVERVIEW = {
    eyebrow: 'Tổng quan',
    title: 'Chương trình mới giúp các em học để hiểu và biết vận dụng',
    paras: [
        'Chương trình Giáo dục phổ thông 2018 chuyển trọng tâm từ ghi nhớ kiến thức sang hình thành năng lực. Học sinh không chỉ biết đáp án mà còn biết giải thích, vận dụng vào tình huống thực tế và làm việc cùng bạn bè.',
        'Điểm khác biệt lớn nhất ở bậc trung học phổ thông là học sinh được chọn một phần môn học. Nhờ vậy, mỗi em dành nhiều thời gian hơn cho môn mình mạnh và ngành mình dự định theo đuổi, thay vì học dàn trải như trước.',
        'Nhà trường tổ chức dạy học, kiểm tra và tư vấn để việc chọn môn không phải là một quyết định vội vàng. Giáo viên chủ nhiệm, giáo viên bộ môn và phụ huynh cùng trao đổi với học sinh trước khi chốt.',
    ],
};

export const CT_YEARS = [
    { grade: 'Lớp 10', title: 'Làm quen và chọn hướng', text: 'Học sinh thích nghi với môi trường mới, củng cố nền tảng sau cấp hai. Cuối học kỳ I, nhà trường tổ chức tư vấn để các em chọn môn học lựa chọn và nhóm chuyên đề cho cả ba năm.' },
    { grade: 'Lớp 11', title: 'Đào sâu kiến thức', text: 'Các môn lựa chọn học sâu hơn, bài tập và dự án đòi hỏi khả năng phân tích. Học sinh bắt đầu tìm hiểu ngành học, trường đại học và các kỳ thi đầu vào.' },
    { grade: 'Lớp 12', title: 'Hoàn thiện và định hướng', text: 'Ôn tập hệ thống để thi tốt nghiệp trung học phổ thông, đồng thời hoàn tất lựa chọn nguyện vọng. Giáo viên chủ nhiệm đồng hành đến ngày các em nhận kết quả.' },
];

export const CT_STRUCTURE = {
    title: 'Chương trình gồm những gì',
    desc: 'Ba nhóm nội dung, mọi học sinh đều học nhóm thứ nhất và tự chọn ở hai nhóm còn lại.',
    cols: [
        {
            tag: 'Bắt buộc', title: 'Môn học và hoạt động giáo dục bắt buộc',
            text: 'Nền tảng chung cho mọi học sinh.',
            items: ['Ngữ văn', 'Toán', 'Ngoại ngữ 1', 'Lịch sử', 'Giáo dục thể chất', 'Giáo dục quốc phòng và an ninh', 'Hoạt động trải nghiệm, hướng nghiệp', 'Nội dung giáo dục của địa phương'],
        },
        {
            tag: 'Tự chọn', title: 'Môn học lựa chọn',
            text: 'Mỗi học sinh chọn 5 môn trong các môn sau, theo năng lực và ngành dự định.',
            items: ['Địa lí', 'Giáo dục kinh tế và pháp luật', 'Vật lí', 'Hóa học', 'Sinh học', 'Công nghệ', 'Tin học', 'Âm nhạc', 'Mĩ thuật'],
        },
        {
            tag: 'Chuyên sâu', title: 'Cụm chuyên đề học tập',
            text: 'Mỗi học sinh chọn 3 cụm chuyên đề của 3 môn để học sâu hơn.',
            items: ['Giúp hiểu sâu một nội dung của môn học', 'Chuẩn bị tốt cho bậc học tiếp theo', 'Làm quen với phương pháp nghiên cứu', 'Gắn với định hướng nghề nghiệp'],
        },
    ],
};

export const CT_TRACKS = {
    title: 'Hai hướng học phổ biến',
    desc: 'Nhà trường gợi ý hai nhóm tổ hợp. Học sinh vẫn có thể chọn tổ hợp khác nếu phù hợp và nhà trường sắp xếp được lớp.',
    note: 'Các tổ hợp dưới đây là ví dụ. Nhà trường điền tổ hợp thực tế đang mở lớp trong năm học.',
    items: [
        {
            key: 'tn', tone: 'a', img: 'tn', title: 'Khoa học tự nhiên',
            lead: 'Dành cho học sinh yêu thích tính toán, thí nghiệm, công nghệ và muốn đi vào ngành kỹ thuật, y dược, khoa học.',
            subjects: ['Vật lí', 'Hóa học', 'Sinh học', 'Tin học', 'Công nghệ'],
            combos: ['Ví dụ: Vật lí, Hóa học, Sinh học, Tin học, Địa lí'],
            careers: ['Kỹ thuật, công nghệ thông tin', 'Y, dược, điều dưỡng', 'Khoa học dữ liệu, trí tuệ nhân tạo', 'Kiến trúc, xây dựng'],
            fit: ['Thích giải bài toán, tìm quy luật', 'Có hứng thú với thí nghiệm và máy móc', 'Kiên nhẫn với những bài tập nhiều bước'],
        },
        {
            key: 'xh', tone: 'b', img: 'xh', title: 'Khoa học xã hội',
            lead: 'Dành cho học sinh thích đọc, viết, tìm hiểu xã hội và muốn đi vào ngành kinh tế, luật, báo chí, sư phạm, ngoại ngữ.',
            subjects: ['Địa lí', 'Giáo dục kinh tế và pháp luật', 'Lịch sử', 'Ngoại ngữ', 'Tin học'],
            combos: ['Ví dụ: Địa lí, Giáo dục kinh tế và pháp luật, Vật lí, Tin học, Âm nhạc'],
            careers: ['Kinh tế, tài chính, quản trị', 'Luật, hành chính', 'Báo chí, truyền thông', 'Sư phạm, ngoại ngữ'],
            fit: ['Thích đọc, viết và tranh luận', 'Quan tâm đến xã hội, kinh tế, pháp luật', 'Giao tiếp tốt và có khả năng trình bày'],
        },
    ],
};

export const CT_CHOOSE = {
    title: 'Nhà trường giúp các em chọn môn như thế nào',
    desc: 'Bốn bước để việc chọn tổ hợp môn dựa trên hiểu biết, không dựa vào phong trào.',
    steps: [
        { title: 'Tìm hiểu bản thân', text: 'Học sinh làm phiếu khảo sát sở thích, điểm mạnh và dự định nghề nghiệp ở tiết sinh hoạt và hoạt động trải nghiệm.' },
        { title: 'Tư vấn nhóm và cá nhân', text: 'Giáo viên chủ nhiệm và giáo viên bộ môn trao đổi dựa trên kết quả học tập và nguyện vọng của từng em.' },
        { title: 'Trao đổi với phụ huynh', text: 'Nhà trường tổ chức buổi giải thích để gia đình hiểu rõ từng tổ hợp và ngành học liên quan.' },
        { title: 'Đăng ký và sắp xếp lớp', text: 'Học sinh đăng ký nguyện vọng, nhà trường xếp lớp theo tổ hợp và thông báo trên cổng thông tin.' },
    ],
};

export const CT_EXPERIENCE = {
    title: 'Trải nghiệm và hướng nghiệp',
    desc: 'Ngoài giờ học các môn, học sinh có những hoạt động giúp hiểu bản thân và thử sức với thực tế.',
    items: [
        { icon: 'spark', title: 'Hoạt động trải nghiệm', text: 'Mỗi học kỳ có chuyên đề về bản thân, nhà trường, cộng đồng và nghề nghiệp, gắn với các hoạt động ngoài lớp học.' },
        { icon: 'flask', title: 'STEM và dự án', text: 'Học sinh làm dự án nhóm, thực hành ở phòng thí nghiệm, tự đặt câu hỏi và trình bày kết quả trước lớp.' },
        { icon: 'user', title: 'Tư vấn hướng nghiệp', text: 'Giáo viên chủ nhiệm cùng tổ tư vấn đồng hành chọn ngành học, trường đại học và chuẩn bị hồ sơ.' },
        { icon: 'shield', title: 'Kỹ năng sống', text: 'Giao tiếp, làm việc nhóm, quản lý thời gian, bảo vệ bản thân và an toàn trên mạng.' },
    ],
};

export const CT_ASSESS = {
    title: 'Cách đánh giá kết quả học tập',
    desc: 'Nhà trường đánh giá theo Thông tư 22/2021/TT-BGDĐT. Học sinh và phụ huynh xem điểm từng môn, từng kỳ ngay trên cổng thông tin.',
    parts: [
        { name: 'Thường xuyên', weight: 'Hệ số 1', text: 'Kiểm tra miệng, bài tập, sản phẩm học tập và dự án trong quá trình học.' },
        { name: 'Giữa kỳ', weight: 'Hệ số 2', text: 'Một bài đánh giá tập trung vào giữa mỗi học kỳ.' },
        { name: 'Cuối kỳ', weight: 'Hệ số 3', text: 'Bài đánh giá tổng hợp vào cuối học kỳ.' },
    ],
    formula: 'Điểm trung bình môn học kỳ = (tổng điểm thường xuyên + 2 × giữa kỳ + 3 × cuối kỳ) ÷ (số điểm thường xuyên + 5)',
    levels: [
        { name: 'Tốt', text: 'Kết quả học tập và rèn luyện đều ở mức cao nhất.' },
        { name: 'Khá', text: 'Hoàn thành tốt phần lớn yêu cầu của chương trình.' },
        { name: 'Đạt', text: 'Đáp ứng yêu cầu cơ bản của chương trình.' },
        { name: 'Chưa đạt', text: 'Cần được hỗ trợ thêm để theo kịp.' },
    ],
    levelNote: 'Kết quả học tập và kết quả rèn luyện đều được xếp theo bốn mức này.',
};

export const CT_SUPPORT = {
    title: 'Hỗ trợ để mỗi em theo kịp và vươn xa',
    items: [
        { title: 'Kèm lại học sinh chưa theo kịp', text: 'Giáo viên bộ môn phát hiện sớm và tổ chức phụ đạo nhỏ, tránh để hổng kiến thức kéo dài.' },
        { title: 'Bồi dưỡng học sinh có năng khiếu', text: 'Các em có thế mạnh được giao thêm bài nâng cao và khuyến khích tham gia các cuộc thi học thuật.' },
        { title: 'Ôn tập thi tốt nghiệp', text: 'Học sinh lớp 12 được ôn tập hệ thống theo tổ hợp môn, có các bài thi thử để làm quen áp lực phòng thi.' },
        { title: 'Theo dõi tiến bộ qua cổng thông tin', text: 'Phụ huynh xem điểm và nhận xét của giáo viên sau mỗi đợt kiểm tra để cùng đồng hành với con.' },
    ],
};

export const CT_FAQ = {
    title: 'Câu hỏi thường gặp về chương trình',
    items: [
        { q: 'Học sinh chọn môn từ khi nào?', a: 'Việc chọn môn học lựa chọn và cụm chuyên đề được thực hiện ngay từ lớp 10. Nhà trường tổ chức tư vấn vào cuối học kỳ I để học sinh và phụ huynh có thời gian cân nhắc.' },
        { q: 'Chọn rồi có đổi được tổ hợp không?', a: 'Việc đổi tổ hợp phụ thuộc vào quy định và khả năng sắp xếp lớp của nhà trường. Phụ huynh nên trao đổi sớm với giáo viên chủ nhiệm nếu con có nhu cầu thay đổi.' },
        { q: 'Chọn Khoa học xã hội thì có thi được khối truyền thống không?', a: 'Kỳ thi đại học hiện xét theo tổ hợp môn. Vì vậy học sinh nên tìm hiểu kỹ yêu cầu của ngành và trường mình muốn vào, rồi nhờ giáo viên tư vấn chọn tổ hợp phù hợp.' },
        { q: 'Điểm số được tính như thế nào?', a: 'Điểm thường xuyên tính hệ số 1, giữa kỳ hệ số 2 và cuối kỳ hệ số 3. Hệ thống của trường tự tính điểm trung bình môn để học sinh và phụ huynh xem trực tuyến.' },
        { q: 'Phụ huynh xem kết quả học tập ở đâu?', a: 'Phụ huynh và học sinh đăng nhập cổng thông tin của trường bằng tài khoản do nhà trường cấp để xem điểm, nhận xét, thời khóa biểu và thông báo.' },
    ],
};

export const CT_CTA = {
    title: 'Cần tư vấn chọn tổ hợp môn cho con?',
    text: 'Để lại số điện thoại, giáo viên tư vấn sẽ gọi lại và giải thích từng hướng học phù hợp với năng lực của con.',
};