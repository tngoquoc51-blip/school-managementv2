'use client';

import { useState } from 'react';
import { profileApi } from '@/services/teacherProfileService';
import { Empty, ErrorBox, Icon, Skeleton, ago, fmtDateTime, useFetch } from '../ui';
import s from '../profile.module.css';

const ICON: Record<string, string> = { profile: 'user', qualification: 'award', request: 'send', security: 'shield', settings: 'cog', login: 'lock', logout: 'logout' };

export default function ActivityTab() {
    const [page, setPage] = useState(1);
    const { data, loading, error, reload } = useFetch(() => profileApi.activity(page), [page]);
    if (loading && !data) return <Skeleton h={70} n={4} />;
    if (error || !data) return <ErrorBox message={error || 'Lỗi'} onRetry={reload} />;

    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="list" /> Nhật ký hoạt động</h3><div className={s.cardSub}>{data.total} hoạt động • giúp bạn theo dõi mọi thay đổi trên tài khoản</div></div></div>
                {data.data.length === 0 ? <Empty icon="🕘" text="Chưa có hoạt động nào." /> : (
                    <div className={s.timeline}>{data.data.map((a) => (
                        <div key={a.id} className={s.tlItem}>
                            <b style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon n={ICON[a.action.split('.')[0]] || 'list'} size={15} /> {a.description}</b>
                            <small title={fmtDateTime(a.created_at)}>{ago(a.created_at)}{a.ip_address ? ` • IP ${a.ip_address}` : ''}</small>
                        </div>))}</div>)}
                {data.last_page > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', marginTop: 8 }}>
                        <button className={s.btn} disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>← Trước</button>
                        <span className={s.cardSub}>Trang {data.current_page}/{data.last_page}</span>
                        <button className={s.btn} disabled={page >= data.last_page || loading} onClick={() => setPage(page + 1)}>Sau →</button>
                    </div>)}
            </section>
        </div>
    );
}