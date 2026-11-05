'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import c from './approval.module.css';
import { approvalApi, type Delegation, type StaffOpt } from '../services/approvalService';

const STATE = { active: ['Đang hiệu lực', c.sActive], scheduled: ['Sắp hiệu lực', c.sScheduled], expired: ['Đã hết hạn', c.sExpired], revoked: ['Đã thu hồi', c.sRevoked] } as const;
const vn = (s: string) => s.slice(0, 10).split('-').reverse().join('/');
const today = () => new Date().toISOString().slice(0, 10);
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.');

export default function DelegationPanel({ notify }: { notify: (ok: boolean, m: string) => void }) {
    const [data, setData] = useState<{ given: Delegation[]; received: Delegation[]; staff: StaffOpt[] } | null>(null);
    const [form, setForm] = useState({ delegate_id: '', from_date: today(), to_date: today(), note: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try { setData(await approvalApi.delegations()); setError(''); } catch (e) { setError(msg(e)); }
    }, []);
    useEffect(() => { load(); }, [load]);

    async function submit(e: FormEvent) {
        e.preventDefault();
        if (!form.delegate_id) return notify(false, 'Chọn người được ủy quyền.');
        setBusy(true);
        try { notify(true, await approvalApi.createDelegation({ ...form, delegate_id: Number(form.delegate_id) })); setForm({ ...form, note: '' }); await load(); }
        catch (er) { notify(false, msg(er)); } finally { setBusy(false); }
    }
    async function revoke(id: number) {
        try { notify(true, await approvalApi.revokeDelegation(id)); await load(); } catch (er) { notify(false, msg(er)); }
    }

    const list = (title: string, rows: Delegation[], canRevoke: boolean, who: string) => (
        <section className={c.panel}>
            <div className={c.sec}><h2>{title}</h2></div>
            {rows.length === 0 ? <p className={c.empty}>Chưa có ủy quyền nào.</p> : rows.map((d) => (
                <div key={d.id} className={c.item}>
                    <div><b>{who} {d.other_name}</b><br /><small>{vn(d.from_date)} – {vn(d.to_date)}{d.note ? ` · ${d.note}` : ''}</small></div>
                    <div style={{ textAlign: 'right' }}>
                        <span className={`${c.chip} ${STATE[d.state][1]}`} style={{ marginRight: 0 }}>{STATE[d.state][0]}</span>
                        {canRevoke && (d.state === 'active' || d.state === 'scheduled') && <div><button className={c.btn} style={{ marginTop: '.4rem', padding: '.25rem .7rem' }} onClick={() => revoke(d.id)}>Thu hồi</button></div>}
                    </div>
                </div>
            ))}
        </section>
    );

    return (
        <div className={c.cols}>
            <form className={`${c.panel} ${c.form}`} onSubmit={submit}>
                <h2>Ủy quyền phê duyệt</h2>
                <p className={c.sub} style={{ margin: 0 }}>Người được ủy quyền sẽ vào được hộp thư Phê duyệt và xử lý thay bạn trong thời hạn đã chọn.</p>
                <label>Người được ủy quyền
                    <select className={c.input} value={form.delegate_id} onChange={(e) => setForm({ ...form, delegate_id: e.target.value })}>
                        <option value="">— Chọn —</option>
                        {data?.staff.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
                    </select>
                </label>
                <label>Từ ngày<input className={c.input} type="date" min={today()} value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></label>
                <label>Đến ngày<input className={c.input} type="date" min={form.from_date} value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></label>
                <label>Ghi chú<input className={c.input} maxLength={255} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ví dụ: đi công tác" /></label>
                <button className={`${c.go} ${c.goOk}`} style={{ padding: '.7rem' }} disabled={busy}>{busy ? 'Đang lưu…' : 'Tạo ủy quyền'}</button>
            </form>
            <div style={{ display: 'grid', gap: '1.25rem' }}>
                {error && <div role="alert" className={c.err}><span>{error}</span><button onClick={load}>Thử lại</button></div>}
                {list('Tôi đã ủy quyền', data?.given ?? [], true, 'Cho')}
                {list('Tôi được ủy quyền', data?.received ?? [], false, 'Từ')}
            </div>
        </div>
    );
}