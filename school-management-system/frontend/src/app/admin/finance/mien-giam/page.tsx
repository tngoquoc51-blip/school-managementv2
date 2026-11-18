'use client';
// Miễn giảm học phí (/admin/finance/mien-giam)
import React, { useEffect, useState } from 'react';
import { Btn, Card, Confirm, Empty, ErrorBox, Field, Ico, Loading, Modal, Pill, fi, num, qs, useDebounced, useFi, useLoad, useTa } from '../_fi';

type W = { id: number; student_id: number; sname: string; scode: string; class_name: string | null; label: string; percent: number; note: string | null; approved_by: string | null };
type Stu = { id: number; code: string; name: string; class_name: string | null };
const PRESETS = ['Con thương binh / liệt sĩ', 'Hộ nghèo', 'Hộ cận nghèo', 'Dân tộc thiểu số vùng khó', 'Con giáo viên', 'Anh chị em ruột', 'Học sinh giỏi (học bổng)'];

export default function WaiversPage() {
    const { yearId, meta } = useFi(); const { toast } = useTa();
    const [q, setQ] = useState(''); const dq = useDebounced(q);
    const { data, err, loading, reload } = useLoad(() => fi<{ data: W[] }>(`waivers${qs({ year_id: yearId, q: dq })}`), [yearId, dq]);
    const [edit, setEdit] = useState<W | 'new' | null>(null); const [del, setDel] = useState<W | null>(null);
    const list = data?.data || []; const avg = list.length ? Math.round(list.reduce((s, w) => s + w.percent, 0) / list.length) : 0;
    return (
        <div className="ta-page">
            <div className="fi-kpis four">
                <div className="fi-kpi t-green"><div className="top"><small>Học sinh được miễn giảm</small><span className="ic"><Ico n="shield" size={17} /></span></div><b>{num(new Set(list.map((w) => w.student_id)).size)}</b><em>năm học {meta.years.find((y) => y.id === yearId)?.label}</em></div>
                <div className="fi-kpi t-gold"><div className="top"><small>Mức giảm trung bình</small><span className="ic"><Ico n="trend" size={17} /></span></div><b>{avg}%</b><em>{num(list.length)} quyết định</em></div>
                <div className="fi-kpi t-sky"><div className="top"><small>Giảm 100%</small><span className="ic"><Ico n="check" size={17} /></span></div><b>{num(list.filter((w) => w.percent >= 100).length)}</b><em>miễn hoàn toàn</em></div>
                <div className="fi-kpi t-violet"><div className="top"><small>Diện phổ biến</small><span className="ic"><Ico n="users" size={17} /></span></div><b style={{ fontSize: 16 }}>{top(list)}</b><em>nhiều quyết định nhất</em></div>
            </div>
            <div className="ta-filters"><label className="ta-search"><Ico n="search" size={16} /><input placeholder="Tìm học sinh, mã HS, diện miễn giảm…" value={q} onChange={(e) => setQ(e.target.value)} /></label><span style={{ flex: 1 }} /><Btn tone="primary" onClick={() => setEdit('new')}><Ico n="plus" size={16} />Thêm miễn giảm</Btn></div>
            <Card pad={false}>
                {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : list.length === 0 ? <Empty icon="shield" title="Chưa có quyết định miễn giảm nào" text="Thêm miễn giảm cho học sinh thuộc diện chính sách." /> : (
                    <div className="ta-tablewrap"><table className="ta-tbl"><thead><tr><th>Học sinh</th><th>Diện miễn giảm</th><th>Mức giảm</th><th>Người duyệt</th><th /></tr></thead><tbody>
                    {list.map((w) => <tr key={w.id}><td><b>{w.sname}</b><small>{w.scode}{w.class_name ? ` · ${w.class_name}` : ''}</small></td><td>{w.label}{w.note && <small>{w.note}</small>}</td><td><Pill tone={w.percent >= 100 ? 'green' : 'amber'}>{w.percent}%</Pill></td><td>{w.approved_by || '—'}</td>
                        <td className="ta-rowact"><Btn size="sm" onClick={() => setEdit(w)}>Sửa</Btn><Btn size="sm" tone="danger" onClick={() => setDel(w)}>Xóa</Btn></td></tr>)}</tbody></table></div>)}
            </Card>
            <p className="ta-mute">Miễn giảm được ghi nhận theo học sinh và năm học, áp dụng cho các hóa đơn phát hành sau khi lưu. Hóa đơn đã phát hành không tự đổi số tiền.</p>
            {edit && <Form w={edit === 'new' ? null : edit} yearId={yearId} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); toast('Đã lưu miễn giảm.'); }} />}
            {del && <Confirm title="Xóa miễn giảm?" tone="danger" okText="Xóa" text={<>Xóa “{del.label}” ({del.percent}%) của <b>{del.sname}</b>?</>} onClose={() => setDel(null)} onOk={async () => { await fi(`waivers/${del.id}`, { method: 'DELETE' }); toast('Đã xóa miễn giảm.'); setDel(null); reload(); }} />}
        </div>
    );
}
function top(l: W[]) { const m: Record<string, number> = {}; l.forEach((w) => { m[w.label] = (m[w.label] || 0) + 1; }); const e = Object.entries(m).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : '—'; }

function Form({ w, yearId, onClose, onDone }: { w: W | null; yearId: number; onClose: () => void; onDone: () => void }) {
    const [stu, setStu] = useState<Stu | null>(w ? { id: w.student_id, code: w.scode, name: w.sname, class_name: w.class_name } : null);
    const [q, setQ] = useState(''); const dq = useDebounced(q); const [found, setFound] = useState<Stu[]>([]);
    const [label, setLabel] = useState(w?.label || ''); const [percent, setPercent] = useState(String(w?.percent ?? 50)); const [note, setNote] = useState(w?.note || '');
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    useEffect(() => { if (stu || dq.trim().length < 2) { setFound([]); return; } fi<{ data: Stu[] }>(`students/search${qs({ q: dq, year_id: yearId })}`).then((r) => setFound(r.data)).catch(() => setFound([])); }, [dq, stu, yearId]);
    const go = async () => {
        setErr(''); const p = Number(percent);
        if (!stu) { setErr('Hãy chọn học sinh.'); return; } if (!label.trim()) { setErr('Hãy nhập diện miễn giảm.'); return; } if (!(p >= 1 && p <= 100)) { setErr('Mức giảm phải từ 1 đến 100%.'); return; }
        setBusy(true);
        try { await fi(w ? `waivers/${w.id}` : 'waivers', { method: w ? 'PUT' : 'POST', body: { student_id: stu.id, school_year_id: yearId, label: label.trim(), percent: p, note: note.trim() || null } }); onDone(); } catch (e) { setErr((e as Error).message); setBusy(false); }
    };
    return (
        <Modal title={w ? 'Sửa miễn giảm' : 'Thêm miễn giảm học phí'} onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={go}>Lưu</Btn></>}>
            <Field label="Học sinh *">
                {stu ? <div className="fi-note fi-row" style={{ justifyContent: 'space-between', marginBottom: 0 }}><span><b>{stu.name}</b> · {stu.code}{stu.class_name ? ` · ${stu.class_name}` : ''}</span>{!w && <Btn size="sm" onClick={() => setStu(null)}>Đổi</Btn>}</div>
                    : <><input autoFocus placeholder="Gõ tên hoặc mã học sinh…" value={q} onChange={(e) => setQ(e.target.value)} />
                        {found.length > 0 && <ul className="fi-pays" style={{ marginTop: 8 }}>{found.map((s) => <li key={s.id} style={{ cursor: 'pointer' }} onClick={() => setStu(s)}><div><b>{s.name}</b><small>{s.code}{s.class_name ? ` · ${s.class_name}` : ''}</small></div><Ico n="chevR" size={16} /></li>)}</ul>}</>}
            </Field>
            <Field label="Diện miễn giảm *"><input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={160} list="fi-presets" placeholder="Chọn hoặc tự nhập" /><datalist id="fi-presets">{PRESETS.map((p) => <option key={p} value={p} />)}</datalist></Field>
            <Field label={`Mức giảm: ${percent || 0}%`}><input type="range" min={5} max={100} step={5} value={Number(percent) || 5} onChange={(e) => setPercent(e.target.value)} /></Field>
            <Field label="Ghi chú / số quyết định"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
            {err && <p className="ta-ferr">{err}</p>}
        </Modal>
    );
}