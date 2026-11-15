'use client';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon';
import { errMsg } from '../api';

/** Hook tải dữ liệu có trạng thái loading / error / reload. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const seq = useRef(0);
    const run = useCallback(async (quiet = false) => {
        const my = ++seq.current;
        if (!quiet) setLoading(true);
        try {
            const r = await fn();
            if (my === seq.current) { setData(r); setError(''); }
        } catch (e) { if (my === seq.current) setError(errMsg(e)); }
        finally { if (my === seq.current) setLoading(false); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    useEffect(() => { run(); }, [run]);
    return { data, loading, error, reload: run, setData };
}

export function Loading({ rows = 3 }: { rows?: number }) {
    return (
        <div className="sj-grid" aria-busy="true">
            {Array.from({ length: rows }).map((_, i) => <div className="sj-card" key={i}><div className="sj-skel" style={{ width: '40%' }} /><div className="sj-skel" style={{ marginTop: 12, height: 60 }} /></div>)}
        </div>
    );
}
export function ErrorBox({ msg, retry }: { msg: string; retry: () => void }) {
    return (
        <div className="sj-errbox">
            <Icon name="alert" size={28} /><b>Không tải được dữ liệu</b><p className="sj-muted">{msg}</p>
            <button className="sj-btn" onClick={() => retry()}><Icon name="refresh" size={16} /> Thử lại</button>
        </div>
    );
}
export function Empty({ icon = 'info', title, children }: { icon?: string; title: string; children?: ReactNode }) {
    return <div className="sj-empty"><Icon name={icon} size={40} /><b>{title}</b>{children}</div>;
}
export function Kpi({ icon, label, value, sub, color }: { icon: string; label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
    return (
        <div className={`sj-kpi ${color ? `t-${color}` : ''}`}>
            <div className="sj-kpi-ic"><Icon name={icon} size={22} /></div>
            <div><b>{value}</b><span>{label}</span>{sub && <small>{sub}</small>}</div>
        </div>
    );
}
export function useDebounced<T>(v: T, ms = 320) {
    const [d, setD] = useState(v);
    useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
    return d;
}
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
    return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`sj-switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}
export function Stepper({ value, onChange, min = 1, max = 10 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
    return (
        <div className="sj-stepper">
            <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Giảm">−</button>
            <b>{value}</b>
            <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Tăng">+</button>
        </div>
    );
}