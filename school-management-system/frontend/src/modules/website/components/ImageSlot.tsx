'use client';
import { useEffect, useRef, useState } from 'react';
import s from '../site.module.css';

/** Ảnh thật của trường. Thứ tự thử: ảnh riêng (src) → ảnh dùng chung (fallback) → nền màu (không lỗi, không vỡ bố cục).
 Ở chế độ dev có thêm dòng nhắc tên file cần bỏ vào public/images. */
export default function ImageSlot({ src, alt, tone = 'a', className = '', eager = false, hint = true, fallback }: { src: string; alt: string; tone?: string; className?: string; eager?: boolean; hint?: boolean; fallback?: string }) {
    const [cur, setCur] = useState(src);
    const [bad, setBad] = useState(false);
    const ref = useRef<HTMLImageElement>(null);
    const fail = () => {
        if (fallback && cur !== fallback) setCur(fallback);
        else setBad(true);
    };
    // Ảnh lỗi trước khi React gắn onError (tải từ server) thì kiểm tra lại sau khi hiển thị.
    useEffect(() => { const el = ref.current; if (el && el.complete && el.naturalWidth === 0) fail(); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <div className={`${s.img} ${s['tone_' + tone] ?? s.tone_a} ${className}`}>
            {!bad && (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={cur} ref={ref} src={cur} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={fail} />
            )}
            {bad && <span className={s.imgFallback} aria-hidden="true">{hint && process.env.NODE_ENV !== 'production' ? `Thêm ảnh: public${src}` : ''}</span>}
        </div>
    );
}