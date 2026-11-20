'use client';
import { useEffect, useMemo, useState } from 'react';
import { wApi, errMsg } from './api';
import { money } from './format';
import type { Impact, Meta, StudentHit, WType } from './types';
import { Avatar, Drawer, Icon, useDebounced, useUI } from './ui';

export default function RequestDrawer({ meta, yearId, onClose, onDone }: { meta: Meta; yearId: number; onClose: () => void; onDone: () => void }) {
    const { toast } = useUI();
    const types = useMemo(() => meta.types.filter((t) => t.is_active), [meta.types]);

    const [q, setQ] = useState('');
    const dq = useDebounced(q, 300);
    const [hits, setHits] = useState<StudentHit[]>([]);
    const [student, setStudent] = useState<StudentHit | null>(null);
    const [type, setType] = useState<WType | null>(null);
    const [percent, setPercent] = useState(0);
    const [terms, setTerms] = useState<string[]>(['HK1', 'HK2']);
    const [reason, setReason] = useState('');
    const [docs, setDocs] = useState<string[]>([]);
    const [priority, setPriority] = useState<'normal' | 'high'>('normal');
    const [approveNow, setApproveNow] = useState(false);
    const [impact, setImpact] = useState<Impact | null>(null);
    const [busy, setBusy] = useState(false);

    // tìm học sinh
    useEffect(() => {
        if (student || dq.trim().length < 2) { setHits([]); return; }
        let live = true;
        wApi.searchStudents(dq.trim(), yearId).then((r) => live && setHits(r)).catch(() => {});
        return () => { live = false; };
    }, [dq, yearId, student]);

    // xem trước tác động lên học phí
    useEffect(() => {
        if (!student || !percent || !terms.length) { setImpact(null); return; }
        let live = true;
        wApi.impact(student.id, yearId, percent, terms).then((r) => live && setImpact(r)).catch(() => {});
        return () => { live = false; };
    }, [student, percent, terms, yearId]);

    const pick = (t: WType) => { setType(t); setPercent(t.default_percent); setDocs([]); };
    const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    const docList = (type?.required_docs || '').split(';').map((s) => s.trim()).filter(Boolean);
    const dup = student && type && student.waivers.some((w) => w.label === type.label);
    const valid = !!student && !!type && percent >= 1 && percent <= 100 && terms.length > 0 && !dup;
    const saved = impact ? impact.terms.reduce((s, t) => s + (t.projected_discount - t.current_discount), 0) : 0;

    async function submit() {
        if (!valid || !student || !type) return;
        setBusy(true);
        try {
            const r = await wApi.createRequest({
                student_id: student.id, school_year_id: yearId, type_id: type.id, percent, terms, reason,
                proof_note: docs.join('; '), priority, approve_now: approveNow && meta.can_approve,
            });
            toast('success', r.approved ? 'Đã lập và duyệt đơn' : 'Đã lập đơn ' + r.code,
                r.approved ? `Miễn giảm ${percent}% cho ${student.full_name} đã có hiệu lực.` : 'Đơn đang chờ người có thẩm quyền duyệt.');
            onDone(); onClose();
        } catch (e) { toast('error', 'Không lập được đơn', errMsg(e)); }
        finally { setBusy(false); }
    }

    return (
        <Drawer title="Lập đơn đề nghị miễn giảm học phí" onClose={onClose}
                footer={<>
                    <button className="wv-btn" onClick={onClose}>Đóng</button>
                    <button className="wv-btn pri" disabled={!valid || busy} onClick={submit}><Icon n="check" /> {busy ? 'Đang lưu…' : approveNow && meta.can_approve ? 'Lập và duyệt ngay' : 'Gửi đơn'}</button>
                </>}>

            {/* 1. Học sinh */}
            <section className="wv-card">
                <h3>1. Chọn học sinh</h3>
                {student ? (
                    <div className="wv-q">
                        <div className="wv-person"><Avatar name={student.full_name} /><div><b>{student.full_name}</b><div className="wv-sub">{student.code} · Lớp {student.class_name} · Khối {student.grade}</div></div></div>
                        <button className="wv-btn sm" onClick={() => { setStudent(null); setQ(''); }}>Đổi</button>
                    </div>
                ) : (
                    <>
                        <div className="wv-search" style={{ maxWidth: 'none' }}><Icon n="search" /><input className="wv-input" autoFocus placeholder="Nhập tên hoặc mã học sinh (tối thiểu 2 ký tự)…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                        {hits.length > 0 && (
                            <div className="wv-hits" style={{ marginTop: 10 }}>
                                {hits.map((h) => (
                                    <button key={h.id} className="wv-hit" onClick={() => setStudent(h)}>
                                        <Avatar name={h.full_name} />
                                        <div style={{ flex: 1 }}><b>{h.full_name}</b><div className="wv-sub">{h.code} · Lớp {h.class_name}</div></div>
                                        {h.waivers.length > 0 && <span className="wv-badge b-approved">Đang miễn giảm {h.waivers.reduce((s, w) => s + w.percent, 0)}%</span>}
                                        {h.pending > 0 && <span className="wv-badge b-pending">{h.pending} đơn chờ</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                        {dq.trim().length >= 2 && hits.length === 0 && <p className="wv-sub">Không tìm thấy học sinh đã xếp lớp trong năm học này.</p>}
                    </>
                )}
                {student && student.waivers.length > 0 && (
                    <div className="wv-callout info" style={{ marginTop: 10 }}><Icon n="info" /><div>Học sinh đang được: {student.waivers.map((w) => `${w.label} (${w.percent}%)`).join(', ')}. Tổng các chính sách cộng dồn tối đa 100% học phí.</div></div>
                )}
            </section>

            {/* 2. Chính sách */}
            <section className="wv-card">
                <h3>2. Chính sách áp dụng</h3>
                <div className="wv-types">
                    {types.map((t) => (
                        <button key={t.id} type="button" className={`wv-type ${type?.id === t.id ? 'on' : ''}`} onClick={() => pick(t)}>
                            <b>{t.label}</b><span>Mặc định {t.default_percent}%</span>
                        </button>
                    ))}
                </div>
                {dup && <div className="wv-callout bad" style={{ marginTop: 10 }}><Icon n="alert" /><div>Học sinh đã được áp dụng chính sách này trong năm học.</div></div>}
                {type?.description && <p className="wv-sub" style={{ marginTop: 10 }}>{type.description}{type.legal_basis ? ` · Căn cứ: ${type.legal_basis}` : ''}</p>}
                <div className="wv-row" style={{ marginTop: 12 }}>
                    <div className="wv-f"><label>Tỷ lệ miễn giảm (%)</label>
                        <input className="wv-input" type="number" min={1} max={100} value={percent || ''} onChange={(e) => setPercent(Math.max(0, Math.min(100, Number(e.target.value))))} />
                        <input type="range" min={0} max={100} step={5} value={percent} onChange={(e) => setPercent(Number(e.target.value))} style={{ accentColor: 'var(--pri)' }} />
                    </div>
                    <div className="wv-f"><label>Học kỳ áp dụng</label>
                        {meta.terms.map((t) => (
                            <label key={t} className="wv-chk" style={{ fontWeight: 600 }}><input type="checkbox" checked={terms.includes(t)} onChange={() => setTerms(toggle(terms, t))} />{t === 'HK1' ? 'Học kỳ 1' : 'Học kỳ 2'}</label>
                        ))}
                    </div>
                </div>
            </section>

            {/* 3. Xem trước */}
            {student && type && impact && (
                <section className="wv-card">
                    <h3>3. Tác động lên học phí (xem trước)</h3>
                    <div className="wv-impact">
                        {impact.terms.map((t) => (
                            <div className="wv-imp" key={t.term}>
                                <div><b>{t.term}</b><div className="wv-sub">{money(t.tuition)}</div></div>
                                <div>
                                    <div className="wv-sub">Giảm {t.current_percent}% → <b style={{ color: 'var(--pri)' }}>{t.projected_percent}%</b>{t.invoice && ` · HĐ ${t.invoice.code}${t.invoice.paid ? ' (đã thu ' + money(t.invoice.paid) + ')' : ''}`}</div>
                                    <div className="wv-meter"><i style={{ width: `${t.projected_percent}%` }} /></div>
                                </div>
                                <div className="wv-money" style={{ color: 'var(--ok)' }}>{t.projected_discount > t.current_discount ? '−' + money(t.projected_discount - t.current_discount) : '—'}</div>
                            </div>
                        ))}
                    </div>
                    <p style={{ margin: '10px 0 0' }}>Tiết kiệm thêm cho gia đình: <b className="wv-money" style={{ color: 'var(--ok)' }}>{money(saved)}</b></p>
                    {impact.capped && <div className="wv-callout warn" style={{ marginTop: 10 }}><Icon n="alert" /><div>Tổng các chính sách vượt 100%, hệ thống sẽ tự giới hạn ở mức miễn toàn bộ học phí.</div></div>}
                </section>
            )}

            {/* 4. Hồ sơ */}
            <section className="wv-card">
                <h3>4. Hồ sơ minh chứng và lý do</h3>
                {docList.length > 0 && <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    {docList.map((d) => (<label key={d} className="wv-chk"><input type="checkbox" checked={docs.includes(d)} onChange={() => setDocs(toggle(docs, d))} /><span>{d}</span></label>))}
                    {docs.length < docList.length && <div className="wv-callout warn"><Icon n="alert" /><div>Còn {docList.length - docs.length} giấy tờ chưa đánh dấu đã nhận. Vẫn có thể gửi đơn nhưng người duyệt sẽ thấy hồ sơ chưa đủ.</div></div>}
                </div>}
                <div className="wv-f"><label>Lý do / ghi chú</label><textarea className="wv-area" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: Phụ huynh nộp giấy xác nhận hộ nghèo ngày…" /></div>
                <div className="wv-row" style={{ marginTop: 12 }}>
                    <label className="wv-chk"><input type="checkbox" checked={priority === 'high'} onChange={(e) => setPriority(e.target.checked ? 'high' : 'normal')} />Đánh dấu ưu tiên xử lý</label>
                    {meta.can_approve && <label className="wv-chk"><input type="checkbox" checked={approveNow} onChange={(e) => setApproveNow(e.target.checked)} />Duyệt ngay khi lập đơn</label>}
                </div>
                {meta.auto_apply && <p className="wv-sub" style={{ marginBottom: 0 }}>Khi đơn được duyệt, hệ thống tự trừ vào hóa đơn học phí chưa thu của học sinh.</p>}
            </section>
        </Drawer>
    );
}