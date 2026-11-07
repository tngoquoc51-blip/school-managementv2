/**
 * Liên kết từ trang Lớp học sang các trang khác.
 * Nếu đường dẫn trang của bạn khác, chỉ cần sửa `href` ở đây.
 */
export interface QuickLink { label: string; desc: string; href: string; icon: string }

export const L = {
  schoolYear: { label: 'Năm học - Học kỳ', desc: 'Thiết lập năm học, học kỳ', href: '/admin/school-year', icon: 'calendar' },
  users: { label: 'Quản lý tài khoản', desc: 'Tài khoản giáo viên, học sinh', href: '/admin/users', icon: 'users' },
  roles: { label: 'Vai trò & Phân quyền', desc: 'Ai được quản lý lớp học', href: '/admin/roles', icon: 'layers' },
  subjects: { label: 'Môn học', desc: 'Danh mục môn học', href: '/admin/subjects', icon: 'book' },
  teachers: { label: 'Giáo viên', desc: 'Hồ sơ giáo viên', href: '/admin/teachers', icon: 'user' },
  students: { label: 'Học sinh', desc: 'Hồ sơ học sinh', href: '/admin/students', icon: 'users' },
  timetable: { label: 'Thời khóa biểu', desc: 'Thời khóa biểu toàn trường', href: '/admin/timetable', icon: 'calendar' },
  acStudents: { label: 'Hồ sơ học sinh (Giáo vụ)', desc: 'Khu Giáo vụ', href: '/academic/students', icon: 'user' },
  assignment: { label: 'Phân công giảng dạy', desc: 'Khu Giáo vụ', href: '/academic/assignment', icon: 'book' },
  grades: { label: 'Quản lý điểm', desc: 'Khu Giáo vụ', href: '/academic/grades', icon: 'chart' },
  promotion: { label: 'Xét lên lớp', desc: 'Khu Giáo vụ', href: '/academic/promotion', icon: 'swap' },
} satisfies Record<string, QuickLink>;

export const ADMIN_LINKS: QuickLink[] = [L.schoolYear, L.users, L.roles, L.subjects, L.teachers, L.students, L.timetable, L.acStudents, L.assignment, L.grades, L.promotion];
