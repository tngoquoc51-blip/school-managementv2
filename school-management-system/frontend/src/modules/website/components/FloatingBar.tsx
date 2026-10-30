'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import s from '../site.module.css';
import { SCHOOL } from '../data/school';
import Icon from './Icons';

/** Điện thoại: thanh Gọi ngay / Đăng ký dính đáy màn hình. Máy tính: nút lên đầu trang khi đã cuộn xa. */
export default function FloatingBar() {
    const [far, setFar] = useState(false);
    useEffect(() => {
        const f = () => setFar(window.scrollY > 700);
        f();
        window.addEventListener('scroll', f, { passive: true });
        return () => window.removeEventListener('scroll', f);
    }, []);
    return (
        <>
            <button className={`${s.toTop} ${far ? s.toTopOn : ''}`} aria-label="Lên đầu trang" tabIndex={far ? 0 : -1} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Icon name="arrow" size={20} className={s.up} /></button>
            <div className={s.mobBar}>
                <a href={`tel:${SCHOOL.phone.replace(/\s/g, '')}`} className={`${s.btn} ${s.btnLine}`}><Icon name="phone" size={18} />Gọi ngay</a>
                <Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnHot}`}>Đăng ký nhập học</Link>
            </div>
        </>
    );
}