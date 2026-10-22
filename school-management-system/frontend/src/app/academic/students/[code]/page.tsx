'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../_lib/api';
import { Card, ErrorBox, Loading, Modal, PageHead, Pill, Toast, fmt, useApi, useToast } from '../../_components/ui';

type F = { k: string; l: string; kind?: 'text' | 'select'; opts?: string[]; ph?: string };
const SECTIONS: { t: string; f: F[] }[] = [
    { t: 'Thông tin cá nhân', f: [
            { k: 'full_name', l: 'Họ và tên' }, { k: 'gender', l: 'Giới tính', kind: 'select', opts: ['Nam', 'Nữ'] }, { k: 'birth_date', l: 'Ngày sinh', ph: 'dd/mm/yyyy' },
            { k: 'ethnicity', l: 'Dân tộc' }, { k: 'religion', l: 'Tôn giáo' }, { k: 'birth_place', l: 'Nơi sinh' }, { k: 'hometown', l: 'Quê quán' }, { k: 'permanent_address', l: 'Địa chỉ thường trú' } ] },
    { t: 'Liên hệ', f: [{ k: 'phone', l: 'Số điện thoại' }, { k: 'current_address', l: 'Địa chỉ hiện tại' }, { k: 'emergency_name', l: 'Người liên hệ khẩn cấp' }, { k: 'emergency_relation', l: 'Quan hệ' }, { k: 'emergency_phone', l: 'SĐT khẩn cấp' }] },
    { t: 'Gia đình', f: [
            { k: 'father_name', l: 'Họ tên bố' }, { k: 'father_job', l: 'Nghề nghiệp bố' }, { k: 'father_phone', l: 'SĐT bố' },
            { k: 'mother_name', l: 'Họ tên mẹ' }, { k: 'mother_job', l: 'Nghề nghiệp mẹ' }, { k: 'mother_phone', l: 'SĐT mẹ' },
            { k: 'guardian_name', l: 'Người giám hộ' }, { k: 'guardian_relation', l: 'Quan hệ giám hộ' }, { k: 'guardian_phone', l: 'SĐT giám hộ' } ] },
    { t: 'Sức khỏe', f: [{ k: 'blood_type', l: 'Nhóm máu', kind: 'select', opts: ['', 'A', 'B', 'AB', 'O'] }, { k: 'height_cm', l: 'Chiều cao (cm)' }, { k: 'weight_kg', l: 'Cân nặng (kg)' }, { k: 'health_note', l: 'Ghi chú sức khỏe' }] },
];

const flat = (p: any): Record<string, string> => {
    const s = p.student, pe = p.personal, c = p.contact, fa = p.family, h = p.health;
    const v = (x: any) => (x === null || x === undefined ? '' : String(x));
    return {
        full_name: v(s.full_name), gender: v(s.gender), birth_date: v(s.birth_date), ethnicity: v(pe.ethnicity), religion: v(pe.religion), birth_place: v(pe.birth_place), hometown: v(pe.hometown), permanent_address: v(pe.permanent_address),
        phone: v(c.phone), current_address: v(c.current_address), emergency_name: v(c.emergency_name), emergency_relation: v(c.emergency_relation), emergency_phone: v(c.emergency_phone),
        father_name: v(fa.father.name), father_job: v(fa.father.job), father_phone: v(fa.father.phone), mother_name: v(fa.mother.name), mother_job: v(fa.mother.job), mother_phone: v(fa.mother.phone),
        guardian_name: v(fa.guardian.name), guardian_relation: v(fa.guardian.relation), guardian_phone: v(fa.guardian.phone),
        blood_type: v(h.blood_type), height_cm: v(h.height_cm), weight_kg: v(h.weight_kg), health_note: v(h.note),
    };
};

export default function StudentDetail() {
    const { code } = useParams<{ code: string }>();
    const { data, err, loading, reload } = useApi<any>(`students/${code}`);
    const [edit, setEdit] = useState(false);
    const [form, setForm] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [confirmPw, setConfirmPw] = useState(false);
    const toast = useToast();
    const base = useMemo(() => (data ? flat(data.profile) : {}), [data]);

    if (loading && !data) return <Loading />;
    if (err || !data) return <ErrorBox msg={err || 'Không tìm thấy học sinh'} retry={reload} />;
    const p = data.profile, a = data.account;

    const save = async () => {
        const changed: Record<string, string> = {};
        Object.keys(form).forEach((k) => { if (form[k] !== base[k]) changed[k] = form[k]; });
        if (!Object.keys(changed).length) { setEdit(false); return; }
        setBusy(true); setErrors({});
        try {
            const r = await api<any>(`students/${code}`, { method: 'PUT', body: { fields: changed } });
            toast.ok(r.message); setEdit(false); reload();
        } catch (e: any) { setErrors(e.errors || {}); toast.fail(e.message); } finally { setBusy(false); }
    };
    const resetPw = async () => {
        setBusy(true);
        try { const r = await api<any>(`students/${code}/reset-password`, { method: 'POST' }); toast.ok(r.message); setConfirmPw(false); reload(); }
        catch (e: any) { toast.fail(e.message); } finally { setBusy(false); }
    };
    const KV = ({ l, v }: { l: string; v: any }) => <div><small>{l}</small><b>{v || '—'}</b></div>;

    return (
        <>
            <p style={{ marginBottom: 10 }}><Link href="/academic/students" style={{ color: '#0369a1' }}>← Danh sách học sinh</Link></p>
            <PageHead title={p.student.full_name} sub={`${p.student.code} · Lớp ${p.class?.name ?? '—'} · GVCN: ${p.class?.homeroom ?? '—'}`}
                      actions={<><button className="ac-btn ghost" onClick={() => setConfirmPw(true)}>Đặt lại mật khẩu</button><button className="ac-btn" onClick={() => { setForm(base); setErrors({}); setEdit(true); }}>Chỉnh sửa hồ sơ</button></>} />
            <div className="ac-grid ac-g-main">
                <div>
                    <Card title="Thông tin cá nhân"><div className="ac-kv">
                        <KV l="Giới tính" v={p.student.gender} /><KV l="Ngày sinh" v={`${p.student.birth_date} (${p.student.age} tuổi)`} /><KV l="Dân tộc" v={p.personal.ethnicity} /><KV l="Tôn giáo" v={p.personal.religion} />
                        <KV l="Nơi sinh" v={p.personal.birth_place} /><KV l="Quê quán" v={p.personal.hometown} /><KV l="Thường trú" v={p.personal.permanent_address} /><KV l="Năm nhập học" v={p.student.admission_year} />
                    </div></Card>
                    <Card title="Liên hệ & sức khỏe"><div className="ac-kv">
                        <KV l="Số điện thoại" v={p.contact.phone} /><KV l="Địa chỉ hiện tại" v={p.contact.current_address} />
                        <KV l="Liên hệ khẩn cấp" v={[p.contact.emergency_name, p.contact.emergency_relation && `(${p.contact.emergency_relation})`, p.contact.emergency_phone].filter(Boolean).join(' ')} />
                        <KV l="Nhóm máu" v={p.health.blood_type} /><KV l="Chiều cao / Cân nặng" v={p.health.height_cm ? `${p.health.height_cm} cm / ${p.health.weight_kg ?? '—'} kg` : ''} /><KV l="Ghi chú sức khỏe" v={p.health.note} />
                    </div></Card>
                    <Card title="Gia đình"><div className="ac-kv">
                        <KV l="Bố" v={[p.family.father.name, p.family.father.job && `· ${p.family.father.job}`, p.family.father.phone && `· ${p.family.father.phone}`].filter(Boolean).join(' ')} />
                        <KV l="Mẹ" v={[p.family.mother.name, p.family.mother.job && `· ${p.family.mother.job}`, p.family.mother.phone && `· ${p.family.mother.phone}`].filter(Boolean).join(' ')} />
                        <KV l="Người giám hộ" v={[p.family.guardian.name, p.family.guardian.relation && `(${p.family.guardian.relation})`, p.family.guardian.phone].filter(Boolean).join(' ')} />
                    </div></Card>
                    <Card title="Kết quả học tập" pad={false}>
                        <div className="ac-tw"><table className="ac-table"><thead><tr><th>Năm học</th><th>Lớp</th><th className="n">HK1</th><th className="n">HK2</th><th className="n">Cả năm</th><th>Học lực</th><th>Hạnh kiểm</th></tr></thead><tbody>
                        {p.academic.history.map((h: any) => <tr key={h.year}><td>{h.year}</td><td>{h.class}</td><td className="n">{fmt(h.hk1)}</td><td className="n">{fmt(h.hk2)}</td><td className="n"><b>{fmt(h.avg)}</b></td><td>{h.rank ? <Pill>{h.rank}</Pill> : '—'}</td><td>{h.conduct_year ? <Pill>{h.conduct_year}</Pill> : '—'}</td></tr>)}
                        </tbody></table></div>
                    </Card>
                </div>
                <div>
                    <Card title="Tài khoản">
                        <div className="ac-kv" style={{ gridTemplateColumns: '1fr' }}>
                            <KV l="Tên đăng nhập" v={a?.username} /><KV l="Gmail khôi phục" v={a?.email && !/@thpt\.edu\.vn$/i.test(a.email) ? a.email : 'Chưa liên kết'} />
                            <div><small>Trạng thái</small>{a ? (a.status !== 'active' ? <Pill tone="err">Bị khóa</Pill> : a.locked ? <Pill tone="err">Tạm khóa do nhập sai</Pill> : a.default_password ? <Pill tone="warn">Đang dùng mật khẩu mặc định</Pill> : <Pill tone="ok">Hoạt động</Pill>) : '—'}</div>
                            <KV l="Đăng nhập gần nhất" v={a?.last_login_at} />
                        </div>
                    </Card>
                    <Card title="Mức hoàn thiện hồ sơ">
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#0b2545' }}>{p.completeness.percent}%</div>
                        <div className="ac-bars" style={{ margin: '8px 0 12px' }}><div className="ac-bar" style={{ gridTemplateColumns: '1fr' }}><div><i className={p.completeness.percent >= 80 ? 'ok' : 'warn'} style={{ width: `${p.completeness.percent}%` }} /></div></div></div>
                        {p.completeness.missing.length ? <><small style={{ color: '#5b6f85' }}>Còn thiếu:</small><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{p.completeness.missing.map((m: any) => <li key={m.key}>{m.label}</li>)}</ul></> : <Pill tone="ok">Đầy đủ</Pill>}
                    </Card>
                    <Card title="Lịch sử chỉnh sửa" pad={false}>
                        {p.requests.length === 0 ? <p style={{ padding: 20, color: '#5b6f85' }}>Chưa có.</p> : p.requests.slice(0, 8).map((r: any) => (
                            <div key={r.id} className="ac-task" style={{ display: 'block' }}><b style={{ fontSize: 13.5 }}>{r.field_label}</b> <Pill tone={r.status === 'approved' ? 'ok' : r.status === 'pending' ? 'warn' : 'mut'}>{r.status === 'approved' ? 'Đã duyệt' : r.status === 'pending' ? 'Chờ duyệt' : r.status === 'rejected' ? 'Từ chối' : 'Đã hủy'}</Pill><span className="ac-sub">{r.old_value || '(trống)'} → {r.new_value}</span></div>
                        ))}
                    </Card>
                </div>
            </div>

            {edit && (
                <Modal title="Chỉnh sửa hồ sơ học sinh" onClose={() => setEdit(false)} foot={<><button className="ac-btn ghost" onClick={() => setEdit(false)}>Hủy</button><button className="ac-btn" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></>}>
                    {SECTIONS.map((s) => (
                        <div key={s.t}>
                            <h4 style={{ margin: '6px 0 10px', color: '#0b2545' }}>{s.t}</h4>
                            {s.f.map((f) => (
                                <div className="ac-field" key={f.k}>
                                    <label htmlFor={`f-${f.k}`}>{f.l}</label>
                                    {f.kind === 'select'
                                        ? <select id={`f-${f.k}`} className="ac-sel" value={form[f.k] ?? ''} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}>{f.opts!.map((o) => <option key={o} value={o}>{o || '—'}</option>)}</select>
                                        : <input id={`f-${f.k}`} className="ac-in" placeholder={f.ph} value={form[f.k] ?? ''} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />}
                                    {errors[f.k] && <span className="er">{errors[f.k]}</span>}
                                </div>
                            ))}
                        </div>
                    ))}
                </Modal>
            )}
            {confirmPw && (
                <Modal title="Đặt lại mật khẩu" onClose={() => setConfirmPw(false)} foot={<><button className="ac-btn ghost" onClick={() => setConfirmPw(false)}>Hủy</button><button className="ac-btn" disabled={busy} onClick={resetPw}>Xác nhận đặt lại</button></>}>
                    <p>Mật khẩu của <b>{p.student.full_name}</b> sẽ được đặt về <b>123456</b>, tài khoản được mở khóa và mọi thiết bị đang đăng nhập bị đăng xuất. Học sinh sẽ được nhắc đổi mật khẩu khi đăng nhập.</p>
                </Modal>
            )}
            <Toast t={toast.t} clear={toast.clear} />
        </>
    );
}