'use client';
import { useRef, useState } from 'react';
import { api, KtError, LEVEL_TONE, RMeta, Settings, Template } from '../_lib/rm';
import { Card, Chip, Field, Modal } from '../../periods/_components/ui';

type Props = { meta: RMeta; onReload: () => void; toast: { ok: (m: string) => void; fail: (m: string) => void } };
const SAMPLE: Record<string, string> = { ten_hs: 'Nguyễn Văn An', ma_hs: 'HS250001', lop: '10A1', so_tien_no: '3.150.000đ', tien_qua_han: '3.150.000đ', han_nop: '28/02/2026', so_hoa_don: '1', so_ngay_qua_han: '45', ngay_hen: '05/11/2026', tien_hen: '1.500.000đ' };

function Editor({ meta, tpl, onClose, onSaved, toast }: { meta: RMeta; tpl: Template | null; onClose: () => void; onSaved: () => void; toast: Props['toast'] }) {
    const [name, setName] = useState(tpl?.name ?? '');
    const [level, setLevel] = useState(tpl?.level ?? 1);
    const [subject, setSubject] = useState(tpl?.subject ?? '');
    const [body, setBody] = useState(tpl?.body ?? '');
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const focus = useRef<'subject' | 'body'>('body');
    const sj = useRef<HTMLInputElement>(null);
    const bd = useRef<HTMLTextAreaElement>(null);
    const ctx: Record<string, string> = { ...SAMPLE, ten_truong: meta.settings.school_name, thong_tin_thanh_toan: meta.settings.payment_info_effective, lien_he: meta.settings.contact, nguoi_gui: 'Kế toán' };
    const render = (t: string) => t.replace(/\{([a-z_]+)\}/g, (m, k) => ctx[k] ?? m);
    const insert = (k: string) => {
        const tag = `{${k}}`; const el = focus.current === 'subject' ? sj.current : bd.current; const cur = focus.current === 'subject' ? subject : body;
        const s = el?.selectionStart ?? cur.length; const e = el?.selectionEnd ?? cur.length;
        (focus.current === 'subject' ? setSubject : setBody)(cur.slice(0, s) + tag + cur.slice(e));
        setTimeout(() => { el?.focus(); el?.setSelectionRange(s + tag.length, s + tag.length); }, 0);
    };
    const save = async () => {
        setBusy(true); setErrs({});
        try {
            await api(tpl ? `reminders/templates/${tpl.id}` : 'reminders/templates', { method: tpl ? 'PUT' : 'POST', body: { name, level, subject, body } });
            toast.ok(tpl ? 'Đã cập nhật mẫu tin.' : 'Đã tạo mẫu tin mới.'); onSaved();
        } catch (e) { const x = e as KtError; setErrs(Object.keys(x.errors || {}).length ? x.errors : { name: x.message }); } finally { setBusy(false); }
    };
    return (
        <Modal wide title={tpl ? 'Sửa mẫu tin' : 'Tạo mẫu tin mới'} onClose={() => !busy && onClose()}
               foot={<><button className="pd-btn ghost" disabled={busy} onClick={onClose}>Hủy</button><button className="pd-btn" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu mẫu tin'}</button></>}>
            <div className="rmd-compose">
                <div className="rmd-left">
                    <Field label="Tên mẫu" error={errs.name} htmlFor="tp-n"><input id="tp-n" className="pd-in" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
                    <Field label="Mức nhắc" error={errs.level} htmlFor="tp-l"><select id="tp-l" className="pd-in" value={level} onChange={(e) => setLevel(Number(e.target.value))}>{meta.levels.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</select></Field>
                    <Field label="Tiêu đề" error={errs.subject} htmlFor="tp-s"><input id="tp-s" ref={sj} className="pd-in" maxLength={120} value={subject} onFocus={() => (focus.current = 'subject')} onChange={(e) => setSubject(e.target.value)} /></Field>
                    <Field label="Nội dung" error={errs.body} hint={`${body.length}/1500 ký tự`} htmlFor="tp-b"><textarea id="tp-b" ref={bd} className="pd-in" rows={9} maxLength={1500} value={body} onFocus={() => (focus.current = 'body')} onChange={(e) => setBody(e.target.value)} /></Field>
                    <div className="rmd-vars"><span>Chèn thông tin:</span>{meta.placeholders.map((p) => <button key={p.key} type="button" title={p.label} onClick={() => insert(p.key)}>{p.label}</button>)}</div>
                </div>
                <div className="rmd-right"><h4>Xem trước với học sinh mẫu</h4>
                    <article className="rmd-phone inapp"><h5>{render(subject) || '(chưa có tiêu đề)'}</h5><p>{render(body) || '(chưa có nội dung)'}</p></article>
                </div>
            </div>
        </Modal>
    );
}

function SettingsCard({ s, onSaved, toast }: { s: Settings; onSaved: () => void; toast: Props['toast'] }) {
    const [gap, setGap] = useState(String(s.gap_days));
    const [contact, setContact] = useState(s.contact);
    const [pay, setPay] = useState(s.payment_info);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const save = async () => {
        setBusy(true); setErrs({});
        try { await api('reminders/settings', { method: 'POST', body: { gap_days: Number(gap), contact, payment_info: pay } }); toast.ok('Đã lưu cài đặt nhắc nợ.'); onSaved(); }
        catch (e) { const x = e as KtError; setErrs(x.errors || {}); if (!Object.keys(x.errors || {}).length) toast.fail(x.message); } finally { setBusy(false); }
    };
    return (
        <Card title="Cài đặt chung" right={<span className="pd-muted">Áp dụng cho mọi đợt nhắc</span>}>
            <div className="rmd-set">
                <Field label="Khoảng cách tối thiểu giữa hai lần nhắc (ngày)" error={errs.gap_days} hint="Tránh làm phiền phụ huynh. Từ 1 đến 30 ngày." htmlFor="st-g"><input id="st-g" className="pd-in" inputMode="numeric" value={gap} onChange={(e) => setGap(e.target.value.replace(/\D/g, ''))} /></Field>
                <Field label="Nơi liên hệ ghi cuối tin nhắn" error={errs.contact} htmlFor="st-c"><input id="st-c" className="pd-in" maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
                <Field label="Hướng dẫn đóng tiền (để trống để dùng thông tin ngân hàng của nhà trường)" error={errs.payment_info} hint={`Đang dùng: ${s.payment_info_effective}`} htmlFor="st-p"><textarea id="st-p" className="pd-in" rows={3} maxLength={255} value={pay} onChange={(e) => setPay(e.target.value)} /></Field>
                <div><button className="pd-btn" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu cài đặt'}</button></div>
            </div>
        </Card>
    );
}

/** Mẫu tin nhắn và cài đặt chung của module Nhắc nợ. */
export function Templates({ meta, onReload, toast }: Props) {
    const [edit, setEdit] = useState<Template | 'new' | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const toggle = async (t: Template) => {
        setBusy(t.id);
        try { await api(`reminders/templates/${t.id}/toggle`, { method: 'POST' }); toast.ok(t.active ? 'Đã tắt mẫu tin.' : 'Đã bật mẫu tin.'); onReload(); }
        catch (e) { toast.fail((e as KtError).message); } finally { setBusy(null); }
    };
    return (
        <>
            <SettingsCard key={JSON.stringify(meta.settings)} s={meta.settings} onSaved={onReload} toast={toast} />
            <Card title="Mẫu tin nhắn" right={<button className="pd-btn sm" onClick={() => setEdit('new')}>+ Tạo mẫu mới</button>}>
                <ul className="rmd-tpls">
                    {meta.templates.map((t) => (
                        <li key={t.id} className={t.active ? '' : 'off'}>
                            <div className="rmd-tpl-h"><b>{t.name}</b><Chip tone={LEVEL_TONE[t.level]}>{t.level_label}</Chip>{t.system && <Chip tone="mut">Mẫu hệ thống</Chip>}{!t.active && <Chip tone="mut">Đang tắt</Chip>}</div>
                            <small className="pd-muted">Tiêu đề: {t.subject}</small>
                            <p className="rmd-excerpt">{t.body}</p>
                            <div className="rmd-tpl-f"><small className="pd-muted">Đã dùng {t.used} đợt · sửa bởi {t.updated_by}{t.updated_at ? ` lúc ${t.updated_at}` : ''}</small>
                                <div className="cl-rowact"><button className="pd-btn ghost sm" onClick={() => setEdit(t)}>Sửa</button><button className="pd-btn ghost sm" disabled={busy === t.id} onClick={() => toggle(t)}>{t.active ? 'Tắt' : 'Bật'}</button></div></div>
                        </li>
                    ))}
                </ul>
            </Card>
            {edit && <Editor meta={meta} tpl={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onReload(); }} toast={toast} />}
        </>
    );
}