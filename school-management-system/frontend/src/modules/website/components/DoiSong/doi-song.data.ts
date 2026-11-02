/* =====================================================================
   NỘI DUNG TRANG "ĐỜI SỐNG HỌC ĐƯỜNG": toàn bộ lời văn nằm ở file này.
   Muốn sửa chữ trên trang, chỉ sửa tại đây, không đụng vào file giao diện.
   Chỗ nào ghi "mẫu" hoặc [ngoặc vuông] là nhà trường cần thay bằng thông tin thật.
   ===================================================================== */

/** Ảnh của trang. Bỏ ảnh vào frontend/public/images/ đúng tên bên dưới.
 Ảnh nào chưa có thì hiện nền màu (ảnh đầu trang sẽ dùng hero-chung.jpg). */
export const DS_IMG = {
    hero: '/images/hero-doi-song.jpg',     // nền đầu trang, ngang 1920×900
    meal: '/images/doi-song-an-uong.jpg',  // bữa trưa bán trú hoặc nhà ăn, 1200×900
    space: [
        { src: '/images/doi-song-1.jpg', title: 'Sân trường', text: 'Nơi tập thể dục giữa giờ và những buổi chào cờ đầu tuần.' },
        { src: '/images/doi-song-2.jpg', title: 'Nhà đa năng', text: 'Sân chơi cho bóng rổ, cầu lông, võ thuật và các buổi biểu diễn.' },
        { src: '/images/doi-song-3.jpg', title: 'Nhà ăn bán trú', text: 'Bữa trưa dinh dưỡng, bàn ghế sạch sẽ, có nhân viên phục vụ.' },
        { src: '/images/doi-song-4.jpg', title: 'Phòng chức năng', text: 'Phòng nhạc, phòng mỹ thuật, phòng STEM cho các câu lạc bộ.' },
    ],
};

export const DS_HERO = {
    eyebrow: 'Đời sống học đường',
    title: 'Học tập nghiêm túc, nhưng không chỉ có sách vở',
    intro: 'Ở trường, các em có giờ học đầy hứng khởi, có bữa trưa đủ chất, có sân chơi để vận động và có câu lạc bộ để thử sức. Đây là một ngày và những nơi các em gắn bó.',
    chips: ['Bóng đá', 'Âm nhạc', 'Robotics', 'Nhiếp ảnh', 'Tranh biện', 'Tình nguyện'],
    facts: [
        { icon: 'clock', big: 'Mở cổng 6:45', small: 'Học sinh vào lớp ổn định, không vội vàng' },
        { icon: 'spark', big: '20 câu lạc bộ', small: 'Thể thao, nghệ thuật, học thuật, kỹ năng' },
        { icon: 'shield', big: 'Bán trú an toàn', small: 'Bữa trưa dinh dưỡng, phòng nghỉ điều hòa' },
        { icon: 'user', big: 'Thầy cô sát sao', small: 'Giáo viên chủ nhiệm đồng hành mỗi ngày' },
    ],
};

export const DS_INTRO = {
    eyebrow: 'Triết lý',
    quote: 'Một ngôi trường tốt không chỉ cho các em điểm số. Đó là nơi các em học cách sống cùng nhau.',
    paras: [
        'Tuổi học trò chỉ có một lần. Vì vậy, nhà trường không muốn các em chỉ nhớ về những bài kiểm tra. Chúng tôi muốn các em nhớ về buổi sáng chào cờ, trận bóng giờ ra chơi, buổi diễn văn nghệ đầu tiên và người bạn thân gặp ở câu lạc bộ.',
        'Mỗi ngày ở trường được sắp xếp có học, có chơi, có nghỉ. Giờ giấc rõ ràng giúp các em học hiệu quả, còn các hoạt động ngoài giờ giúp các em khỏe mạnh, tự tin và biết làm việc cùng người khác.',
    ],
};

export const DS_DAY = {
    title: 'Một ngày ở trường',
    desc: 'Lịch học mẫu. Thời gian cụ thể có thể thay đổi theo từng học kỳ và được thông báo trên cổng thông tin.',
    items: [
        { time: '06:45', title: 'Khởi đầu ngày mới', text: 'Cổng trường mở đón học sinh trong tiếng nhạc du dương, các em ổn định vị trí, chuẩn bị tâm thế hào hứng cho ngày học.' },
        { time: '07:00 – 11:15', title: 'Các tiết học văn hóa buổi sáng', text: 'Tiếp thu tri thức trọng tâm qua các phương pháp giảng dạy tích cực, thảo luận nhóm và ứng dụng bảng tương tác.' },
        { time: '09:00', title: 'Thể dục giữa giờ và giải lao', text: '15 phút tập thể dục toàn trường, nghe bản tin phát thanh học đường và sinh hoạt nhẹ nhàng tại sân trường.' },
        { time: '11:30 – 13:30', title: 'Nghỉ trưa và bán trú', text: 'Học sinh bán trú thưởng thức bữa trưa dinh dưỡng tại nhà ăn sạch sẽ và nghỉ trưa tại phòng nghỉ điều hòa.' },
        { time: '13:45 – 16:30', title: 'Học chuyên đề, STEM và kỹ năng', text: 'Các tiết thực hành phòng thí nghiệm, học ngoại ngữ tăng cường hoặc bồi dưỡng học sinh giỏi.' },
        { time: '16:30 – 17:45', title: 'Sinh hoạt câu lạc bộ và thể thao', text: 'Sân cỏ, nhà đa năng và các phòng chức năng rộn ràng tiếng cười đùa trong giờ sinh hoạt câu lạc bộ yêu thích.' },
    ],
};

export const DS_CLUBS = {
    title: 'Câu lạc bộ',
    desc: 'Học sinh chọn câu lạc bộ theo sở thích và có thể tham gia nhiều nơi, miễn là cân đối được việc học.',
    groups: [
        {
            key: 'tt', label: 'Thể thao và thể chất', icon: 'ball',
            lead: 'Rèn sức khỏe, tinh thần đồng đội và bản lĩnh thi đấu.',
            clubs: [
                { name: 'NSL Football Club', sub: 'Bóng đá', text: 'Tập luyện đều đặn và thi đấu giao hữu với các trường bạn.' },
                { name: 'Basketball Titans', sub: 'Bóng rổ', text: 'Đội tuyển tham gia các giải bóng rổ học sinh trong năm.' },
                { name: 'Badminton Stars', sub: 'Cầu lông', text: 'Sân chơi cho người mới bắt đầu và cả người đã có nền tảng.' },
                { name: 'Võ thuật cổ truyền và Taekwondo', sub: 'Võ thuật', text: 'Rèn thể lực, tính kỷ luật và kỹ năng tự vệ.' },
                { name: 'Bóng chuyền học sinh', sub: 'Bóng chuyền', text: 'Thi đấu giữa các lớp và các khối trong hội thao.' },
            ],
        },
        {
            key: 'nt', label: 'Nghệ thuật và sáng tạo', icon: 'spark',
            lead: 'Nơi các em thể hiện cảm xúc và cá tính riêng.',
            clubs: [
                { name: 'CLB Âm nhạc và Ban nhạc Acoustic', sub: 'Âm nhạc', text: 'Hát, chơi nhạc cụ và biểu diễn trong các sự kiện của trường.' },
                { name: 'CLB Vũ đạo Hiện đại (Dance Crew)', sub: 'Nhảy hiện đại', text: 'Tập nhảy, dàn dựng tiết mục cho ngày hội và lễ kỷ niệm.' },
                { name: 'CLB Nhiếp ảnh và Media (NSL Media)', sub: 'Truyền thông', text: 'Chụp ảnh, quay phim, dựng clip ghi lại đời sống nhà trường.' },
                { name: 'CLB Hội họa và Mỹ thuật ứng dụng', sub: 'Mỹ thuật', text: 'Vẽ, trang trí không gian trường và thiết kế ấn phẩm.' },
                { name: 'CLB Kịch nghệ và Điện ảnh', sub: 'Sân khấu', text: 'Dựng kịch ngắn, phim ngắn và tổ chức các buổi diễn.' },
            ],
        },
        {
            key: 'hl', label: 'Học thuật và công nghệ', icon: 'flask',
            lead: 'Học sâu hơn, hỏi nhiều hơn và làm ra sản phẩm thật.',
            clubs: [
                { name: 'CLB Tiếng Anh và Tranh biện (NSL English Club)', sub: 'Ngoại ngữ', text: 'Giao tiếp tiếng Anh, tranh biện và luyện kỹ năng thuyết trình.' },
                { name: 'CLB Lập trình và Robotics (STEM Lab)', sub: 'Công nghệ', text: 'Lập trình, lắp ráp robot và làm dự án STEM.' },
                { name: 'CLB Toán học và Những con số kỳ diệu', sub: 'Toán học', text: 'Giải bài toán hay, luyện tư duy logic và chuẩn bị cho các kỳ thi.' },
                { name: 'CLB Khoa học thực nghiệm', sub: 'Khoa học', text: 'Tự tay làm thí nghiệm Lý, Hóa, Sinh thú vị ngoài giờ học.' },
                { name: 'CLB Sách và Văn hóa đọc', sub: 'Đọc sách', text: 'Chia sẻ sách hay, tổ chức buổi trò chuyện với tác giả.' },
            ],
        },
        {
            key: 'kn', label: 'Kỹ năng và xã hội', icon: 'user',
            lead: 'Học cách lãnh đạo, giúp đỡ và gắn kết với cộng đồng.',
            clubs: [
                { name: 'Đội Thanh niên Tình nguyện Ngô Sĩ Liên', sub: 'Tình nguyện', text: 'Tham gia hoạt động xã hội, hiến máu nhân đạo và mùa hè xanh.' },
                { name: 'CLB Kỹ năng mềm và Lãnh đạo trẻ', sub: 'Kỹ năng', text: 'Rèn giao tiếp, làm việc nhóm và quản lý dự án.' },
                { name: 'CLB Truyền thông và Sự kiện trường', sub: 'Sự kiện', text: 'Lên kế hoạch, dẫn chương trình và tổ chức các sự kiện của trường.' },
                { name: 'CLB Môi trường xanh', sub: 'Môi trường', text: 'Trồng cây, phân loại rác và lan tỏa lối sống xanh.' },
            ],
        },
    ],
};

/* "Dự kiến": nhà trường sửa theo kế hoạch năm học thật. */
export const DS_YEAR = {
    title: 'Một năm học nhiều dấu ấn',
    desc: 'Những hoạt động đã thành nếp của nhà trường. Lịch cụ thể được thông báo trên website và cổng thông tin.',
    note: 'Lịch dự kiến, nhà trường điều chỉnh theo kế hoạch từng năm học.',
    items: [
        { month: 'Tháng 9', title: 'Lễ khai giảng', text: 'Đón học sinh lớp 10 mới và bắt đầu năm học cùng toàn trường.' },
        { month: 'Tháng 10', title: 'Ngày hội câu lạc bộ', text: 'Các câu lạc bộ giới thiệu và chào đón thành viên mới.' },
        { month: 'Tháng 11', title: 'Ngày Nhà giáo Việt Nam 20/11', text: 'Học sinh gửi lời tri ân thầy cô qua văn nghệ và hoạt động ý nghĩa.' },
        { month: 'Tháng 12', title: 'Hội thao toàn trường', text: 'Các lớp thi đấu thể thao, cổ vũ và gắn kết tập thể.' },
        { month: 'Tháng 3', title: 'Ngày hội STEM và Đoàn 26/3', text: 'Trưng bày sản phẩm khoa học và các hoạt động của Đoàn thanh niên.' },
        { month: 'Tháng 4', title: 'Tư vấn hướng nghiệp', text: 'Gặp gỡ cựu học sinh, đại diện trường đại học và các ngành nghề.' },
        { month: 'Tháng 5', title: 'Tổng kết và lễ trưởng thành', text: 'Khép lại năm học và tiễn học sinh lớp 12 bước sang chặng mới.' },
    ],
};

export const DS_CARE = {
    eyebrow: 'Ăn uống và sức khỏe',
    title: 'Các em khỏe mạnh thì mới học tốt',
    text: 'Nhà trường chú trọng bữa ăn, giấc nghỉ và sức khỏe tinh thần của học sinh. Phụ huynh có thể yên tâm gửi con trong giờ bán trú và cả những ngày con gặp khó khăn.',
    points: [
        { title: 'Bữa trưa dinh dưỡng', text: 'Thực đơn do bộ phận bán trú xây dựng, thay đổi theo tuần và công khai cho phụ huynh.' },
        { title: 'Phòng nghỉ trưa điều hòa', text: 'Học sinh được nghỉ ngơi để chiều học tỉnh táo hơn.' },
        { title: 'Y tế học đường', text: 'Có nhân viên y tế trực trong giờ học, sơ cứu ban đầu và liên hệ gia đình khi cần.' },
        { title: 'Tư vấn tâm lý học đường', text: 'Các em có nơi chia sẻ áp lực học tập, quan hệ bạn bè hoặc chuyện gia đình.' },
    ],
};

export const DS_RULES = {
    title: 'Nền nếp và văn hóa ứng xử',
    desc: 'Những điều giúp trường học luôn là nơi an toàn và tử tế cho mọi người.',
    items: [
        { icon: 'clock', title: 'Đúng giờ', text: 'Có mặt trước giờ vào lớp, giữ nền nếp học tập và sinh hoạt.' },
        { icon: 'shield', title: 'Không bạo lực học đường', text: 'Nhà trường xử lý nghiêm mọi hành vi bắt nạt, xúc phạm và gây gổ.' },
        { icon: 'check', title: 'Trung thực', text: 'Làm bài và kiểm tra bằng sức mình, nhận lỗi khi mắc sai.' },
        { icon: 'user', title: 'Tôn trọng', text: 'Lễ phép với thầy cô, hòa nhã với bạn bè và nhân viên nhà trường.' },
        { icon: 'monitor', title: 'Dùng điện thoại đúng lúc', text: 'Sử dụng thiết bị theo hướng dẫn của giáo viên trong giờ học.' },
        { icon: 'spark', title: 'Giữ gìn trường lớp', text: 'Giữ vệ sinh, bảo quản tài sản chung và tiết kiệm điện nước.' },
    ],
};

/* MẪU: các lời chia sẻ chỉ để minh họa bố cục. Thay bằng chia sẻ thật (có sự đồng ý của người nói)
   rồi đặt sample thành false. Khi còn sample = true, trang hiện nhãn "Nội dung mẫu". */
export const DS_VOICES = {
    title: 'Tiếng nói của học sinh và phụ huynh',
    desc: 'Những điều các em và gia đình nhớ nhất về đời sống ở trường.',
    items: [
        { who: 'Học sinh lớp 10', text: 'Hồi mới vào lớp 10 mình khá nhút nhát. Nhờ câu lạc bộ nhiếp ảnh mà mình quen được nhiều bạn và dám đứng trước đông người hơn.', sample: true },
        { who: 'Học sinh lớp 11', text: 'Giờ ra chơi có thể chơi bóng rổ, buổi chiều lại sang phòng STEM làm robot. Ở trường lúc nào mình cũng có việc thú vị để làm.', sample: true },
        { who: 'Phụ huynh học sinh lớp 10', text: 'Con ăn trưa và nghỉ ngơi ở trường nên chiều về vẫn khỏe. Tôi yên tâm vì cô chủ nhiệm nhắn tin báo ngay khi con có chuyện.', sample: true },
        { who: 'Học sinh lớp 12', text: 'Ba năm ở đây mình nhớ nhất là đêm văn nghệ và những buổi tập dượt muộn cùng bạn. Đó là kỷ niệm mà điểm số không thay thế được.', sample: true },
    ],
};

export const DS_CTA = {
    title: 'Muốn tận mắt xem một ngày ở trường?',
    text: 'Đặt lịch tham quan để gặp thầy cô, thăm nhà ăn, nhà đa năng, phòng học và trò chuyện với các câu lạc bộ.',
};