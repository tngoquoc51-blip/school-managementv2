'use client';
import { useState } from 'react';
import { api, qs } from '../../_lib/api';
import { Drawer, Field, Pager, dd, dt, downloadCsv, useDebounced, useList, useToast } from '../_wm';

const STATUS: Record<string, string> = { new: 'Mới đăng ký', contacted: 'Đã liên hệ', invited: 'Mời nộp hồ sơ', enrolled: 'Đã nhập học', rejected: 'Chưa phù hợp' };
const FLOW = ['new', 'contacted', 'invited', 'enrolled'];
const SUGGEST: Record<string, string> = {
    contacted: 'Nhà trường đã gọi tư vấn phụ huynh.',
    invited: 'Mời phụ huynh mang hồ sơ bản giấy đến văn phòng nhà trường ngày [ngày] lúc [giờ].',
    enrolled: 'Hồ sơ đã hoàn tất. Học sinh sẽ nhận tài khoản cổng thông tin từ giáo vụ.',
    rejected: 'Hồ sơ chưa đủ điều kiện. Vui lòng liên hệ văn phòng nhà trường để được giải thích.',
};
const ageOf = (s: string) => { const d = new Date(s); if (isNaN(+d)) return ''; const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return `${a} tuổi`; };

export default function AdmissionsPage() {
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const dq = useDebounced(q);
    const sum = useList<any>('website/summary');
    const list = useList<any>(`website/admissions${qs({ status, q: dq, page })}`);
    const [sel, setSel] = useState<any>(null);
    const [st, setSt] = useState('new');
    const [note, setNote] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const toast = useToast();

    const open = (r: any) => { setSel(r); setSt(r.status); setNote(r.status_note || ''); setErr(''); };
    const pickStatus = (k: string) => { setSt(k); if (SUGGEST[k] && (!note.trim() || Object.values(SUGGEST).includes(note))) setNote(SUGGEST[k]); };
    const dirty = sel && (st !== sel.status || (note || '') !== (sel.status_note || ''));

    async function save() {
        setBusy(true); setErr('');
        try {
            await api(`website/admissions/${sel.id}`, { method: 'PUT', body: { status: st, status_note: note } });
            toast.ok('Đã cập nhật hồ sơ ' + sel.code); setSel(null); list.reload(); sum.reload();
        } catch (e: any) { setErr(e.errors?.status_note || e.message); } finally { setBusy(false); }
    }
    async function remove(r: any) {
        if (!confirm(`Xóa hồ sơ ${r.code} của ${r.full_name}? Không thể khôi phục.`)) return;
        try { await api(`website/admissions/${r.id}`, { method: 'DELETE' }); toast.ok('Đã xóa hồ sơ.'); setSel(null); list.reload(); sum.reload(); } catch (e: any) { toast.fail(e.message); }
    }
    async function copy(text: string) { try { await navigator.clipboard.writeText(text); toast.ok('Đã sao chép ' + text); } catch { toast.fail('Trình duyệt không cho sao chép.'); } }
    async function exportCsv() {
        try {
            const d = await api<any>(`website/admissions/export${qs({ status, q: dq })}`);
            downloadCsv(`ho-so-tuyen-sinh-${new Date().toISOString().slice(0, 10)}.csv`,
                ['Mã hồ sơ', 'Họ tên', 'Ngày sinh', 'Giới tính', 'Trường THCS', 'Phụ huynh', 'Điện thoại', 'Email', 'Tổ hợp', 'Câu hỏi', 'Trạng thái', 'Ghi chú nhà trường', 'Ngày đăng ký'],
                d.items.map((r: any) => [r.code, r.full_name, dd(r.dob), r.gender, r.middle_school, r.parent_name, `="${r.phone}"`, r.email, r.track, r.note, STATUS[r.status] ?? r.status, r.status_note, dt(r.created_at)]));
            toast.ok(`Đã xuất ${d.items.length} hồ sơ.`);
        } catch (e: any) { toast.fail(e.message); }
    }

    const by = sum.data?.admissions?.by_status ?? {};
    const pick = (s: string) => { setStatus(s); setPage(1); };
    const idx = sel ? FLOW.indexOf(sel.status) : -1;
    return (
        <div className="wm">
            {toast.node}
            <div className="wm-head">
                <div><h1>Hồ sơ tuyển sinh</h1><p>Đăng ký trực tuyến từ website. Bấm vào tên học sinh để xem chi tiết, gọi tư vấn rồi cập nhật trạng thái cho phụ huynh tra cứu.</p></div>
                <div className="wm-act"><button className="wm-btn ghost" onClick={exportCsv}>Xuất Excel (CSV)</button></div>
            </div>
            <div className="wm-stats">
                <button className={`wm-stat ${status === '' ? 'on' : ''}`} onClick={() => pick('')}><span>Tất cả</span><b>{sum.data?.admissions?.total ?? '…'}</b></button>
                {Object.entries(STATUS).map(([k, v]) => <button key={k} className={`wm-stat ${status === k ? 'on' : ''}`} onClick={() => pick(k)}><span>{v}</span><b>{by[k] ?? 0}</b></button>)}
            </div>
            <section className="wm-card">
                <div className="wm-bar"><input className="wm-in" placeholder="Tìm theo tên, mã hồ sơ, số điện thoại, phụ huynh, trường THCS…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
                {list.err ? <div className="wm-state err">{list.err} <button className="wm-btn sm" onClick={list.reload}>Thử lại</button></div>
                    : list.loading && !list.data ? <div className="wm-state">Đang tải…</div>
                        : !list.data?.items.length ? <div className="wm-state">Chưa có hồ sơ nào phù hợp.</div> : (
                            <div className="wm-tw"><table className="wm-table"><thead><tr><th>Mã</th><th>Học sinh</th><th>Phụ huynh</th><th>Tổ hợp</th><th>Trạng thái</th><th>Đăng ký</th><th /></tr></thead><tbody>
                            {list.data.items.map((r: any) => (
                                <tr key={r.id} className="wm-click" onDoubleClick={() => open(r)}>
                                    <td><span className="wm-code">{r.code}</span></td>
                                    <td><button className="wm-name" onClick={() => open(r)}>{r.full_name}</button><span className="wm-sub">{dd(r.dob)} · {r.gender} · {r.middle_school}</span></td>
                                    <td>{r.parent_name}<span className="wm-sub"><a href={`tel:${r.phone}`}>{r.phone}</a></span></td>
                                    <td>{r.track}</td>
                                    <td><span className={`wm-pill ${r.status}`}>{STATUS[r.status]}</span>{r.status_note && <span className="wm-sub">{r.status_note}</span>}</td>
                                    <td>{dt(r.created_at)}</td>
                                    <td className="n"><button className="wm-btn sm" onClick={() => open(r)}>Chi tiết</button> <button className="wm-btn danger sm" onClick={() => remove(r)}>Xóa</button></td>
                                </tr>
                            ))}</tbody></table></div>
                        )}
                {list.data && <Pager page={list.data.page} pages={list.data.pages} total={list.data.total} unit="hồ sơ" onChange={setPage} />}
            </section>

            {sel && (
                <Drawer title={sel.full_name} sub={`Mã ${sel.code} · đăng ký ${dt(sel.created_at)}`} onClose={() => setSel(null)}
                        foot={<><button className="wm-btn danger" onClick={() => remove(sel)}>Xóa hồ sơ</button><span style={{ flex: 1 }} /><button className="wm-btn ghost" onClick={() => setSel(null)}>Đóng</button><button className="wm-btn" disabled={busy || !dirty} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu cập nhật'}</button></>}>
                    <div className="wm-sec">
                        <h4>Tiến độ hiện tại</h4>
                        {sel.status === 'rejected' ? <p className="wm-warn">Hồ sơ này đang ở trạng thái “Chưa phù hợp”.</p> : (
                            <ol className="wm-steps">{FLOW.map((k, i) => <li key={k} className={i < idx ? 'done' : i === idx ? 'now' : ''}><span>{i < idx ? '✓' : i + 1}</span>{STATUS[k]}</li>)}</ol>
                        )}
                    </div>
                    <div className="wm-sec">
                        <h4>Liên hệ nhanh</h4>
                        <div className="wm-quick">
                            <a className="wm-btn sm" href={`tel:${sel.phone}`}>Gọi {sel.phone}</a>
                            {sel.email && <a className="wm-btn ghost sm" href={`mailto:${sel.email}?subject=${encodeURIComponent('Hồ sơ tuyển sinh ' + sel.code)}`}>Gửi email</a>}
                            <button className="wm-btn ghost sm" onClick={() => copy(sel.code)}>Sao chép mã hồ sơ</button>
                        </div>
                    </div>
                    <div className="wm-sec">
                        <h4>Học sinh</h4>
                        <dl className="wm-dl">
                            <dt>Họ và tên</dt><dd>{sel.full_name}</dd>
                            <dt>Ngày sinh</dt><dd>{dd(sel.dob)} {ageOf(sel.dob) && `(${ageOf(sel.dob)})`}</dd>
                            <dt>Giới tính</dt><dd>{sel.gender}</dd>
                            <dt>Trường THCS</dt><dd>{sel.middle_school}</dd>
                            <dt>Tổ hợp quan tâm</dt><dd>{sel.track}</dd>
                        </dl>
                    </div>
                    <div className="wm-sec">
                        <h4>Phụ huynh</h4>
                        <dl className="wm-dl">
                            <dt>Họ và tên</dt><dd>{sel.parent_name}</dd>
                            <dt>Điện thoại</dt><dd><a href={`tel:${sel.phone}`}>{sel.phone}</a></dd>
                            <dt>Email</dt><dd>{sel.email ? <a href={`mailto:${sel.email}`}>{sel.email}</a> : 'Không có'}</dd>
                        </dl>
                    </div>
                    <div className="wm-sec">
                        <h4>Phụ huynh muốn hỏi</h4>
                        {sel.note ? <p className="wm-quote">{sel.note}</p> : <p className="wm-sub">Phụ huynh không để lại câu hỏi.</p>}
                    </div>
                    <div className="wm-sec">
                        <h4>Xử lý hồ sơ</h4>
                        <div className="wm-chips">{Object.entries(STATUS).map(([k, v]) => <button key={k} type="button" className={`wm-chip ${st === k ? 'on' : ''}`} onClick={() => pickStatus(k)}>{v}</button>)}</div>
                        <Field label="Ghi chú gửi phụ huynh" hint="Phụ huynh thấy dòng này ở trang Tra cứu hồ sơ trên website. Thay phần [ngày], [giờ] bằng thông tin thật." err={err}>
                            <textarea className="wm-ta" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
                        </Field>
                        {sel.updated_at && <p className="wm-sub">Cập nhật lần cuối: {dt(sel.updated_at)}</p>}
                    </div>
                </Drawer>
            )}
        </div>
    );
}