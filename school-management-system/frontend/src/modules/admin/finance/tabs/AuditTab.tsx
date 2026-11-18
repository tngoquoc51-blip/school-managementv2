'use client';

import { finApi } from '@/services/adminFinanceService';
import { Empty, ErrorBox, Icon, Skeleton, ago, fmtDateTime, useFetch } from '../ui';
import s from '../finance.module.css';

const ACT: Record<string, [string, string]> = { confirm: ['Xác nhận', s.bOk], reject: ['Từ chối', s.bBad], close: ['Đóng đợt', s.bWarn], reopen: ['Mở lại', s.bInfo] };

export default function AuditTab() {
    const { data, loading, error, reload } = useFetch(() => finApi.audit(), []);
    if (loading && !data) return <Skeleton h={60} n={5} />;
    if (error || !data) return <ErrorBox message={error || 'Lỗi'} onRetry={reload} />;
    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="list" /> Nhật ký thao tác tài chính</h3><div className={s.cardSub}>100 thao tác gần nhất về thanh toán, đợt thu và khoản thu</div></div><button className={s.btn} onClick={reload}><Icon n="refresh" size={15} /> Tải lại</button></div>
                {data.length === 0 ? <Empty icon="🕘" text="Chưa có thao tác nào được ghi nhận." /> : (
                    <div className={s.timeline}>{data.map((r, i) => { const [lb, cl] = ACT[r.action] || [r.action, s.bMute]; return (
                        <div key={i} className={s.tlItem}>
                            <b style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span className={`${s.badge} ${cl}`}>{lb}</span>{r.detail || '—'}</b>
                            <small title={fmtDateTime(r.time)}>{r.source} · {r.actor} · {ago(r.time)}{r.ref ? ` · ${r.ref}` : ''}</small>
                        </div>); })}</div>)}
            </section>
        </div>
    );
}