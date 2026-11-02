'use client';
import { ReactNode } from 'react';
import { SubNav } from './_lh';

/** Khung chung của module: tiêu đề + thanh chức năng con. Mỗi chức năng con là một trang riêng trong thư mục này. */
export default function LienHeLayout({ children }: { children: ReactNode }) {
    return (
        <div className="wm lh">
            <div className="lh-top">
                <div><h1>Liên hệ & Hỗ trợ</h1><p>Tiếp nhận, phân công và trả lời tin nhắn từ phụ huynh, học sinh gửi qua website.</p></div>
            </div>
            <SubNav />
            {children}
        </div>
    );
}