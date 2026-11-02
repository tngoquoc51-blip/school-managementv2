import s from './homework.module.css';
import { fmtScore } from './utils';

/** Điểm viết bằng bút đỏ, khoanh tròn như giáo viên chấm bài. */
export default function PenScore({ score, max, big = false }: { score: number; max: number; big?: boolean }) {
    return (
        <span className={`${s.pen} ${big ? s.penBig : ''}`} role="img" aria-label={`Điểm ${fmtScore(score)} trên ${fmtScore(max)}`}>
            <svg className={s.penRing} viewBox="0 0 84 52" aria-hidden="true">
                <path d="M8 28C6 12 30 4 48 6c20 2 34 12 28 26-5 12-26 16-44 13C16 42 9 36 8 28Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
            <span className={s.penNum} aria-hidden="true">{fmtScore(score)}</span>
        </span>
    );
}