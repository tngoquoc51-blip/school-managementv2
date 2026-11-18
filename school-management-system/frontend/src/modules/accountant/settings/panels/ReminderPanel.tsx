'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, SettingsApi, Template } from '../api';
import { Card, Confirm, Field, Modal, Skeleton, Switch, dt, useToast } from '../ui';
import { useFeeSettings } from '../useFeeSettings';
import SaveFooter from './SaveFooter';

const LEVEL: Record<number, string> = { 1: 'Nhắc nhẹ', 2: 'Quá hạn', 3: 'Lần cuối' };
const VARS = ['ten_hs', 'ma_hs', 'lop', 'ten_truong', 'so_hoa_don', 'so_tien_no', 'han_nop', 'so_ngay_qua_han', 'thong_tin_thanh_toan', 'lien_he'];
const SAMPLE: Record<string, string> = {
    ten_hs: 'Nguyễn Văn A', ma_hs: 'hs250001', lop: '10A1', ten_truong: 'Trường THPT', so_hoa_don: '2',
    so_tien_no: '2.050.000đ', han_nop: '30/11/2026', so_ngay_qua_han: '5',
    thong_tin_thanh_toan: 'Chuyển khoản: Vietcombank — 0011004567890', lien_he: 'Phòng Kế toán nhà trường',
};
const render = (s: string) => s.replace(/\{(\w+)\}/g, (m, k) => SAMPLE[k] ?? m).replace(/\\n/g, '\n');

export default function ReminderPanel({ onChanged }: { onChanged: () => void }) {
    const toast = useToast();
    const s = useFeeSettings(['reminder_gap_days', 'reminder_contact']);
    const [rows, setRows] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [edit, setEdit] = useState<Partial<Template> | null>(null);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [del, setDel] = useState<Template | null>(null);
    const [busy, setBusy] = useState(false);
    const bodyRef = useRef<HTMLTextAreaElement>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try { setRows((await SettingsApi.templates()).data); }
        catch (e) { toast('error', 'Không tải được mẫu thông báo', (e as Error).message); }
        finally { setLoading(false); }
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (!edit) return;
        setBusy(true); setErrs({});
        try {
            const body = { code: edit.code, name: edit.name, level: Number(edit.level), subject: edit.subject, body: edit.body };
            const r: any = edit.id ? await SettingsApi.updateTemplate(edit.id, body) : await SettingsApi.createTemplate(body);
            toast('success', r.message); setEdit(null); load(); onChanged();
        } catch (e) {
            const err = e as ApiError;
            if (err.errors) setErrs(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
            toast('error', 'Chưa lưu được', err.message);
        } finally { setBusy(false); }
    };

    const toggle = async (t: Template) => {
        try { const r: any = await SettingsApi.toggleTemplate(t.id); toast('success', r.message); load(); onChanged(); }
        catch (e) { toast('error', 'Không đổi được trạng thái', (e as Error).message); }
    };

    const remove = async () => {
        if (!del) return;
        setBusy(true);
        try { const r: any = await SettingsApi.deleteTemplate(del.id); toast('success', r.message); setDel(null); load(); onChanged(); }
        catch (e) { toast('error', 'Không xóa được', (e as Error).message); setDel(null); }
        finally { setBusy(false); }
    };

    const insertVar = (v: string) => {
        const el = bodyRef.current; const ins = `{${v}}`;
        const cur = edit?.body || '';
        if (!el) return setEdit((x) => ({ ...x!, body: cur + ins }));
        const a = el.selectionStart, b = el.selectionEnd;
        setEdit((x) => ({ ...x!, body: cur.slice(0, a) + ins + cur.slice(b) }));
        setTimeout(() => { el.focus(); el.setSelectionRange(a + ins.length, a + ins.length); }, 0);
    };

    const f = s.form;
    return (
        <>
            <Card title="Quy tắc nhắc nợ" desc="Áp dụng khi gửi thông báo nhắc học phí từ mục Công nợ."
                  footer={<SaveFooter dirty={s.dirty} busy={s.busy} onSave={s.save} onReset={s.reset} />}>
                {s.loading ? <Skeleton rows={2} /> : (
                    <div className="acs-pad acs-grid">
                        <Field label="Số ngày tối thiểu giữa hai lần nhắc" error={s.errors.reminder_gap_days} hint="Tránh làm phiền phụ huynh: không nhắc lại cùng một học sinh trước số ngày này">
                            <input type="number" min={1} max={30} value={f.reminder_gap_days} onChange={(e) => s.set('reminder_gap_days', e.target.value)} />
                        </Field>
                        <Field label="Đơn vị liên hệ ghi cuối thông báo" error={s.errors.reminder_contact}>
                            <input value={f.reminder_contact} onChange={(e) => s.set('reminder_contact', e.target.value)} />
                        </Field>
                    </div>
                )}
            </Card>

            <Card title="Mẫu thông báo nhắc nợ" desc="Soạn nội dung gửi phụ huynh theo 3 mức: nhắc nhẹ, quá hạn, lần cuối.">
                <div className="acs-tools" style={{ justifyContent: 'flex-end' }}>
                    <button className="acs-btn" onClick={() => { setErrs({}); setEdit({ code: '', name: '', level: 1, subject: '', body: '' }); }}>+ Thêm mẫu</button>
                </div>
                {loading ? <Skeleton /> : (
                    <div className="acs-wrap">
                        <table className="acs-table">
                            <thead><tr><th>Mẫu</th><th>Mức</th><th>Tiêu đề</th><th>Cập nhật</th><th>Bật</th><th /></tr></thead>
                            <tbody>
                            {rows.map((t) => (
                                <tr key={t.id}>
                                    <td><b>{t.name}</b><div style={{ color: '#64748b', fontSize: 12 }}>{t.code}{t.is_system ? ' · Hệ thống' : ''}</div></td>
                                    <td><span className={`acs-tag ${t.level === 1 ? '' : t.level === 2 ? 'warn' : 'off'}`}>{LEVEL[t.level]}</span></td>
                                    <td style={{ maxWidth: 280 }}>{t.subject}</td>
                                    <td>{dt(t.updated_at)}</td>
                                    <td><span className="acs-switch"><input type="checkbox" checked={!!t.is_active} onChange={() => toggle(t)} /><span /></span></td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <button className="acs-btn ghost sm" onClick={() => { setErrs({}); setEdit({ ...t }); }}>Sửa</button>{' '}
                                        {!t.is_system && <button className="acs-btn danger sm" onClick={() => setDel(t)}>Xóa</button>}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {edit && (
                <Modal title={edit.id ? 'Sửa mẫu thông báo' : 'Thêm mẫu thông báo'} onClose={() => setEdit(null)}
                       footer={<><button className="acs-btn ghost" onClick={() => setEdit(null)}>Hủy</button><button className="acs-btn" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu mẫu'}</button></>}>
                    <div className="acs-grid">
                        <Field label="Mã mẫu" error={errs.code} hint="Chữ IN HOA, số, gạch dưới">
                            <input disabled={!!edit.is_system} value={edit.code || ''} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} />
                        </Field>
                        <Field label="Mức nhắc" error={errs.level}>
                            <select value={edit.level} onChange={(e) => setEdit({ ...edit, level: Number(e.target.value) })}>
                                <option value={1}>1 – Nhắc nhẹ</option><option value={2}>2 – Quá hạn</option><option value={3}>3 – Lần cuối</option>
                            </select>
                        </Field>
                        <Field label="Tên mẫu" error={errs.name} span><input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
                        <Field label="Tiêu đề" error={errs.subject} span><input value={edit.subject || ''} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></Field>
                        <Field label="Nội dung" error={errs.body} span hint={`${(edit.body || '').length}/1500 ký tự`}>
                            <textarea ref={bodyRef} style={{ minHeight: 150 }} value={edit.body || ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
                            <div className="acs-chips">{VARS.map((v) => <button key={v} type="button" onClick={() => insertVar(v)}>{`{${v}}`}</button>)}</div>
                        </Field>
                        <div className="acs-span">
                            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Xem trước với dữ liệu mẫu</div>
                            <div className="acs-preview"><b>{render(edit.subject || '')}</b>{'\n\n'}{render(edit.body || '')}</div>
                        </div>
                    </div>
                </Modal>
            )}
            {del && <Confirm title="Xóa mẫu" danger busy={busy} okText="Xóa" onOk={remove} onCancel={() => setDel(null)} text={`Xóa mẫu "${del.name}"?`} />}
        </>
    );
}