'use client';

import { useEffect, useState } from 'react';
import { errMsg, rewardsApi } from '@/modules/bgh/rewards/rewardsService';
import type { Criterion, Meta, Paged, RecordRow, ViewProps } from '@/modules/bgh/rewards/types';
import { CAT_COLOR, Empty, fdt, fmt, Icon, Modal, num, Skeleton, sgn, todayStr, useUI } from '../ui';

/* ================= Lịch sử chấm điểm ================= */
export default function Scoring({ meta, yearId, rev, openScore, changed }: ViewProps) {
    const { toast, confirm } = useUI();
    const [f, setF] = useState({ class_id: '', category: '', type: '', from: '', to: '' });
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Paged<RecordRow> | null>(null);
    const [err, setErr] = useState('');

    useEffect(() => {
        setData(null); setErr('');
        rewardsApi.records({ year_id: yearId, ...f, page }).then(setData).catch((e) => setErr(errMsg(e)));
    }, [yearId, f, page, rev]);

    const upd = (k: string, v: string) => { setPage(1); setF((x) => ({ ...x, [k]: v })); };

    const remove = async (r: RecordRow) => {
        const ok = await confirm({
            title: 'Xóa bản ghi điểm?', danger: true, ok: 'Xóa bản ghi',
            msg: `${r.criteria} (${sgn(r.points)} điểm) của lớp ${r.class_name} ngày ${fdt(r.record_date)} sẽ bị xóa và xếp hạng được tính lại.`,
        });
        if (!ok) return;
        try { const res = await rewardsApi.delRecord(r.id); toast('success', 'Đã xóa bản ghi', res.message); changed(); }
        catch (e) { toast('error', 'Không thể xóa', errMsg(e)); }
    };

    return (
        <div className="rw-stack">
            <div className="row">
                <div><b style={{ fontSize: 15 }}>Lịch sử chấm điểm thi đua</b><div className="hint">Mọi lượt cộng/trừ điểm đều được lưu vết người nhập</div></div>
                <span className="spacer" />
                <button className="btn brass" onClick={() => openScore()}><Icon n="plus" s={16} />Chấm điểm mới</button>
            </div>

            <div className="panel"><div className="pb row">
                <select value={f.class_id} onChange={(e) => upd('class_id', e.target.value)} aria-label="Lớp">
                    <option value="">Tất cả các lớp</option>
                    {meta.classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
                </select>
                <select value={f.category} onChange={(e) => upd('category', e.target.value)} aria-label="Mảng thi đua">
                    <option value="">Mọi mảng</option>
                    {Object.entries(meta.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={f.type} onChange={(e) => upd('type', e.target.value)} aria-label="Loại điểm">
                    <option value="">Cộng và trừ</option><option value="plus">Chỉ điểm cộng</option><option value="minus">Chỉ điểm trừ</option>
                </select>
                <label className="row hint">Từ <input type="date" value={f.from} onChange={(e) => upd('from', e.target.value)} /></label>
                <label className="row hint">đến <input type="date" value={f.to} onChange={(e) => upd('to', e.target.value)} /></label>
                {Object.values(f).some(Boolean) && <button className="btn ghost sm" onClick={() => { setPage(1); setF({ class_id: '', category: '', type: '', from: '', to: '' }); }}>Xóa lọc</button>}
            </div></div>

            {err ? <div className="rw-err"><Icon n="alert" />{err}</div> : !data ? <Skeleton h={300} /> : (
                <div className="panel" style={{ overflow: 'auto' }}>
                    <table className="tbl">
                        <thead><tr><th>Ngày</th><th>Lớp</th><th>Tiêu chí</th><th className="num">Điểm</th><th>Ghi chú</th><th>Người nhập</th><th /></tr></thead>
                        <tbody>
                        {data.data.map((r) => (
                            <tr key={r.id}>
                                <td>{fdt(r.record_date)}</td>
                                <td><b>{r.class_name}</b></td>
                                <td><span style={{ color: CAT_COLOR[r.category], fontWeight: 600 }}>{meta.categories[r.category]}</span><div>{r.criteria}</div></td>
                                <td className={`num ${num(r.points) > 0 ? 'good-t' : 'bad-t'}`}><b>{sgn(r.points)}</b></td>
                                <td>{r.note || <span className="muted">—</span>}</td>
                                <td className="muted">{r.recorded_by_name || '—'}</td>
                                <td><button className="icon-btn" title="Xóa" onClick={() => remove(r)}><Icon n="trash" s={16} /></button></td>
                            </tr>
                        ))}
                        {!data.data.length && <tr><td colSpan={7}><Empty icon="list" text="Không có bản ghi nào khớp bộ lọc." /></td></tr>}
                        </tbody>
                    </table>
                    <div className="pager">
                        <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>
                        <span>Trang {data.current_page}/{data.last_page || 1} · {data.total} bản ghi</span>
                        <button className="btn ghost sm" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Sau</button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ================= Hộp thoại chấm điểm ================= */
export function ScoreModal({ meta, preset, onClose, onDone }: {
    meta: Meta; preset?: number[]; onClose: () => void; onDone: () => void;
}) {
    const { toast } = useUI();
    const today = todayStr();
    const [crit, setCrit] = useState<Criterion[]>([]);
    const [cid, setCid] = useState<number | null>(null);
    const [cat, setCat] = useState('');
    const [s, setS] = useState('');
    const [sel, setSel] = useState<number[]>(preset || []);
    const [date, setDate] = useState(meta.default_date <= today ? meta.default_date : today);
    const [pts, setPts] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        rewardsApi.criteria().then((l) => setCrit(l.filter((c) => c.is_active))).catch((e) => toast('error', 'Không tải được tiêu chí', errMsg(e)));
    }, []);

    const c = crit.find((x) => x.id === cid);
    const mag = pts !== '' ? Math.abs(Number(pts)) : c ? Math.abs(num(c.default_points)) : 0;
    const signed = c ? (c.type === 'minus' ? -mag : mag) : 0;
    const shown = crit.filter((x) => (!cat || x.category === cat) && (!s || (x.name + x.code).toLowerCase().includes(s.toLowerCase())));
    const toggle = (id: number) => setSel((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
    const grade = (g: number) => {
        const ids = meta.classes.filter((x) => x.grade === g).map((x) => x.id);
        setSel((a) => (ids.every((i) => a.includes(i)) ? a.filter((i) => !ids.includes(i)) : Array.from(new Set([...a, ...ids]))));
    };

    const submit = async () => {
        if (!c || !sel.length || busy) return;
        setBusy(true);
        try {
            await rewardsApi.addRecord({ class_ids: sel, criteria_id: c.id, points: pts === '' ? undefined : mag, record_date: date, note: note || undefined });
            toast('success', 'Đã ghi nhận điểm thi đua', `${sgn(signed)} điểm · ${c.name} · ${sel.length} lớp`);
            onDone(); onClose();
        } catch (e) { toast('error', 'Không thể ghi nhận', errMsg(e)); setBusy(false); }
    };

    return (
        <Modal title="Chấm điểm thi đua" onClose={onClose}
               footer={<>
        <span className="summary" style={{ marginRight: 'auto' }}>
          {c && sel.length ? <>Ghi <b>{sgn(signed)} điểm</b> cho <b>{sel.length} lớp</b> · {c.name}</> : 'Chọn tiêu chí và ít nhất một lớp'}
        </span>
                   <button className="btn ghost" onClick={onClose}>Hủy</button>
                   <button className="btn primary" disabled={!c || !sel.length || busy} onClick={submit}>{busy ? 'Đang lưu…' : 'Ghi nhận điểm'}</button>
               </>}>
            <div className="pick">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <b>1. Tiêu chí</b>
                    <div className="row">
                        <button className={`chip${!cat ? ' on' : ''}`} onClick={() => setCat('')}>Tất cả</button>
                        {Object.entries(meta.categories).filter(([k]) => crit.some((x) => x.category === k)).map(([k, v]) => (
                            <button key={k} className={`chip${cat === k ? ' on' : ''}`} onClick={() => setCat(k)}>{v}</button>
                        ))}
                    </div>
                    <input placeholder="Tìm tiêu chí…" value={s} onChange={(e) => setS(e.target.value)} />
                    <div className="crit-list">
                        {shown.map((x) => (
                            <button key={x.id} className={`crit${cid === x.id ? ' on' : ''}`} onClick={() => setCid(x.id)}>
                                <span><b>{x.name}</b><small>{meta.categories[x.category]} · {x.code}</small></span>
                                <span className={`pt ${x.type === 'plus' ? 'good-t' : 'bad-t'}`}>{sgn(x.default_points)}</span>
                            </button>
                        ))}
                        {!shown.length && <Empty text="Không có tiêu chí phù hợp." />}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <b>2. Lớp được chấm</b>
                    <div className="row">{[10, 11, 12].map((g) => <button key={g} className="chip" onClick={() => grade(g)}>Cả khối {g}</button>)}
                        {!!sel.length && <button className="chip" onClick={() => setSel([])}>Bỏ chọn</button>}</div>
                    <div className="cls-grid" style={{ maxHeight: 150, overflowY: 'auto' }}>
                        {meta.classes.map((x) => <button key={x.id} className={`cls${sel.includes(x.id) ? ' on' : ''}`} onClick={() => toggle(x.id)}>{x.name}</button>)}
                    </div>
                    <div className="grid2">
                        <label className="fld">Ngày ghi nhận<input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>
                        <label className="fld">Số điểm (độ lớn)<input type="number" step="0.5" min="0.5" placeholder={c ? String(Math.abs(num(c.default_points))) : 'Mặc định'} value={pts} onChange={(e) => setPts(e.target.value)} /></label>
                    </div>
                    <label className="fld">Ghi chú<textarea value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: 3 học sinh đi muộn tiết 1 thứ Hai" /></label>
                    <p className="hint">Dấu cộng/trừ do loại tiêu chí quyết định, bạn chỉ cần nhập độ lớn. Đang ghi {fmt(mag, 1)} điểm.</p>
                </div>
            </div>
        </Modal>
    );
}