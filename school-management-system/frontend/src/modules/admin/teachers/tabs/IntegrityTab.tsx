'use client';
import { useEffect, useState } from 'react';
import type { Ctx } from '../TeachersPage';
import Icon from '../../subjects/ui/Icon';
import { Ring } from '../../subjects/ui/Charts';
import { ErrorBox, Loading, useLoad } from '../../subjects/tabs/shared';
import { teacherApi } from '../api';
import type { TabKey } from '../types';

const GO: Record<string, { tab: TabKey; label: string }> = {
    no_subject: { tab: 'list', label: 'Mở danh sách' }, inactive_assigned: { tab: 'workload', label: 'Chuyển phân công' }, conflict: { tab: 'schedule', label: 'Xem lịch dạy' },
    no_homeroom: { tab: 'homeroom', label: 'Phân công GVCN' }, overload: { tab: 'workload', label: 'Cân bằng tải' }, off_specialty: { tab: 'supply', label: 'Xem chuyên môn' },
    no_contact: { tab: 'list', label: 'Mở danh sách' }, cert_expiring: { tab: 'list', label: 'Mở danh sách' }, duplicate_name: { tab: 'list', label: 'Mở danh sách' },
};

export default function IntegrityTab({ ctx }: { ctx: Ctx }) {
    const q = useLoad(() => teacherApi.integrity(ctx.yearId), [ctx.yearId]);
    const [open, setOpen] = useState<string | null>(null);
    useEffect(() => { if (q.data) ctx.setHealth(q.data.health); }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
    if (q.loading && !q.data) return <Loading />;
    if (q.error || !q.data) return <ErrorBox msg={q.error} retry={q.reload} />;
    const d = q.data;
    const col = d.health >= 85 ? 'var(--ok)' : d.health >= 60 ? 'var(--warn)' : 'var(--bad)';

    return (
        <>
            <div className="sj-card sj-mb"><div className="sj-flex">
                <Ring value={d.health} label="/100" size={132} color={col} />
                <div style={{ flex: 1, minWidth: 240 }}>
                    <h3 style={{ fontSize: 18 }}>{d.total === 0 ? 'Hồ sơ giáo viên hoàn toàn nhất quán' : `Phát hiện ${d.total} điểm cần xem lại`}</h3>
                    <p className="sj-muted" style={{ marginTop: 6 }}>Đối chiếu giáo viên ↔ chuyên môn ↔ phân công ↔ chủ nhiệm ↔ thời khóa biểu ↔ chứng chỉ để phát hiện sai sót trước khi vận hành.</p>
                </div>
                <button className="sj-btn" onClick={() => q.reload()}><Icon name="refresh" size={16} /> Quét lại</button>
            </div></div>
            {d.issues.map((i) => {
                const zero = i.count === 0;
                return (
                    <div key={i.key} className={`sj-issue ${zero ? 'zero' : i.severity}`}>
                        <div className="sj-issue-h" onClick={() => !zero && setOpen(open === i.key ? null : i.key)} style={{ cursor: zero ? 'default' : 'pointer' }}>
                            <Icon name={zero ? 'check' : i.severity === 'info' ? 'info' : 'alert'} size={22} />
                            <div style={{ flex: 1, minWidth: 200 }}><h4>{i.title}</h4><p>{zero ? 'Không có vấn đề' : i.hint}</p></div>
                            <span className={`sj-badge ${zero ? 'ok' : i.severity === 'error' ? 'bad' : i.severity === 'warning' ? 'warn' : 'pri'}`}>{zero ? 'Ổn' : `${i.count} mục`}</span>
                            {!zero && GO[i.key] && <button className="sj-btn sm" onClick={(e) => { e.stopPropagation(); ctx.go(GO[i.key].tab); }}>{GO[i.key].label} <Icon name="right" size={13} /></button>}
                            {!zero && <Icon name={open === i.key ? 'up' : 'down'} size={16} />}
                        </div>
                        {open === i.key && <ul>{i.items.map((x, k) => <li key={k}>{x.id ? <a style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => (i.key === 'no_homeroom' ? ctx.go('homeroom') : ctx.openTeacher(x.id as number))}>{x.label}</a> : x.label}</li>)}{i.count > i.items.length && <li className="sj-muted">… và {i.count - i.items.length} mục khác</li>}</ul>}
                    </div>);
            })}
        </>
    );
}