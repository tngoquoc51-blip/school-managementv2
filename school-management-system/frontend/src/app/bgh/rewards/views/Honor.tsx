'use client';

import { useEffect, useState } from 'react';
import { errMsg, rewardsApi } from '@/modules/bgh/rewards/rewardsService';
import type { Award, Paged, ViewProps } from '@/modules/bgh/rewards/types';
import { Empty, fdt, fmt, Icon, Modal, Skeleton } from '../ui';

const dateVi = (s?: string | null) => {
    const d = s ? new Date(s.replace(' ', 'T')) : new Date();
    return `Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
};

/** Bảng vàng: danh sách khen thưởng đã duyệt + in giấy khen */
export default function Honor({ yearId, rev }: ViewProps) {
    const [target, setTarget] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Paged<Award> | null>(null);
    const [err, setErr] = useState('');
    const [cert, setCert] = useState<Award | null>(null);

    useEffect(() => {
        const t = setTimeout(() => {
            setErr('');
            rewardsApi.awards({ year_id: yearId, status: 'approved', kind: 'khen_thuong', target_type: target, q: q.trim(), per: 12, page })
                .then((r) => setData(r.page)).catch((e) => setErr(errMsg(e)));
        }, q ? 250 : 0);
        return () => clearTimeout(t);
    }, [yearId, target, q, page, rev]);

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;

    return (
        <div className="rw-stack">
            <div className="row">
                <div className="seg">
                    {[['', 'Tất cả'], ['class', 'Tập thể lớp'], ['student', 'Học sinh']].map(([k, l]) => (
                        <button key={k} className={target === k ? 'on' : ''} onClick={() => { setTarget(k); setPage(1); }}>{l}</button>
                    ))}
                </div>
                <input placeholder="Tìm theo lớp, học sinh, danh hiệu…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ minWidth: 260 }} aria-label="Tìm kiếm" />
                <span className="spacer" />
                {data && <span className="muted">{data.total} khen thưởng đã duyệt</span>}
            </div>

            {!data ? <Skeleton h={260} /> : !data.data.length ? (
                <div className="panel"><Empty icon="star" text="Chưa có khen thưởng nào phù hợp." /></div>
            ) : (
                <div className="honor-grid">
                    {data.data.map((a) => (
                        <article className="honor" key={a.id}>
                            <span className="medal"><Icon n="award" s={26} /></span>
                            <div className="who">{a.target_type === 'class' ? `Tập thể lớp ${a.class_name || '—'}` : `${a.student_name}${a.class_name ? ' · Lớp ' + a.class_name : ''}`}</div>
                            <h4>{a.title}</h4>
                            <div className="meta">
                                {a.level && <span>Cấp {a.level.toLowerCase()}</span>}
                                {a.period_label && <span>{a.period_label}</span>}
                                <span>{fdt(a.reviewed_at || a.created_at)}</span>
                            </div>
                            {Number(a.bonus_points) > 0 && a.bonus_applied ? <span className="badge good" style={{ alignSelf: 'flex-start' }}>+{fmt(a.bonus_points, 0)} điểm thi đua</span> : null}
                            <div className="act"><button className="btn ghost sm" onClick={() => setCert(a)}><Icon n="print" s={15} />Giấy khen</button></div>
                        </article>
                    ))}
                </div>
            )}

            {data && data.last_page > 1 && (
                <div className="pager">
                    <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>
                    <span>Trang {data.current_page}/{data.last_page}</span>
                    <button className="btn ghost sm" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Sau</button>
                </div>
            )}

            {cert && <Certificate a={cert} onClose={() => setCert(null)} />}
        </div>
    );
}

function Certificate({ a, onClose }: { a: Award; onClose: () => void }) {
    const [school, setSchool] = useState('TRƯỜNG THPT');
    useEffect(() => { try { const v = localStorage.getItem('rw_school_name'); if (v) setSchool(v); } catch { /* bỏ qua */ } }, []);
    const rename = (v: string) => { setSchool(v); try { localStorage.setItem('rw_school_name', v); } catch { /* bỏ qua */ } };

    return (
        <Modal title="Giấy khen" onClose={onClose}
               footer={<><button className="btn ghost" onClick={onClose}>Đóng</button><button className="btn primary" onClick={() => window.print()}><Icon n="print" s={16} />In giấy khen</button></>}>
            <label className="fld">Tên trường hiển thị trên giấy khen
                <input value={school} onChange={(e) => rename(e.target.value.toUpperCase())} maxLength={80} />
            </label>
            <div className="cert-wrap">
                <div className="rw-cert">
                    <div className="frame">
                        <div className="sc">{school}</div>
                        <div className="sub">Ban Giám hiệu</div>
                        <h2>GIẤY KHEN</h2>
                        <div className="tang">Hiệu trưởng nhà trường tặng</div>
                        <div className="to">{a.target_type === 'class' ? `Tập thể lớp ${a.class_name || ''}` : a.student_name}</div>
                        {a.target_type === 'student' && a.class_name && <div className="cls">Học sinh lớp {a.class_name}</div>}
                        <div className="ttl">Danh hiệu: {a.title}</div>
                        <div className="why">{a.reason}</div>
                        <div className="ft">
                            <div>{a.period_label || ''}</div>
                            <div className="sig">{dateVi(a.reviewed_at || a.created_at)}<b>HIỆU TRƯỞNG</b></div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}