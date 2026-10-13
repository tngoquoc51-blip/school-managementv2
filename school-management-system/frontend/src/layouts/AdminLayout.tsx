'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import './admin-layout.css';

interface Props {
    children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
            setUser(JSON.parse(stored));
        } else {
            router.push('/login');
        }
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">TH</div>
                    <div>
                        <div className="sidebar-title">Quản trị hệ thống</div>
                        <div className="sidebar-user">{user?.name || 'Admin'}</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <Link href="/admin/dashboard" className="nav-item active">
                        <span>📊</span> Dashboard
                    </Link>
                    <Link href="/admin/users" className="nav-item">
                        <span>👥</span> Quản lý tài khoản
                    </Link>
                    <Link href="/admin/roles" className="nav-item">
                        <span>🔐</span> Vai trò & Phân quyền
                    </Link>
                    <Link href="/admin/school-year" className="nav-item">
                        <span>📅</span> Năm học - Học kỳ
                    </Link>
                    <Link href="/admin/categories" className="nav-item">
                        <span>📂</span> Danh mục hệ thống
                    </Link>
                    <Link href="/admin/logs" className="nav-item">
                        <span>📝</span> Nhật ký hệ thống
                    </Link>
                    <Link href="/admin/backup" className="nav-item">
                        <span>💾</span> Sao lưu & Phục hồi
                    </Link>
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="btn-logout">
                        Đăng xuất
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="admin-main">
                <header className="admin-header">
                    <h1>Quản trị hệ thống</h1>
                    <div className="header-right">
                        <span className="badge">Super Admin</span>
                    </div>
                </header>

                <main className="admin-content">
                    {children}
                </main>
            </div>
        </div>
    );
}