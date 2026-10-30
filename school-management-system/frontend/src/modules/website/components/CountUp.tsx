'use client';
import { useEffect, useRef, useState } from 'react';

/** Số chạy từ 0 đến giá trị thật khi cuộn tới. Không chạy nếu bật "giảm chuyển động". */
export default function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [v, setV] = useState(to);
    useEffect(() => {
        const el = ref.current;
        if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
        let raf = 0;
        const io = new IntersectionObserver(([e]) => {
            if (!e.isIntersecting) return;
            io.disconnect();
            const t0 = performance.now();
            const step = (t: number) => {
                const p = Math.min(1, (t - t0) / 1100);
                setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
                if (p < 1) raf = requestAnimationFrame(step);
            };
            setV(0);
            raf = requestAnimationFrame(step);
        }, { threshold: 0.4 });
        io.observe(el);
        return () => { io.disconnect(); cancelAnimationFrame(raf); };
    }, [to]);
    return <span ref={ref}>{v.toLocaleString('vi-VN')}{suffix}</span>;
}