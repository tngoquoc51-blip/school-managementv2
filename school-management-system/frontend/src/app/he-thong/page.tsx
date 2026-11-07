import Link from 'next/link';
import '../home.css';

/* ===================================================================
   CỔNG THÔNG TIN ĐIỆN TỬ TẬP TRUNG – TRƯỜNG THPT NGÔ SĨ LIÊN
   http://localhost:3000/he-thong
   Thiết kế chuẩn hệ thống giáo dục số 4.0, đồng bộ nhận diện thương hiệu.
   =================================================================== */

const MAIN_PORTALS = [
    {
        key: 'student',
        href: '/login/student',
        theme: 'card-student',
        roleBadge: 'Dành cho Học sinh',
        name: 'Cổng Học sinh',
        desc: 'Tra cứu kết quả học tập, thời khóa biểu, điểm danh, xem nhận xét của giáo viên và nộp học phí trực tuyến.',
        tasks: ['Xem điểm số các môn', 'Thời khóa biểu & lịch thi', 'Sổ đầu bài & nhận xét', 'Theo dõi học phí trực tuyến'],
        icon: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
        ),
        btnText: 'Đăng nhập Cổng Học sinh',
    },
    {
        key: 'teacher',
        href: '/login/teacher',
        theme: 'card-teacher',
        roleBadge: 'Dành cho Giáo viên',
        name: 'Cổng Giáo viên',
        desc: 'Điểm danh điện tử từng tiết, nhập điểm thường xuyên & định kỳ, ký sổ đầu bài và quản lý lớp chủ nhiệm.',
        tasks: ['Điểm danh tiết học', 'Nhập điểm môn & tính ĐTB', 'Ký sổ đầu bài số', 'Sổ theo dõi chủ nhiệm'],
        icon: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
            </svg>
        ),
        btnText: 'Đăng nhập Cổng Giáo viên',
    },
    {
        key: 'parent',
        href: '/login/parent',
        theme: 'card-parent',
        roleBadge: 'Dành cho Phụ huynh',
        name: 'Cổng Phụ huynh',
        desc: 'Sổ liên lạc điện tử 24/7, theo dõi chuyên cần, nhận thông báo kịp thời từ nhà trường và giáo viên chủ nhiệm.',
        tasks: ['Sổ liên lạc điện tử', 'Theo dõi điểm danh hàng ngày', 'Nhận thông báo từ GVCN', 'Thanh toán học phí online'],
        icon: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
        btnText: 'Đăng nhập Cổng Phụ huynh',
    },
    {
        key: 'academic',
        href: '/login/academic',
        theme: 'card-academic',
        roleBadge: 'Dành cho Giáo vụ',
        name: 'Cổng Giáo vụ & Đào tạo',
        desc: 'Quản lý hồ sơ học sinh toàn trường, phân công chuyên môn giảng dạy, xếp thời khóa biểu và tổng kết học kỳ.',
        tasks: ['Quản lý hồ sơ học sinh', 'Xếp lớp & phân công dạy', 'Xếp thời khóa biểu số', 'Báo cáo tổng kết TT 22'],
        icon: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
            </svg>
        ),
        btnText: 'Đăng nhập Cổng Giáo vụ',
    },
];

const DIGITAL_FEATURES = [
    {
        title: 'Điểm danh điện tử 4.0',
        desc: 'Ghi nhận chuyên cần từng tiết học. Tự động gửi thông báo đến sổ liên lạc của phụ huynh khi học sinh vắng hoặc đi muộn.',
        icon: '✓',
    },
    {
        title: 'Sổ đầu bài số hóa',
        desc: 'Giáo viên ký nhận xét, đánh giá tiết học trực tiếp trên máy tính hoặc điện thoại, thay thế hoàn toàn sổ giấy truyền thống.',
        icon: '📝',
    },
    {
        title: 'Quản lý điểm Thông tư 22',
        desc: 'Chuẩn hóa quy chế đánh giá xếp loại theo Thông tư 22/2021/TT-BGDĐT. Tự động tính điểm trung bình môn và xếp loại học tập.',
        icon: '📊',
    },
    {
        title: 'Thời khóa biểu thông minh',
        desc: 'Tra cứu lịch học và lịch dạy theo thời gian thực. Cập nhật tức thời khi có lịch dạy thay hoặc đổi phòng bộ môn.',
        icon: '📅',
    },
    {
        title: 'Sổ liên lạc điện tử 24/7',
        desc: 'Kênh kết nối chính thống giữa Nhà trường và Gia đình. Phụ huynh nắm bắt kết quả học tập và rèn luyện của con mọi lúc mọi nơi.',
        icon: '💬',
    },
    {
        title: 'Học phí & Hóa đơn điện tử',
        desc: 'Minh bạch các khoản thu, hỗ trợ thanh toán học phí trực tuyến an toàn qua mã QR ngân hàng hoặc cổng thanh toán số.',
        icon: '💳',
    },
];

export default function PortalPage() {
    return (
        <div className="home-wrapper">
            {/* 1. TOPBAR THÔNG TIN LIÊN HỆ */}
            <div className="portal-topbar">
                <div className="home-container portal-topbar-in">
                    <div className="portal-topbar-left">
                        <span className="portal-top-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span>48 Ngô Sĩ Liên, TP. Bắc Giang</span>
                        </span>
                        <span className="portal-top-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span>Hệ thống trực tuyến 24/7</span>
                        </span>
                    </div>

                    <div className="portal-topbar-right">
                        <span className="portal-hotline">
                            Hotline Kỹ thuật: <b>0988 123 456</b>
                        </span>
                        <Link href="/" className="portal-back-btn">
                            ← Về Website trường
                        </Link>
                    </div>
                </div>
            </div>

            {/* 2. HEADER CHÍNH */}
            <header className="home-header">
                <div className="home-container home-header-inner">
                    <Link href="/" className="home-logo" aria-label="Trường THPT Ngô Sĩ Liên - Trang chủ">
                        <img
                            src="/images/logo-thpt-ngo-sy-lien.png"
                            alt="Logo THPT Ngô Sĩ Liên"
                            className="home-logo-img"
                        />
                        <div className="home-logo-text">
                            <div className="home-logo-title-row">
                                <span className="home-logo-title">THPT Ngô Sĩ Liên</span>
                                <span className="home-logo-tag">Chuẩn QG</span>
                            </div>
                            <span className="home-logo-sub">Cổng Thông Tin Quản Lý &amp; Dịch Vụ Học Đường</span>
                        </div>
                    </Link>

                    <nav className="home-nav" aria-label="Điều hướng cổng thông tin">
                        <Link href="/">Website trường</Link>
                        <a href="#cong-truy-cap" className="active">Cổng truy cập</a>
                        <a href="#chuc-nang">Tính năng số hóa</a>
                        <a href="#quan-tri">Cổng nội bộ</a>
                    </nav>

                    <div className="home-header-acts">
                        <Link href="/" className="btn-header-site">
                            <span>Website Giới thiệu</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                {/* 3. HERO CỔNG THÔNG TIN */}
                <section className="portal-hero">
                    <div className="home-container portal-hero-grid">
                        <div>
                            <div className="portal-badge">
                                <span>🏛️ HỆ SINH THÁI GIÁO DỤC SỐ 4.0</span>
                            </div>

                            <h1 className="home-title">
                                Cổng Thông Tin Điện Tử &amp; Quản Trị Học Đường Tập Trung
                            </h1>

                            <p className="home-desc">
                                Nền tảng số hóa liên thông kết nối <b>Nhà trường — Giáo viên — Học sinh — Phụ huynh</b>.
                                Toàn bộ điểm số, điểm danh, thời khóa biểu và sổ liên lạc được đồng bộ theo đúng chuẩn
                                <b> Thông tư 22/2021/TT-BGDĐT</b>.
                            </p>

                            <div className="portal-quick-actions">
                                <Link href="/login/student" className="portal-act-btn act-student">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                                    </svg>
                                    <span>Cổng Học sinh</span>
                                </Link>

                                <Link href="/login/teacher" className="portal-act-btn act-teacher">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                                    </svg>
                                    <span>Cổng Giáo viên</span>
                                </Link>

                                <Link href="/login/parent" className="portal-act-btn act-parent">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                    </svg>
                                    <span>Cổng Phụ huynh</span>
                                </Link>
                            </div>

                            <p className="home-legal">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.5-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7Z" />
                                </svg>
                                <span>Bảo mật dữ liệu học đường theo tiêu chuẩn an toàn thông tin GD&amp;ĐT</span>
                            </p>
                        </div>

                        {/* WIDGET THỜI KHÓA BIỂU & HỌC TẬP THỜI GIAN THỰC */}
                        <figure className="home-notebook" aria-label="Bảng theo dõi học tập điện tử">
                            <div className="home-nb-head">
                                <div>
                                    <div className="home-nb-kicker">THPT Ngô Sĩ Liên · Lớp 11A1</div>
                                    <div className="home-nb-title">Thời khóa biểu hôm nay</div>
                                </div>
                                <span className="nb-badge-live">
                                    <span className="nb-pulse"></span>
                                    <span>Trực tuyến</span>
                                </span>
                            </div>

                            <ol className="home-nb-list">
                                <li className="home-nb-row">
                                    <span className="home-nb-period">1</span>
                                    <div className="home-nb-body">
                                        <div className="home-nb-subject">Toán học</div>
                                        <div className="home-nb-meta">Thầy Hoàng Nam · Phòng 201</div>
                                    </div>
                                    <span className="home-nb-time">07:00 – 07:45</span>
                                </li>

                                <li className="home-nb-row">
                                    <span className="home-nb-period">2</span>
                                    <div className="home-nb-body">
                                        <div className="home-nb-subject">Ngữ văn</div>
                                        <div className="home-nb-meta">Cô Minh Tâm · Phòng 201</div>
                                    </div>
                                    <span className="home-nb-time">07:50 – 08:35</span>
                                </li>

                                <li className="home-nb-row is-now">
                                    <span className="home-nb-period">3</span>
                                    <div className="home-nb-body">
                                        <div className="home-nb-subject">
                                            <span>Vật lí</span>
                                            <span className="home-nb-now">Tiết hiện tại</span>
                                        </div>
                                        <div className="home-nb-meta">Thầy Đức Thịnh · Phòng TN Lý 1</div>
                                    </div>
                                    <span className="home-nb-time">08:55 – 09:40</span>
                                </li>

                                <li className="home-nb-row">
                                    <span className="home-nb-period">4</span>
                                    <div className="home-nb-body">
                                        <div className="home-nb-subject">Tiếng Anh (IELTS Focus)</div>
                                        <div className="home-nb-meta">Cô Thu Hương · Phòng Lab 2</div>
                                    </div>
                                    <span className="home-nb-time">09:45 – 10:30</span>
                                </li>
                            </ol>

                            <figcaption className="home-nb-foot">
                                <span>Sĩ số lớp: <b>42</b> · Có mặt: <b>42/42 (100%)</b></span>
                                <span>Điểm số mới: <b>Toán (9.0)</b></span>
                            </figcaption>
                        </figure>
                    </div>
                </section>

                {/* 4. KHU VỰC TRỌNG TÂM: LƯỚI 4 CỔNG TRUY CẬP THEO VAI TRÒ */}
                <section id="cong-truy-cap" className="portal-section">
                    <div className="home-container">
                        <div className="portal-sec-head">
                            <span className="portal-sec-badge">HỆ THỐNG PHÂN QUYỀN TRUY CẬP</span>
                            <h2 className="portal-sec-title">Chọn Cổng Đăng Nhập Của Bạn</h2>
                            <p className="portal-sec-desc">
                                Mỗi vị trí được cấp tài khoản chuyên biệt với phân quyền tương ứng.
                                Vui lòng chọn đúng cổng vai trò để truy cập tiện ích học đường.
                            </p>
                        </div>

                        <div className="roles-bento-grid">
                            {MAIN_PORTALS.map((portal) => (
                                <article key={portal.key} className={`role-bento-card ${portal.theme}`}>
                                    <div className="role-card-accent"></div>

                                    <div>
                                        <div className="role-top-row">
                                            <div className="role-icon-box">
                                                {portal.icon}
                                            </div>
                                            <span className="role-role-badge">
                                                {portal.roleBadge}
                                            </span>
                                        </div>

                                        <h3 className="role-name">{portal.name}</h3>
                                        <p className="role-desc">{portal.desc}</p>

                                        <ul className="role-tasks-list">
                                            {portal.tasks.map((t) => (
                                                <li key={t} className="role-task-item">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                    <span>{t}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <Link href={portal.href} className="btn-login-portal">
                                        <span>{portal.btnText}</span>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                            <path d="M5 12h14" />
                                            <path d="m12 5 7 7-7 7" />
                                        </svg>
                                    </Link>
                                </article>
                            ))}
                        </div>

                        {/* CỔNG NGHIỆP VỤ NỘI BỘ DÀNH CHO CÁN BỘ & QUẢN TRỊ */}
                        <div id="quan-tri" className="internal-strip">
                            <div className="internal-strip-info">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f2c59" strokeWidth="2">
                                    <rect width="18" height="18" x="3" y="3" rx="2" />
                                    <path d="M7 7h10" />
                                    <path d="M7 12h10" />
                                    <path d="M7 17h10" />
                                </svg>
                                <div>
                                    <b>Cổng Quản Trị &amp; Nghiệp Vụ Chuyên Trách:</b>
                                    <span> Dành cho Ban Giám hiệu, Kế toán và Cán bộ Quản trị hệ thống</span>
                                </div>
                            </div>

                            <div className="internal-strip-links">
                                <Link href="/login/bgh" className="internal-pill-link">
                                    <span>Cổng Ban Giám Hiệu</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                </Link>

                                <Link href="/login/accountant" className="internal-pill-link">
                                    <span>Cổng Kế Toán / Công Nợ</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                </Link>

                                <Link href="/login/admin" className="internal-pill-link">
                                    <span>Quản Trị Hệ Thống</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 5. CÁC TÍNH NĂNG SỐ HÓA TIÊU BIỂU */}
                <section id="chuc-nang" className="features-sec">
                    <div className="home-container">
                        <div className="portal-sec-head">
                            <span className="portal-sec-badge">TIỆN ÍCH GIÁO DỤC SỐ</span>
                            <h2 className="portal-sec-title">Những Nghiệp Vụ Hệ Thống Làm Thay Sổ Giấy</h2>
                            <p className="portal-sec-desc">
                                Toàn bộ quy trình thủ công phức tạp được tinh gọn, minh bạch và tra cứu tức thời.
                            </p>
                        </div>

                        <div className="features-grid">
                            {DIGITAL_FEATURES.map((f) => (
                                <div key={f.title} className="feature-box">
                                    <div className="feature-icon">{f.icon}</div>
                                    <h3 className="feature-title">{f.title}</h3>
                                    <p className="feature-text">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            {/* 6. CHÂN TRANG CỔNG THÔNG TIN */}
            <footer className="home-footer">
                <div className="home-container">
                    <div className="home-footer-grid">
                        <div className="footer-school-brand">
                            <div className="footer-school-name">TRƯỜNG TRUNG HỌC PHỔ THÔNG NGÔ SĨ LIÊN</div>
                            <div className="footer-school-meta">
                                Địa chỉ: Số 48 Đường Ngô Sĩ Liên, Phường Ngô Quyền, TP. Bắc Giang
                            </div>
                            <div className="footer-school-meta">
                                Hotline Kỹ thuật &amp; Tuyển sinh: 0988 123 456 · Email: tuyensinh@thptngosylien.edu.vn
                            </div>
                        </div>

                        <nav className="home-footer-links" aria-label="Liên kết chân trang">
                            <Link href="/">Website trường</Link>
                            <Link href="/login/student">Cổng Học sinh</Link>
                            <Link href="/login/teacher">Cổng Giáo viên</Link>
                            <Link href="/login/parent">Cổng Phụ huynh</Link>
                            <Link href="/login/academic">Cổng Giáo vụ</Link>
                        </nav>
                    </div>

                    <p className="home-footer-copy">
                        © {new Date().getFullYear()} Cổng Thông Tin Điện Tử · Trường THPT Ngô Sĩ Liên · All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
