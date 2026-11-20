'use client';

import { useCallback, useEffect, useState } from 'react';
import { errMsg, fieldErrors, fmtDate, settingsApi } from './api';
import { Badge, Btn, Card, Empty, Field, Icon, Modal, Skeleton, useConfirm, useToast } from './ui';

const YS: Record<string, [string, any]> = { draft: ['Nháp', ''], active: ['Đang diễn ra', 'ok'], closed: ['Đã đóng', 'warn'] };
const SS: Record<string, [string, any]> = { upcoming: ['Sắp tới', 'info'], active: ['Đang diễn ra', 'ok'], closed: ['Đã kết thúc', 'warn'] };

export default function SchoolYears() {
    const toast = useToast(); const confirm = useConfirm();
    const [years, setYears] = useState<any[] | null>(null);
    const [ym, setYm] = useState<any>(null);   // modal năm học
    const [sm, setSm] = useState<any>(null);   // modal học kỳ
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try { setYears(await settingsApi.years()); } catch (e) { toast('err', 'Không tải được năm học', errMsg(e)); setYears([]); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const run = async (fn: () => Promise<any>, okMsg?: string) => {
        setBusy(true); setErrs({});
        try { const r = await fn(); toast('ok', okMsg || r?.data?.message || 'Thành công'); await load(); return true; }
        catch (e: any) { setErrs(fieldErrors(e)); toast('err', 'Không thực hiện được', errMsg(e)); return false; }
        finally { setBusy(false); }
    };

    const openYear = (y?: any) => { setErrs({}); setYm(y ? { ...y } : { id: null, label: '', start_date: '', end_date: '', status: 'draft' }); };
    const openSem = (year: any, s?: any) => {
        setErrs({});
        setSm(s ? { ...s } : { id: null, school_year_id: year.id, code: (year.semesters?.length || 0) + 1 > 2 ? 2 : (year.semesters?.length || 0) + 1, name: '', start_date: year.start_date, end_date: year.end_date, status: 'upcoming' });
    };

    const setCurrentYear = async (y: any) => {
        if (await confirm({ title: `Đặt ${y.label} làm năm học hiện hành?`, text: 'Năm học hiện hành trước đó sẽ chuyển sang "Đã đóng". Toàn bộ module (điểm danh, điểm số, học phí…) sẽ lấy năm học này làm mặc định.', okText: 'Đặt hiện hành' }))
            run(() => settingsApi.currentYear(y.id));
    };
    const delYear = async (y: any) => {
        if (await confirm({ title: `Xóa năm học ${y.label}?`, danger: true, okText: 'Xóa', text: 'Các học kỳ thuộc năm học này cũng bị xóa. Không thể hoàn tác.' })) run(() => settingsApi.deleteYear(y.id));
    };
    const setCurrentSem = async (s: any) => {
        if (await confirm({ title: `Đặt ${s.name} làm học kỳ hiện hành?`, okText: 'Đặt hiện hành' })) run(() => settingsApi.currentSemester(s.id));
    };
    const delSem = async (s: any) => {
        if (await confirm({ title: `Xóa ${s.name}?`, danger: true, okText: 'Xóa' })) run(() => settingsApi.deleteSemester(s.id));
    };

    if (!years) return <Skeleton rows={3} />;

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--st-muted)' }}>{years.length} năm học · dữ liệu lấy trực tiếp từ bảng <code>sm_school_years</code></span>
                <Btn kind="pri" icon="plus" onClick={() => openYear()}>Thêm năm học</Btn>
            </div>

            {years.length === 0 && <Card><Empty icon="calendar" text="Chưa có năm học nào. Bấm “Thêm năm học” để bắt đầu." /></Card>}

            {years.map((y) => (
                <Card key={y.id} icon="calendar" flush
                      title={`Năm học ${y.label}`} desc={`${fmtDate(y.start_date)} – ${fmtDate(y.end_date)}`}
                      actions={<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {y.is_current ? <Badge kind="pri"><Icon name="star" size={12} /> Hiện hành</Badge> : <Badge kind={YS[y.status]?.[1]}>{YS[y.status]?.[0] || y.status}</Badge>}
                          {!y.is_current && <Btn className="sm" onClick={() => setCurrentYear(y)}>Đặt hiện hành</Btn>}
                          <Btn className="sm" icon="edit" onClick={() => openYear(y)}>Sửa</Btn>
                          {!y.is_current && <Btn className="sm dng" icon="trash" onClick={() => delYear(y)} />}
                      </div>}>
                    <div className="st-tw">
                        <table className="st-table">
                            <thead><tr><th>Học kỳ</th><th>Thời gian</th><th>Trạng thái</th><th /></tr></thead>
                            <tbody>
                            {(y.semesters || []).map((s: any) => (
                                <tr key={s.id}>
                                    <td><b>{s.name}</b> {s.is_current ? <Badge kind="pri">Hiện hành</Badge> : null}</td>
                                    <td>{fmtDate(s.start_date)} – {fmtDate(s.end_date)}</td>
                                    <td><Badge kind={SS[s.status]?.[1]}>{SS[s.status]?.[0] || s.status}</Badge></td>
                                    <td className="act">
                                        {!s.is_current && <Btn className="sm" onClick={() => setCurrentSem(s)}>Đặt hiện hành</Btn>}{' '}
                                        <Btn className="sm ghost" icon="edit" onClick={() => openSem(y, s)} />
                                        {!s.is_current && <Btn className="sm ghost dng" icon="trash" onClick={() => delSem(s)} />}
                                    </td>
                                </tr>
                            ))}
                            {!(y.semesters || []).length && <tr><td colSpan={4}><Empty text="Chưa có học kỳ" /></td></tr>}
                            </tbody>
                        </table>
                    </div>
                    {(y.semesters || []).length < 2 && <div style={{ padding: 14, borderTop: '1px solid var(--st-line)' }}><Btn className="sm" icon="plus" onClick={() => openSem(y)}>Thêm học kỳ</Btn></div>}
                </Card>
            ))}

            {ym && (
                <Modal title={ym.id ? 'Sửa năm học' : 'Thêm năm học'} onClose={() => setYm(null)} footer={<>
                    <Btn onClick={() => setYm(null)}>Hủy</Btn>
                    <Btn kind="pri" busy={busy} icon="check" onClick={async () => { if (await run(() => settingsApi.saveYear(ym.id, { label: ym.label, start_date: ym.start_date, end_date: ym.end_date, status: ym.status }), 'Đã lưu năm học')) setYm(null); }}>Lưu</Btn>
                </>}>
                    <Field label="Tên năm học" error={errs.label} hint="Ví dụ: 2026 – 2027"><input className="st-in" value={ym.label} onChange={(e) => setYm({ ...ym, label: e.target.value })} /></Field>
                    <div className="st-grid">
                        <Field label="Ngày bắt đầu" error={errs.start_date}><input type="date" className="st-in" value={String(ym.start_date).slice(0, 10)} onChange={(e) => setYm({ ...ym, start_date: e.target.value })} /></Field>
                        <Field label="Ngày kết thúc" error={errs.end_date}><input type="date" className="st-in" value={String(ym.end_date).slice(0, 10)} onChange={(e) => setYm({ ...ym, end_date: e.target.value })} /></Field>
                    </div>
                    <Field label="Trạng thái"><select className="st-in" value={ym.status} onChange={(e) => setYm({ ...ym, status: e.target.value })}>{Object.entries(YS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></Field>
                </Modal>
            )}

            {sm && (
                <Modal title={sm.id ? 'Sửa học kỳ' : 'Thêm học kỳ'} onClose={() => setSm(null)} footer={<>
                    <Btn onClick={() => setSm(null)}>Hủy</Btn>
                    <Btn kind="pri" busy={busy} icon="check" onClick={async () => { if (await run(() => settingsApi.saveSemester(sm.id, { school_year_id: sm.school_year_id, code: Number(sm.code), name: sm.name, start_date: sm.start_date, end_date: sm.end_date, status: sm.status }), 'Đã lưu học kỳ')) setSm(null); }}>Lưu</Btn>
                </>}>
                    <div className="st-grid">
                        <Field label="Học kỳ số" error={errs.code}><select className="st-in" value={sm.code} onChange={(e) => setSm({ ...sm, code: e.target.value, name: sm.name || `Học kỳ ${e.target.value}` })}><option value={1}>Học kỳ 1</option><option value={2}>Học kỳ 2</option></select></Field>
                        <Field label="Tên hiển thị" error={errs.name}><input className="st-in" value={sm.name} placeholder={`Học kỳ ${sm.code}`} onChange={(e) => setSm({ ...sm, name: e.target.value })} /></Field>
                        <Field label="Bắt đầu" error={errs.start_date}><input type="date" className="st-in" value={String(sm.start_date || '').slice(0, 10)} onChange={(e) => setSm({ ...sm, start_date: e.target.value })} /></Field>
                        <Field label="Kết thúc" error={errs.end_date}><input type="date" className="st-in" value={String(sm.end_date || '').slice(0, 10)} onChange={(e) => setSm({ ...sm, end_date: e.target.value })} /></Field>
                    </div>
                    <Field label="Trạng thái"><select className="st-in" value={sm.status} onChange={(e) => setSm({ ...sm, status: e.target.value })}>{Object.entries(SS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></Field>
                </Modal>
            )}
        </>
    );
}