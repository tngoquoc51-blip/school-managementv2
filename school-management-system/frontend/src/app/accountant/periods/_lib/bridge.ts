// Cầu nối đăng nhập: gọi hàm này ngay sau khi đăng nhập khu Kế toán thành công,
// để các trang Đợt thu / Thu học phí / Phiếu thu tự có phiên và không hỏi đăng nhập lần nữa.
import { api, clearSession, saveSession, Staff } from './api';

/** Đăng nhập phiên API kế toán bằng đúng tên đăng nhập + mật khẩu vừa nhập. Không bao giờ ném lỗi. */
export async function ktSignIn(username: string, password: string): Promise<boolean> {
    try {
        const r = await api<{ token: string; staff: Staff }>('login', { method: 'POST', body: { username: username.trim(), password }, auth: false });
        saveSession(r.token, r.staff);
        return true;
    } catch {
        return false; // sai tài khoản ở phía API: các trang sẽ tự hiện form đăng nhập như cũ
    }
}

/** Gọi khi đăng xuất khỏi hệ thống để xóa luôn phiên kế toán. */
export function ktSignOut(): void { clearSession(); }