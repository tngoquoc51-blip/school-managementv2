'use client';
import { useState } from 'react';
import { api, qs } from '../_lib/api';
import { Card, ErrorBox, Loading, Modal, PageHead, Toast, useApi, useInitialParam, useToast } from '../_components/ui';

export default function Assignments() {
    const [classId, setClassId, ready] = useInitialParam('class_id');
    const { data, err, loading, reload } = useApi<any>(ready ? `assignments${qs({ class_id: classId })}` : null);
    const [row, setRow] = useState<any>(null);
    const [tid, setTid] = useState('');
    const [busy, setBusy] = useState(false);
    const toast = useToast();
    if (err) return <ErrorBox msg={err} retry={reload} />;
    if (!data) return <Loading />;
    const cands = row ? data.teachers.filter((t: any) => t.subject_id === row.subject_id) : [];
    const save = async () => {
        setBusy(true);
        try { const r = await api<any>(`assignments/${row.id}`, { method: 'PUT', body: { teacher_id: Number(tid) } }); toast.ok(r.message); setRow(null); reload(); }
        catch (e: any) { toast.fail(e.message); } finally { setBusy(false); }
    };
    return (
        <>
            <PageHead title="Phân công giảng dạy" sub={`Năm học ${data.year} · Mỗi môn của lớp do một giáo viên đúng chuyên môn phụ trách`}
                      actions={<select className="ac-sel" value={data.class_id} onChange={(e) => setClassId(e.target.value)} aria-label="Chọn lớp">{data.classes.map((c: any) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}</select>} />
            <div className="ac-grid ac-g-main">
                <Card title="Phân công của lớp" pad={false}>
                    <div className={loading ? 'ac-tw' : 'ac-tw'} style={{ opacity: loading ? .5 : 1 }}><table className="ac-table"><thead><tr><th>Môn học</th><th className="n">Tiết/tuần</th><th>Giáo viên phụ trách</th><th /></tr></thead><tbody>
                    {data.rows.map((r: any) => <tr key={r.id}><td><b>{r.subject}</b></td><td className="n">{r.periods}</td><td>{r.teacher}<span className="ac-sub">{r.teacher_code}</span></td><td className="n"><button className="ac-btn ghost sm" onClick={() => { setRow(r); setTid(''); }}>Đổi giáo viên</button></td></tr>)}
                    </tbody></table></div>
                </Card>
                <Card title="Khối lượng giảng dạy" pad={false}>
                    <div className="ac-tw" style={{ maxHeight: 520, overflow: 'auto' }}><table className="ac-table" style={{ minWidth: 0 }}><thead><tr><th>Giáo viên</th><th className="n">Lớp</th><th className="n">Tiết</th></tr></thead><tbody>
                    {data.teachers.map((t: any) => <tr key={t.id}><td>{t.name}<span className="ac-sub">{t.subject}</span></td><td className="n">{t.classes}</td><td className="n"><b>{t.periods}</b></td></tr>)}
                    </tbody></table></div>
                </Card>
            </div>
            {row && (
                <Modal title={`Đổi giáo viên môn ${row.subject}`} onClose={() => setRow(null)} foot={<><button className="ac-btn ghost" onClick={() => setRow(null)}>Hủy</button><button className="ac-btn" disabled={!tid || busy} onClick={save}>Lưu phân công</button></>}>
                    <p style={{ marginBottom: 12 }}>Hiện tại: <b>{row.teacher}</b>. Hệ thống kiểm tra trùng tiết với các lớp khác trước khi lưu.</p>
                    <div className="ac-field"><label htmlFor="nt">Giáo viên mới (cùng bộ môn)</label>
                        <select id="nt" className="ac-sel" value={tid} onChange={(e) => setTid(e.target.value)}><option value="">— Chọn giáo viên —</option>
                            {cands.filter((t: any) => t.id !== row.teacher_id).map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.periods} tiết/tuần)</option>)}</select></div>
                </Modal>
            )}
            <Toast t={toast.t} clear={toast.clear} />
        </>
    );
}