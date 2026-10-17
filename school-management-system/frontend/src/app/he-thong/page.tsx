import Link from 'next/link';
import '../home.css';

/* CỔNG THÔNG TIN – http://localhost:3000/he-thong
   (Trang chủ / nay là website giới thiệu trường. Trang này là nơi các vai trò chọn cổng đăng nhập.)
   Chỉ: Giáo viên · Giáo vụ · Học sinh · Phụ huynh
   KHÔNG hiện: Quản trị · Ban Giám hiệu · Kế toán */

const roles = [
    {
        href: '/login/teacher',
        name: 'Giáo viên',
        note: 'Giảng dạy, chủ nhiệm và tổ trưởng',
        tasks: ['Điểm danh', 'Sổ đầu bài', 'Nhập điểm', 'Sổ chủ nhiệm'],
        icon: (
            <path d="M4 5a2 2 0 0 1 2-2h13v15H6a1 1 0 0 0 0 2h13v1H6a3 3 0 0 1-3-3V5h1Zm4 2v2h8V7H8Z" />
        ),
    },
    {
        href: '/login/academic',
        name: 'Giáo vụ',
        note: 'Quản lý học sinh, lớp, thời khóa biểu',
        tasks: ['Hồ sơ học sinh', 'Xếp lớp', 'Thời khóa biểu', 'Tổng kết'],
        icon: (
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 3h6v4H9V3zM9 12h6M9 16h4" />
        ),
    },
    {
        href: '/login/student',
        name: 'Học sinh',
        note: 'Theo dõi việc học của mình',
        tasks: ['Xem điểm', 'Thời khóa biểu', 'Nhận xét', 'Thông báo'],
        icon: (
            <path d="m12 3 10 5-10 5L2 8l10-5Zm-6 9.2 6 3 6-3V16c0 1.7-2.7 3-6 3s-6-1.3-6-3v-3.8ZM21 9.5V16h-1.5V10.3L21 9.5Z" />
        ),
    },
    {
        href: '/login/parent',
        name: 'Phụ huynh',
        note: 'Đồng hành cùng con',
        tasks: ['Kết quả học tập', 'Sổ liên lạc điện tử', 'Thông báo từ trường'],
        icon: (
            <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 19c0-2.8 2.7-5 6-5s6 2.2 6 5v1H2v-1Zm13 1v-1c0-1.5-.5-2.8-1.4-3.9.7-.2 1.4-.1 2.4-.1 3 0 6 1.7 6 4.5V20h-7Z" />
        ),
    },
];

const features = [
    ['Điểm danh', 'Ghi nhận có mặt, vắng, đi muộn theo từng tiết và từng lớp.'],
    ['Sổ đầu bài', 'Ghi nội dung bài dạy, nhận xét tiết học và xếp loại tiết.'],
    ['Quản lý điểm', 'Nhập điểm thường xuyên, giữa kỳ, cuối kỳ; tự tính điểm trung bình môn.'],
    ['Thời khóa biểu', 'Xếp và xem lịch dạy, lịch học theo giáo viên, lớp và phòng.'],
    ['Sổ liên lạc điện tử', 'Nhà trường và phụ huynh trao đổi kết quả, nhận xét và thông báo.'],
    ['Báo cáo thống kê', 'Tổng hợp sĩ số, chuyên cần, học lực và hạnh kiểm theo kỳ, theo năm.'],
];

const stats = [
    ['12+', 'Phân hệ chức năng'],
    ['4', 'Cổng công khai'],
    ['TT 22', 'Đánh giá theo Thông tư 22'],
    ['24/7', 'Truy cập mọi lúc, mọi nơi'],
];

export default function Home() {
    return (
        <div className="home-wrapper">
            <header className="home-header">
                <div className="home-container home-header-inner">
                    <Link href="/" className="home-logo" aria-label="Về website giới thiệu trường">
                        <div className="home-logo-mark" aria-hidden="true">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                                <path d="m12 3 10 5-10 5L2 8l10-5Zm-6 9.2 6 3 6-3V16c0 1.7-2.7 3-6 3s-6-1.3-6-3v-3.8Z" />
                            </svg>
                        </div>
                        <div>
                            <div className="home-logo-title">Hệ thống Quản lý</div>
                            <div className="home-logo-sub">Trường Trung học Phổ thông</div>
                        </div>
                    </Link>

                    <nav className="home-nav" aria-label="Điều hướng chính">
                        <Link href="/">Website trường</Link>
                        <a href="#vai-tro">Cổng truy cập</a>
                        <a href="#chuc-nang">Chức năng</a>
                    </nav>

                    <Link href="/login/teacher" className="home-btn home-btn-primary">
                        Đăng nhập
                    </Link>
                </div>
            </header>

            <main>
                <section className="home-hero">
                    <div className="home-container home-hero-grid">
                        <div>
                            <h1 className="home-title">
                                Mọi sổ sách của nhà trường, gọn trong một hệ thống
                            </h1>
                            <p className="home-desc">
                                Giáo viên, giáo vụ, học sinh và phụ huynh cùng làm việc trên
                                một nguồn dữ liệu: điểm, điểm danh, sổ đầu bài và thời khóa biểu.
                            </p>
                            <div className="home-hero-actions">
                                <Link href="/login/teacher" className="home-btn home-btn-primary">
                                    Đăng nhập hệ thống
                                </Link>
                                <a href="#vai-tro" className="home-btn home-btn-outline">
                                    Chọn cổng truy cập
                                </a>
                            </div>
                            <p className="home-legal">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#13305a" aria-hidden="true">
                                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.200 14.500-4-4 1.400-1.400 2.600 2.600 5.600-5.600 1.400 1.400-7 7Z" />
                                </svg>
                                Đánh giá, xếp loại học sinh theo Thông tư 22/2021/TT-BGDĐT.
                            </p>
                        </div>

                        <figure className="home-notebook" style={{ margin: 0 }} aria-label="Ví dụ thời khóa biểu trong ngày">
                            <div className="home-nb-head">
                                <div className="home-nb-kicker">Thời khóa biểu hôm nay · Lớp 11A2 (dữ liệu mẫu)</div>
                                <div className="home-nb-title">Sáng thứ Sáu</div>
                            </div>
                            <ol className="home-nb-list">
                                <li className="home-nb-row">
                                    <span className="home-nb-period">1</span>
                                    <div className="home-nb-body">
                                        <div className="home-nb-subject">Toán</div>
                                        <div className="home-nb-meta">Phòng 201</div>
                                    </div>
                                    <span className="home-nb-time">7:00</span>
                                </li>
                                <li className="home-nb-row">
                                    <span className="home-nb-period">2</span>
                                    <div className="home-nb-body">
                                        <div className="home-nb-subject">Ngữ văn</div>
                                        <div className="home-nb-meta">Phòng 201</div>
                                    </div>
                                    <span className="home-nb-time">7:50</span>
                                </li>
                                <li className="home-nb-row is-now">
                                    <span className="home-nb-period">3</span>
                                    <div className="home-nb-body">
                                        <div className="home-nb-subject">
                                            Vật lí<span className="home-nb-now">Đang học</span>
                                        </div>
                                        <div className="home-nb-meta">Phòng thí nghiệm 1</div>
                                    </div>
                                    <span className="home-nb-time">8:55</span>
                                </li>
                                <li className="home-nb-row">
                                    <span className="home-nb-period">4</span>
                                    <div className="home-nb-body">
                                        <div className="home-nb-subject">Tiếng Anh</div>
                                        <div className="home-nb-meta">Phòng 203</div>
                                    </div>
                                    <span className="home-nb-time">9:45</span>
                                </li>
                            </ol>
                            <figcaption className="home-nb-foot">Sĩ số 42 · Có mặt 41 · Vắng có phép 1</figcaption>
                        </figure>
                    </div>
                </section>

                <section id="vai-tro" className="home-section home-section-white">
                    <div className="home-container">
                        <div className="home-section-head">
                            <h2 className="home-section-title">Chọn cổng truy cập của bạn</h2>
                            <p className="home-section-desc">
                                Mỗi vai trò có giao diện và quyền hạn riêng. Bạn cần đăng nhập để vào cổng tương ứng.
                            </p>
                        </div>

                        <ul className="home-roles">
                            {roles.map((r) => (
                                <li key={r.href}>
                                    <Link href={r.href} className="home-role">
                                        <div className="home-role-icon" aria-hidden="true">
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                                {r.icon}
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="home-role-name">{r.name}</h3>
                                            <p className="home-role-note">{r.note}</p>
                                        </div>
                                        <ul className="home-role-tasks">
                                            {r.tasks.map((t) => (
                                                <li key={t}>{t}</li>
                                            ))}
                                        </ul>
                                        <span className="home-role-go">Vào cổng</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                <section id="chuc-nang" className="home-section">
                    <div className="home-container">
                        <div className="home-section-head">
                            <h2 className="home-section-title">Những việc hệ thống làm thay sổ giấy</h2>
                            <p className="home-section-desc">
                                Các nghiệp vụ quen thuộc của trường THPT, được số hóa và liên thông với nhau.
                            </p>
                        </div>

                        <dl className="home-features">
                            {features.map(([name, desc]) => (
                                <div key={name} className="home-feature">
                                    <dt>{name}</dt>
                                    <dd>{desc}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </section>

                <section className="home-stats" aria-label="Số liệu về hệ thống">
                    <div className="home-container">
                        <dl className="home-stats-grid">
                            {stats.map(([num, label]) => (
                                <div key={label} className="home-stat">
                                    <dt>{num}</dt>
                                    <dd>{label}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </section>
            </main>

            <footer className="home-footer">
                <div className="home-container">
                    <div className="home-footer-grid">
                        <div>
                            <div className="home-footer-name">Hệ thống Quản lý Trường THPT</div>
                            <div>Cổng dành cho Giáo viên · Giáo vụ · Học sinh · Phụ huynh</div>
                        </div>
                        <nav className="home-footer-links" aria-label="Liên kết nhanh">
                            <Link href="/">Website trường</Link>
                            <Link href="/login/teacher">Đăng nhập</Link>
                            <a href="#vai-tro">Cổng truy cập</a>
                            <a href="#chuc-nang">Chức năng</a>
                        </nav>
                    </div>
                    <p className="home-footer-copy">
                        © {new Date().getFullYear()} Hệ thống Quản lý Trường THPT · Laravel &amp; Next.js
                    </p>
                </div>
            </footer>
        </div>
    );
}