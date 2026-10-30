'use client';
import { useEffect, useRef } from 'react';
import s from '../site.module.css';

/* Sân khấu "phản trọng lực": ngôi trường và các vật dụng học đường lơ lửng.
   - Mỗi vật tự trôi lên xuống với chu kỳ riêng (CSS).
   - Con trỏ chuột kéo các vật lệch theo, vật càng "xa" càng lệch nhiều (độ sâu --d).
   - Bóng dưới ngôi trường co lại khi trường bay lên, giãn ra khi hạ xuống.
   Tắt hết chuyển động khi người dùng bật "giảm chuyển động" trong hệ điều hành. */

type Obj = { id: string; x: number; y: number; w: number; d: number; dur: number; delay: number; rot: number; svg: JSX.Element };

const Book = (
    <svg viewBox="0 0 120 90"><path d="M60 22C46 12 24 12 8 18v54c16-6 38-6 52 4V22Z" fill="#fff" stroke="#0B2A4A" strokeWidth="4" strokeLinejoin="round" /><path d="M60 22c14-10 36-10 52-4v54c-16-6-38-6-52 4V22Z" fill="#E3F2FD" stroke="#0B2A4A" strokeWidth="4" strokeLinejoin="round" /><path d="M20 34c10-3 24-2 32 3M20 46c10-3 24-2 32 3M68 37c8-5 22-6 32-3M68 49c8-5 22-6 32-3" stroke="#4DB0F0" strokeWidth="3" strokeLinecap="round" fill="none" /></svg>
);
const Atom = (
    <svg viewBox="0 0 120 120"><g fill="none" stroke="#1479C9" strokeWidth="4"><ellipse cx="60" cy="60" rx="52" ry="19" /><ellipse cx="60" cy="60" rx="52" ry="19" transform="rotate(60 60 60)" /><ellipse cx="60" cy="60" rx="52" ry="19" transform="rotate(120 60 60)" /></g><circle cx="60" cy="60" r="10" fill="#FFC83D" stroke="#0B2A4A" strokeWidth="4" /></svg>
);
const Ball = (
    <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="#fff" stroke="#0B2A4A" strokeWidth="4" /><path d="m60 40 19 14-7 22H48l-7-22 19-14Z" fill="#0B2A4A" /><path d="M60 40V10M79 54l30-9M72 76l18 26M48 76 30 102M41 54 11 45" stroke="#0B2A4A" strokeWidth="4" strokeLinecap="round" /></svg>
);
const Flask = (
    <svg viewBox="0 0 100 120"><path d="M38 8h24M42 8v34L12 98a10 10 0 0 0 9 15h58a10 10 0 0 0 9-15L58 42V8" fill="#E3F2FD" stroke="#0B2A4A" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" /><path d="M24 80h52l11 19a6 6 0 0 1-5 9H18a6 6 0 0 1-5-9l11-19Z" fill="#4DB0F0" /><circle cx="44" cy="92" r="4" fill="#fff" /><circle cx="60" cy="100" r="3" fill="#fff" /></svg>
);
const Pencil = (
    <svg viewBox="0 0 150 40"><path d="M10 20 28 6h108a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H28L10 20Z" fill="#FFC83D" stroke="#0B2A4A" strokeWidth="4" strokeLinejoin="round" /><path d="M10 20 28 6v28L10 20Z" fill="#F7E2C4" stroke="#0B2A4A" strokeWidth="4" strokeLinejoin="round" /><path d="M10 20l5-4v8l-5-4Z" fill="#0B2A4A" /><rect x="118" y="6" width="12" height="28" fill="#E5402B" /></svg>
);
const Plane = (
    <svg viewBox="0 0 120 100"><path d="M6 46 114 6 84 94 56 66 6 46Z" fill="#fff" stroke="#0B2A4A" strokeWidth="4" strokeLinejoin="round" /><path d="m56 66 58-60-76 48 18 12Zm0 0 4 24 14-18" fill="#BFE2FA" stroke="#0B2A4A" strokeWidth="4" strokeLinejoin="round" /></svg>
);
const Flower = (
    <svg viewBox="0 0 120 120"><g fill="#E5402B" stroke="#B72D1B" strokeWidth="3">{[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="60" cy="30" rx="19" ry="27" transform={`rotate(${r} 60 60)`} />)}</g><circle cx="60" cy="60" r="11" fill="#FFC83D" /></svg>
);
const Note = (
    <svg viewBox="0 0 80 110"><path d="M30 80V16l44-10v62" fill="none" stroke="#0B2A4A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><ellipse cx="20" cy="84" rx="16" ry="12" fill="#1479C9" stroke="#0B2A4A" strokeWidth="4" /><ellipse cx="64" cy="72" rx="16" ry="12" fill="#1479C9" stroke="#0B2A4A" strokeWidth="4" /></svg>
);
const Cloud = (
    <svg viewBox="0 0 200 80"><path d="M40 70a26 26 0 0 1 4-51 38 38 0 0 1 72-8 32 32 0 0 1 50 22 24 24 0 0 1-6 37H40Z" fill="#fff" /></svg>
);

const OBJECTS: Obj[] = [
    { id: 'cloud1', x: 2, y: 8, w: 24, d: 10, dur: 11, delay: 0, rot: 0, svg: Cloud },
    { id: 'cloud2', x: 66, y: 66, w: 28, d: 14, dur: 13, delay: -4, rot: 0, svg: Cloud },
    { id: 'book', x: 8, y: 56, w: 20, d: 34, dur: 7, delay: -1, rot: -12, svg: Book },
    { id: 'atom', x: 70, y: 6, w: 17, d: 40, dur: 8, delay: -3, rot: 8, svg: Atom },
    { id: 'ball', x: 80, y: 44, w: 12, d: 46, dur: 6, delay: -2, rot: 0, svg: Ball },
    { id: 'flask', x: 20, y: 22, w: 11, d: 28, dur: 9, delay: -5, rot: -8, svg: Flask },
    { id: 'pencil', x: 50, y: 84, w: 22, d: 38, dur: 7.5, delay: -2.500, rot: -22, svg: Pencil },
    { id: 'plane', x: 42, y: 2, w: 14, d: 52, dur: 6.500, delay: -1.500, rot: 4, svg: Plane },
    { id: 'flower', x: 4, y: 82, w: 11, d: 24, dur: 10, delay: -6, rot: 12, svg: Flower },
    { id: 'note', x: 88, y: 80, w: 8, d: 30, dur: 8.500, delay: -4, rot: 10, svg: Note },
];

export default function Hero({ year }: { year?: string | null }) {
    const stage = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = stage.current;
        if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, run = false;
        const tick = () => {
            cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
            el.style.setProperty('--mx', cx.toFixed(3));
            el.style.setProperty('--my', cy.toFixed(3));
            if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(tick); else run = false;
        };
        const move = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
            ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
            if (!run) { run = true; raf = requestAnimationFrame(tick); }
        };
        window.addEventListener('pointermove', move, { passive: true });
        return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
    }, []);

    return (
        <div ref={stage} className={s.stage} role="img" aria-label={`Ngôi trường và các vật dụng học tập lơ lửng giữa bầu trời${year ? `, năm học ${year}` : ''}`}>
            {OBJECTS.map((o) => (
                <div key={o.id} className={s.obj} style={{ left: `${o.x}%`, top: `${o.y}%`, width: `${o.w}%`, ['--d' as string]: o.d }}>
                    <div className={s.objFloat} style={{ animationDuration: `${o.dur}s`, animationDelay: `${o.delay}s`, ['--r' as string]: `${o.rot}deg` }}>{o.svg}</div>
                </div>
            ))}
            <div className={s.obj} style={{ left: '27%', top: '26%', width: '46%', ['--d' as string]: 12 }}>
                <div className={s.school}>
                    <svg viewBox="0 0 300 250" aria-hidden="true">
                        <path d="M10 112 150 36l140 76H10Z" fill="#0B3E73" stroke="#0B2A4A" strokeWidth="5" strokeLinejoin="round" />
                        <rect x="30" y="112" width="240" height="108" rx="4" fill="#fff" stroke="#0B2A4A" strokeWidth="5" />
                        <rect x="120" y="150" width="60" height="70" rx="3" fill="#1479C9" stroke="#0B2A4A" strokeWidth="4" />
                        <path d="M150 150v70" stroke="#0B2A4A" strokeWidth="3" />
                        {[48, 82, 196, 230].map((x) => <rect key={x} x={x} y="132" width="26" height="30" rx="2" fill="#BFE2FA" stroke="#0B2A4A" strokeWidth="4" />)}
                        {[48, 82, 196, 230].map((x) => <path key={x} d={`M${x + 13} 132v30M${x} 147h26`} stroke="#0B2A4A" strokeWidth="2" />)}
                        <circle cx="150" cy="82" r="14" fill="#fff" stroke="#0B2A4A" strokeWidth="4" /><path d="M150 73v9l6 4" stroke="#0B2A4A" strokeWidth="3" strokeLinecap="round" fill="none" />
                        <path d="M150 36V6" stroke="#0B2A4A" strokeWidth="4" strokeLinecap="round" /><path d="M150 8h34l-8 10 8 10h-34V8Z" fill="#E5402B" stroke="#B72D1B" strokeWidth="2" />
                        <path d="m167 12 2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5l2-5Z" fill="#FFC83D" transform="translate(-2 1) scale(.8)" />
                    </svg>
                </div>
                <div className={s.shadow} />
            </div>
            <div className={s.sparkles} aria-hidden="true">{Array.from({ length: 9 }).map((_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div>
        </div>
    );
}