import { SCHOOL } from './school';

export const NOTICE = 'Đang nhận đăng ký tư vấn tuyển sinh lớp 10 năm học ' + SCHOOL.admissionYear + '.';

export const TIMELINE = [
    { year: 'Thành lập', text: 'Trường THPT Ngô Sỹ Liên bắt đầu đón học sinh khối 10 đầu tiên.' },
    { year: 'Phát triển', text: 'Mở rộng thành 18 lớp, xây dựng phòng thí nghiệm và thư viện.' },
    { year: '2018', text: 'Triển khai Chương trình GDPT 2018 cho toàn bộ các khối.' },
    { year: '2026', text: 'Khai trương cổng thông tin số cho học sinh, phụ huynh và giáo viên.' },
];

export const LEADERS = [
    { name: 'Hiệu trưởng', role: 'Quản lý chung, định hướng chuyên môn' },
    { name: 'Phó Hiệu trưởng chuyên môn', role: 'Kế hoạch dạy học, thi và kiểm tra' },
    { name: 'Phó Hiệu trưởng hoạt động', role: 'Câu lạc bộ, trải nghiệm, kỷ luật' },
];

export const DEPARTMENTS = ['Toán – Tin', 'Vật lí – Công nghệ', 'Hóa – Sinh', 'Ngữ văn', 'Lịch sử – Địa lí – GDKT&PL', 'Ngoại ngữ', 'Thể dục – Quốc phòng', 'Tổ Văn phòng'];

export type Article = { id: string; tag: string; date: string; title: string; text: string };
export const ARTICLES: Article[] = [
    { id: '1', tag: 'Tuyển sinh', date: '03/2026', title: 'Đăng ký tư vấn tuyển sinh lớp 10 – 2027–2028', text: 'Để lại thông tin trực tuyến, nhà trường sẽ liên hệ hướng dẫn hồ sơ và lịch nộp.' },
    { id: '2', tag: 'Học tập', date: '01/2026', title: 'Cổng học sinh – phụ huynh chính thức hoạt động', text: 'Xem điểm, thời khóa biểu, lịch thi và thông báo trên một hệ thống.' },
    { id: '3', tag: 'Hoạt động', date: '10/2025', title: 'Ngày hội câu lạc bộ khối 10', text: 'Hơn 20 câu lạc bộ giới thiệu hoạt động để học sinh đăng ký tham gia.' },
    { id: '4', tag: 'Học tập', date: '09/2025', title: 'Lịch kiểm tra giữa học kì I', text: 'Học sinh xem lịch thi chi tiết của từng lớp trong cổng thông tin.' },
    { id: '5', tag: 'Thông báo', date: '09/2025', title: 'Thông báo học phí và các khoản thu năm học 2025–2026', text: 'Phụ huynh xem hóa đơn và thanh toán trong mục Học phí của cổng thông tin.' },
    { id: '6', tag: 'Hoạt động', date: '08/2025', title: 'Lễ khai giảng năm học mới', text: 'Nhà trường chào đón học sinh khối 10 và công bố kế hoạch năm học.' },
];