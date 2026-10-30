'use client';
import { useEffect, useState } from 'react';
import s from '../extra.module.css';

export default function BackToTop() {
    const [show, setShow] = useState(false);
    useEffect(() => {
        const on = () => setShow(window.scrollY > 600);
        on();
        window.addEventListener('scroll', on, { passive: true });
        return () => window.removeEventListener('scroll', on);
    }, []);
    if (!show) return null;
    return (
        <button type="button" className={s.toTop} aria-label="Lên đầu trang"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
    );
}