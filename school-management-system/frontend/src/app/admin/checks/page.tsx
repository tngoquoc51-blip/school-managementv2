'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminChecks as API } from '@/services/adminChecks';
import '../profile/profile.css';
import './checks.css';

type Check = { code: string; mod: string; sev: 'error' | 'warn' | 'info'; title: string; desc: string; fix: string };
type Res = Record<string, { n: number | null; err?: string }>;
const MOD: Record<string, string> = { students: 'Học sinh', classes: 'Lớp & giáo viên', grades: 'Điểm & hạnh kiểm', finance: 'Học phí', security: 'Tài khoản' };
const SEV: Record<string, string> = { error: 'Lỗi nghiêm trọng', warn: 'Cảnh báo', info: 'Thông tin' };
const COL: Record<string, string> = { error: '#c0392b', warn: '#d39a12', info: '#0e6ba8', ok: '#12805c', pending: '#9db2c6', err: '#6b7c8d' };
const HDR: Record<string, string> = {
    ma_hs: 'Mã HS', ho_ten: 'Họ tên', nam_nhap_hoc: 'Năm nhập học', ngay_sinh: 'Ngày sinh', lop: 'Lớp', khoi: 'Khối', si_so: 'Sĩ số',
    mon_id: 'Mã môn', hoc_ky: 'Học kỳ', tbm: 'TBM', lop_id: 'Mã lớp', ma_hd: 'Mã HĐ', tam_tinh: 'Tạm tính', giam: 'Giảm', tong: 'Tổng',
    ma_phieu: 'Mã phiếu', so_tien: 'Số tiền', ngay_lap: 'Ngày lập', han_nop: 'Hạn nộp', tai_khoan: 'Tài khoản', khoa_den: 'Khoá đến', ma_gv: 'Mã GV',
};
const errMsg = (e: any) => e?.response?.data?.message || e?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
const fmt = (s?: string) => (s ? new Date(s).toLocaleString('vi-VN') : '—');
const tone = (n: number) => (n >= 90 ? COL.ok : n >= 70 ? COL.warn : COL.error);

export default function DataChecksPage() {
    const [checks, setChecks] = useState<Check[]>([]);
    const [res, setRes] = useState<Res | null>(null);
    const [run, setRun] = useState<any>(null);
    const [hist, setHist] = useState<any[]>([]);
    const [sev, setSev] = useState('all');
    const [mod, setMod] = useState('all');
    const [q, setQ] = useState('');
    const [open, setOpen] = useState<Check | null>(null);
    const [view, setView] = useState<'overview' | 'results' | 'history' | 'rules'>('overview');
    const [rows, setRows] = useState<Record<string, any[]>>({});
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [loadErr, setLoadErr] = useState('');
    const [toasts, setToasts] = useState<{ id: number; type: string; text: string }[]>([]);

    const toast = useCallback((type: string, text: string) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, type, text }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    }, []);

    useEffect(() => {
        API.get().then((r) => {
            setChecks(r.checks); setHist(r.history || []);
            if (r.last) { setRes(r.last.results); setRun(r.last.run); }
        }).catch((e) => setLoadErr(`${e?.response?.status ? `[${e.response.status}] ` : ''}${errMsg(e)}`)).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, []);

    const doRun = async () => {
        setRunning(true);
        try {
            const r = await API.run();
            setRes(r.results); setRun(r.run); setHist(r.history); setRows({});
            toast(r.run.errors ? 'error' : 'success', `Kiểm tra xong: ${r.run.score}/100 điểm (${r.run.duration_ms} ms).`);
        } catch (e) { toast('error', errMsg(e)); }
        setRunning(false);
    };

    const status = useCallback((c: Check) => {
        const r = res?.[c.code];
        return !r ? 'pending' : r.n === null ? 'err' : r.n === 0 ? 'ok' : c.sev;
    }, [res]);

    const openDetail = async (c: Check) => {
        setOpen(c);
        if (rows[c.code] || !res?.[c.code]?.n) return;
        try { const r = await API.detail(c.code); setRows((m) => ({ ...m, [c.code]: r.rows })); }
        catch (e) { toast('error', errMsg(e)); }
    };

    const exportCsv = (c: Check) => {
        const data = rows[c.code] || [];
        if (!data.length) return;
        const keys = Object.keys(data[0]);
        const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = '\uFEFF' + [keys.map((k) => esc(HDR[k] || k)).join(','), ...data.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `kiem-tra-${c.code}.csv`; a.click(); URL.revokeObjectURL(a.href);
        toast('info', 'Đã xuất tệp CSV.');
    };

    const modStats = useMemo(() => Object.keys(MOD).map((m) => {
        const cs = checks.filter((c) => c.mod === m);
        const done = cs.filter((c) => res?.[c.code] && res[c.code].n !== null);
        const ok = done.filter((c) => res![c.code].n === 0).length;
        const issues = done.reduce((s, c) => s + (res![c.code].n || 0), 0);
        return { m, total: cs.length, ran: done.length, ok, issues, pct: done.length ? Math.round((100 * ok) / done.length) : 0 };
    }), [checks, res]);

    const cnt = (k: string) => (k === 'all' ? checks.length : checks.filter((c) => c.sev === k && res?.[c.code]?.n).length);
    const list = useMemo(() => {
        const rank: Record<string, number> = { error: 0, warn: 1, info: 2, err: 3, pending: 4, ok: 5 };
        return checks
            .filter((c) => (sev === 'all' || c.sev === sev) && (mod === 'all' || c.mod === mod) && (!q || (c.title + c.desc).toLowerCase().includes(q.toLowerCase())))
            .sort((a, b) => rank[status(a)] - rank[status(b)]);
    }, [checks, sev, mod, q, status]);

    const exportReport = () => {
        if (!res) return toast('error', 'Chưa có kết quả. Hãy chạy kiểm tra trước.');
        const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rowsOut = checks.map((c) => [c.code, c.title, MOD[c.mod], SEV[c.sev], res[c.code]?.n === 0 ? 'Đạt' : res[c.code]?.n == null ? 'Lỗi' : 'Có vấn đề', res[c.code]?.n ?? ''].map(esc).join(','));
        const csv = '\uFEFF' + ['Mã,Mục kiểm tra,Phân hệ,Mức độ,Trạng thái,Số bản ghi', ...rowsOut].join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `bao-cao-chat-luong-du-lieu-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
        toast('info', 'Đã xuất báo cáo tổng hợp.');
    };
    const failing = checks.filter((c) => res?.[c.code]?.n).length;
    const prio = [...checks].filter((c) => res?.[c.code]?.n).sort((a, b) => ({ error: 0, warn: 1, info: 2 }[a.sev] - { error: 0, warn: 1, info: 2 }[b.sev]) || (res![b.code].n || 0) - (res![a.code].n || 0)).slice(0, 8);

    if (loading) return <div className="pf dc"><p className="pf-card">Đang tải…</p></div>;
    if (loadErr) return (
        <div className="pf dc"><div className="pf-card pf-err"><h2>Không tải được trang</h2><code>{loadErr}</code>
            <p className="pf-mut">Kiểm tra: đã chạy admin_checks.sql, đã thêm route và controller, đang đăng nhập bằng tài khoản quản trị.</p>
            <button className="pf-btn" onClick={() => location.reload()}>Thử lại</button></div></div>
    );

    const score = run?.score ?? 0, C = 2 * Math.PI * 62;
    const delta = hist.length > 1 ? hist[0].score - hist[1].score : null;
    const oc = open ? res?.[open.code] : undefined, ost = open ? status(open) : 'pending';

    return (
        <div className="pf dc">
            <div className="pf-toasts" aria-live="polite">
                {toasts.map((t) => <div key={t.id} className={`pf-toast ${t.type}`}><p>{t.text}</p><button onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}>✕</button></div>)}
            </div>

            <section className="pf-card dc-hero">
                <div className="dc-ring">
                    <svg width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="62" fill="none" stroke="#dbe9f6" strokeWidth="14" />
                        <circle cx="75" cy="75" r="62" fill="none" stroke={run ? tone(score) : '#dbe9f6'} strokeWidth="14" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} style={{ transition: 'stroke-dashoffset .7s' }} /></svg>
                    <b style={{ color: run ? tone(score) : '#9db2c6' }}>{run ? score : '—'}<small>/ 100 điểm</small></b>
                </div>
                <div>
                    <div className="dc-title">
                        <div>
                            <h1>Chất lượng dữ liệu hệ thống{delta !== null && delta !== 0 && <span className={`dc-delta ${delta < 0 ? 'neg' : ''}`}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)} điểm</span>}</h1>
                            <p>{run ? `Quét lần cuối: ${fmt(run.created_at)} · ${run.duration_ms} ms · ${checks.length} mục kiểm tra` : 'Chưa có lần quét nào. Bấm “Chạy kiểm tra” để quét toàn bộ dữ liệu (chỉ đọc, không sửa dữ liệu).'}</p>
                        </div>
                        <button className="pf-btn" onClick={doRun} disabled={running} style={{ padding: '12px 26px', fontSize: 15 }}>{running && <span className="ck-spin" />}{running ? 'Đang quét…' : run ? 'Quét lại' : 'Chạy kiểm tra'}</button>
                    </div>
                    <div className="dc-kpis">
                        {([['Lỗi nghiêm trọng', run?.errors, COL.error], ['Cảnh báo', run?.warnings, COL.warn], ['Thông tin', run?.infos, COL.info], ['Mục đạt', run?.passed, COL.ok]] as const).map(([l, v, c]) => (
                            <div key={l} className="dc-kpi" style={{ ['--c' as any]: c }}><b>{v ?? '—'}</b><span>{l}</span></div>
                        ))}
                    </div>
                </div>
            </section>

            <nav className="dc-nav">
                <div className="dc-tabs" role="tablist">
                    {([['overview', 'Tổng quan', null], ['results', 'Kết quả chi tiết', failing || null], ['history', 'Lịch sử quét', hist.length || null], ['rules', 'Quy tắc kiểm tra', checks.length]] as const).map(([k, l, n]) => (
                        <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}{n !== null && <em>{n}</em>}</button>
                    ))}
                </div>
                <button className="dc-ghost" onClick={exportReport}>⬇ Xuất báo cáo (CSV)</button>
            </nav>

            {view === 'overview' && (
                <div className="dc-grid">
                    <div className="dc-col">
                        <section>
                            <h2 className="dc-sec">Sức khoẻ theo phân hệ</h2>
                            <div className="dc-mods five">
                                {modStats.map((s) => (
                                    <button key={s.m} className="dc-mod" onClick={() => { setMod(s.m); setView('results'); }}>
                                        <b>{MOD[s.m]}</b>
                                        <strong style={{ color: s.ran ? tone(s.pct) : '#9db2c6' }}>{s.ran ? `${s.pct}%` : '—'}</strong>
                                        <div className="dc-track"><i style={{ width: `${s.pct}%`, background: tone(s.pct) }} /></div>
                                        <small>{s.ran ? `${s.ok}/${s.ran} đạt · ${s.issues.toLocaleString('vi-VN')} lỗi` : `${s.total} mục`}</small>
                                    </button>
                                ))}
                            </div>
                        </section>
                        <section className="pf-card">
                            <div className="pf-bar" style={{ marginBottom: 6 }}><h2 className="dc-sec" style={{ margin: 0 }}>Vấn đề cần ưu tiên xử lý</h2>
                                <button className="pf-link" onClick={() => setView('results')}>Xem tất cả →</button></div>
                            {!res && <p className="pf-mut">Chưa có dữ liệu. Bấm “Chạy kiểm tra” để bắt đầu.</p>}
                            {res && !prio.length && <p style={{ color: 'var(--ok)', fontWeight: 600 }}>✓ Không phát hiện vấn đề nào. Dữ liệu rất tốt!</p>}
                            <ul className="dc-top">
                                {prio.map((c) => (
                                    <li key={c.code} onClick={() => openDetail(c)}>
                                        <span className="dc-ico" style={{ ['--c' as any]: COL[c.sev] }}>!</span>
                                        <span className="t"><b>{c.title}</b><span>{MOD[c.mod]} · {SEV[c.sev]}</span></span>
                                        <span className="dc-cnt" style={{ ['--c' as any]: COL[c.sev] }}>{res![c.code].n!.toLocaleString('vi-VN')}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                    <div className="dc-col">
                        <section className="pf-card">
                            <h2 className="dc-sec">Xu hướng điểm</h2>
                            {hist.length > 1 ? <div className="dc-bars">{[...hist].reverse().map((h) => <i key={h.id} style={{ height: `${Math.max(h.score, 4)}%` }} title={`${fmt(h.created_at)}: ${h.score}/100`} />)}</div>
                                : <p className="pf-mut">Cần ít nhất 2 lần quét để hiện xu hướng.</p>}
                        </section>
                        <section className="pf-card">
                            <h2 className="dc-sec">Cách tính điểm</h2>
                            <ul className="dc-legend">
                                <li><i style={{ background: COL.ok }} />90–100: Dữ liệu tốt</li>
                                <li><i style={{ background: COL.warn }} />70–89: Cần chú ý</li>
                                <li><i style={{ background: COL.error }} />Dưới 70: Cần xử lý ngay</li>
                            </ul>
                            <p className="pf-mut" style={{ marginBottom: 0 }}>Mỗi mục có trọng số: lỗi nghiêm trọng ×3, cảnh báo ×2, thông tin ×1. Mục đạt (0 bản ghi lỗi) được tính điểm.</p>
                        </section>
                    </div>
                </div>
            )}

            {view === 'results' && (
                <section className="pf-card" style={{ padding: 0 }}>
                    <div className="dc-bar" style={{ padding: '18px 18px 0' }}>
                        <div className="dc-seg">
                            {(['all', 'error', 'warn', 'info'] as const).map((k) => <button key={k} className={sev === k ? 'on' : ''} onClick={() => setSev(k)}>{k === 'all' ? 'Tất cả' : SEV[k]}<em>{cnt(k)}</em></button>)}
                        </div>
                        <div className="dc-seg">
                            {['all', ...Object.keys(MOD)].map((k) => <button key={k} className={mod === k ? 'on' : ''} onClick={() => setMod(k)}>{k === 'all' ? 'Mọi phân hệ' : MOD[k]}</button>)}
                        </div>
                        <input className="pf-in" style={{ maxWidth: 260 }} placeholder="Tìm mục kiểm tra…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    <div className="dc-wrap" style={{ border: 0, borderRadius: '0 0 16px 16px' }}>
                        <table className="dc-tbl">
                            <thead><tr><th style={{ width: 70 }}>TT</th><th>Mục kiểm tra</th><th className="hide">Phân hệ</th><th className="hide">Mức độ</th><th style={{ textAlign: 'right' }}>Kết quả</th></tr></thead>
                            <tbody>
                            {list.map((c) => {
                                const st = status(c), r = res?.[c.code], col = COL[st];
                                return (
                                    <tr key={c.code} onClick={() => openDetail(c)} style={{ ['--c' as any]: st === 'ok' || st === 'pending' ? 'transparent' : col }}>
                                        <td><span className="dc-ico" style={{ ['--c' as any]: col }}>{st === 'ok' ? '✓' : st === 'pending' ? '·' : st === 'err' ? '?' : '!'}</span></td>
                                        <td className="t"><b>{c.title}</b><span>{c.desc}</span></td>
                                        <td className="hide">{MOD[c.mod]}</td>
                                        <td className="hide"><span className="dc-badge" style={{ ['--c' as any]: COL[c.sev] }}>{SEV[c.sev]}</span></td>
                                        <td style={{ textAlign: 'right' }}><span className="dc-cnt" style={{ ['--c' as any]: col }}>{!r ? '—' : r.n === null ? 'Lỗi' : r.n === 0 ? 'Đạt' : r.n.toLocaleString('vi-VN')}</span></td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                        {!list.length && <div className="dc-empty">Không có mục nào khớp bộ lọc.</div>}
                    </div>
                </section>
            )}

            {view === 'history' && (
                <section className="pf-card" style={{ padding: 0 }}>
                    <div className="dc-wrap" style={{ border: 0 }}>
                        <table className="dc-tbl">
                            <thead><tr><th>Thời gian</th><th style={{ width: '24%' }}>Điểm</th><th>Lỗi</th><th>Cảnh báo</th><th>Thông tin</th><th>Đạt</th><th>Thời lượng</th><th>So với lần trước</th></tr></thead>
                            <tbody>
                            {hist.map((h, i) => {
                                const d = i < hist.length - 1 ? h.score - hist[i + 1].score : null;
                                return (
                                    <tr key={h.id} style={{ cursor: 'default' }}>
                                        <td style={{ borderLeft: 0 }}><b>#{h.id}</b> · {fmt(h.created_at)}</td>
                                        <td><div className="dc-sc"><b style={{ color: tone(h.score) }}>{h.score}</b><i style={{ width: `${h.score}%`, background: tone(h.score) }} /></div></td>
                                        <td style={{ color: h.errors ? COL.error : undefined, fontWeight: 700 }}>{h.errors}</td><td>{h.warnings}</td><td>{h.infos}</td><td>{h.passed}</td><td>{h.duration_ms} ms</td>
                                        <td>{d === null ? '—' : d === 0 ? '＝' : <span className={`dc-delta ${d < 0 ? 'neg' : ''}`} style={{ marginLeft: 0 }}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}</span>}</td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                        {!hist.length && <div className="dc-empty">Chưa có lần quét nào.</div>}
                    </div>
                </section>
            )}

            {view === 'rules' && (
                <section className="pf-card">
                    <p className="pf-mut" style={{ marginTop: 0 }}>Danh sách {checks.length} quy tắc đang được áp dụng. Mọi quy tắc chỉ đọc dữ liệu, không thay đổi cơ sở dữ liệu.</p>
                    {Object.keys(MOD).map((m) => (
                        <div key={m}>
                            <h3 className="dc-mh">{MOD[m]}</h3>
                            <div className="dc-rules">
                                {checks.filter((c) => c.mod === m).map((c) => (
                                    <div key={c.code} className="dc-rule" style={{ ['--c' as any]: COL[c.sev] }}>
                                        <span className="dc-badge" style={{ ['--c' as any]: COL[c.sev] }}>{SEV[c.sev]}</span>
                                        <b>{c.title}</b><p>{c.desc}</p><p className="fx"><b style={{ display: 'inline' }}>Xử lý:</b> {c.fix}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {open && <>
                <div className="dc-ov" onClick={() => setOpen(null)} />
                <aside className="dc-dr" role="dialog" aria-label={open.title}>
                    <header>
                        <div><h2>{open.title}</h2>
                            <span className="dc-badge" style={{ ['--c' as any]: COL[open.sev] }}>{SEV[open.sev]}</span> <span className="pf-mut"> {MOD[open.mod]}</span></div>
                        <button className="dc-x" onClick={() => setOpen(null)} aria-label="Đóng">✕</button>
                    </header>
                    <div className="bd">
                        <p style={{ margin: 0 }}>{open.desc}</p>
                        {oc?.err && <p style={{ color: 'var(--bad)' }}>Không chạy được mục này: {oc.err}</p>}
                        {!oc && <p className="pf-mut">Chưa chạy kiểm tra. Đóng khung này và bấm “Chạy kiểm tra”.</p>}
                        {oc && oc.n === 0 && <p style={{ color: 'var(--ok)', fontWeight: 600 }}>✓ Không phát hiện vấn đề nào.</p>}
                        {!!oc?.n && <>
                            <p style={{ margin: '10px 0 0' }}>Phát hiện <b style={{ color: COL[ost] }}>{oc.n.toLocaleString('vi-VN')}</b> bản ghi có vấn đề.</p>
                            <div className="dc-fix"><b>Cách xử lý:</b> {open.fix}</div>
                            {rows[open.code] ? <div className="dc-wrap" style={{ maxHeight: 380, overflow: 'auto' }}>
                                <table className="dc-dt"><thead><tr>{Object.keys(rows[open.code][0] || {}).map((k) => <th key={k}>{HDR[k] || k}</th>)}</tr></thead>
                                    <tbody>{rows[open.code].map((row, i) => <tr key={i}>{Object.keys(row).map((k) => <td key={k}>{String(row[k] ?? '—')}</td>)}</tr>)}</tbody></table>
                            </div> : <p className="pf-mut">Đang tải dữ liệu mẫu…</p>}
                        </>}
                    </div>
                    {!!oc?.n && <footer>
                        <span className="pf-mut">Hiển thị tối đa 30 dòng đầu.</span>
                        <button className="pf-btn" onClick={() => exportCsv(open)} disabled={!rows[open.code]}>Xuất CSV</button>
                    </footer>}
                </aside>
            </>}
        </div>
    );
}