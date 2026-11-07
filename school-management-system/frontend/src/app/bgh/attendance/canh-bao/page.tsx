'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { CaseCard, CaseModal, CaseRow, StudentDrawer } from '../_student';
import { Avatar, Btn, CASE_ST, Card, Counts, Empty, ErrorBox, Ico, Loading, Pill, RangeBar, StackBar, Tabs, addDays, ca, qs, todayStr, useCa, useLoad } from '../_ca';

type Alert = Counts & {
    student_id: number; code: string; name: string; class_id: number; class_name: string; grade: number; level: 'high' | 'mid'; reasons: string[]; streak: number; current_streak: number; case_id: number | null; case_status: string | null;
};
type Main = 'alerts' | 'cases';
type F = 'open' | 'high' | 'all';

export default function Alerts() {
    const { meta, refresh } = useCa();
    const [main, setMain] = useState<Main>('alerts');
    const [range, setRange] = useState({ from: addDays(todayStr(), -29), to: todayStr() });
    const [f, setF] = useState<F>('open'); const [cls, setCls] = useState(0);
    const [open, setOpen] = useState<number | null>(null);
    const [caseFor, setCaseFor] = useState<Alert | null>(null);

    const al = useLoad(() => ca<Alert[]>(`alerts${qs({ from: range.from, to: range.to, filter: f, class_id: cls })}`), [range.from, range.to, f, cls]);
    const [cs, setCs] = useState<'open' | 'contacted' | 'resolved' | 'all'>('open');
    const cases = useLoad(() => ca<CaseRow[]>(`cases${qs({ status: cs })}`), [cs, main]);
    const changed = () => { al.reload(); cases.reload(); refresh(); };
    const c = al.data?.counts ?? {}; const cc = cases.data?.counts ?? {};
    const rules = (al.data?.meta as unknown as { rules?: Record<string, string> } | undefined)?.rules;

    return (
        <div className="ca-page">
            <div className="ca-ptitle"><div><h2>Cảnh báo nghỉ nhiều</h2><p>Tự động phát hiện học sinh nghỉ nhiều buổi, nghỉ liên tiếp hoặc hay đi muộn. Mở hồ sơ để ghi lại việc liên hệ phụ huynh.</p></div></div>
            <Tabs<Main> value={main} onChange={setMain} items={[{ key: 'alerts', label: 'Học sinh cần chú ý', count: c.all ?? 0, tone: 'rose' }, { key: 'cases', label: 'Hồ sơ theo dõi', count: (cc.open ?? 0) + (cc.contacted ?? 0), tone: 'amber' }]} />

            {main === 'alerts' && (
                <>
                    <RangeBar value={range} onChange={setRange} />
                    <div className="ca-filters">
                        <Tabs<F> value={f} onChange={setF} items={[{ key: 'open', label: 'Cần xử lý', count: c.open ?? 0, tone: 'amber' }, { key: 'high', label: 'Mức cao', count: c.high ?? 0, tone: 'rose' }, { key: 'all', label: 'Tất cả', count: c.all ?? 0 }]} />
                        <select value={cls} onChange={(e) => setCls(Number(e.target.value))}><option value={0}>Mọi lớp</option>{(meta?.classes ?? []).map((x) => <option key={x.id} value={x.id}>Lớp {x.name}</option>)}</select>
                    </div>
                    {rules && <div className="ca-note"><Ico n="spark" size={18} /><div><b>Quy tắc cảnh báo hiện tại</b><p>Nghỉ từ {rules.alert_absent} buổi · nghỉ liên tiếp từ {rules.alert_streak} buổi · đi muộn từ {rules.alert_late} lần. Đổi trong <Link href="/bgh/attendance/cai-dat" className="ca-link">Cài đặt</Link>.</p></div></div>}
                    {al.loading && !al.data ? <Loading /> : al.err && !al.data ? <ErrorBox msg={al.err} retry={al.reload} /> : (al.data?.data.length ?? 0) === 0 ? (
                        <Card><Empty icon="checks" title="Không có học sinh nào cần cảnh báo" text="Khi có học sinh vượt ngưỡng, danh sách sẽ hiện ở đây." /></Card>
                    ) : (
                        <div className="ca-alerts">{al.data!.data.map((a) => (
                            <article key={a.student_id} className={`ca-al ${a.level}`}>
                                <header>
                                    <Avatar name={a.name} tone={a.level === 'high' ? 'rose' : 'amber'} />
                                    <div><h3>{a.name}</h3><small>{a.code} · Lớp {a.class_name}</small></div>
                                    <Pill tone={a.level === 'high' ? 'rose' : 'amber'}>{a.level === 'high' ? 'Mức cao' : 'Cần chú ý'}</Pill>
                                </header>
                                <ul className="why">{a.reasons.map((r) => <li key={r}><Ico n="alert" size={13} />{r}</li>)}{a.current_streak >= 2 && <li className="now"><Ico n="clock" size={13} />Đang nghỉ liên tiếp {a.current_streak} buổi</li>}</ul>
                                <StackBar c={a} />
                                <div className="nums"><span><b>{a.unexcused}</b> không phép</span><span><b>{a.excused}</b> có phép</span><span><b>{a.late}</b> muộn</span><span><b>{a.rate}%</b> chuyên cần</span></div>
                                <footer>
                                    {a.case_status ? <Pill tone={CASE_ST[a.case_status]?.tone ?? 'gray'} dot>{CASE_ST[a.case_status]?.label}</Pill> : <span className="ca-mute">Chưa có hồ sơ theo dõi</span>}
                                    <div className="acts">
                                        <Btn size="sm" onClick={() => setOpen(a.student_id)}>Xem hồ sơ</Btn>
                                        {(!a.case_status || a.case_status === 'resolved') && <Btn size="sm" tone="primary" onClick={() => setCaseFor(a)}><Ico n="flag" size={14} />Mở hồ sơ</Btn>}
                                    </div>
                                </footer>
                            </article>
                        ))}</div>
                    )}
                </>
            )}

            {main === 'cases' && (
                <>
                    <Tabs value={cs} onChange={setCs} items={[{ key: 'open', label: 'Đang theo dõi', count: cc.open ?? 0, tone: 'rose' }, { key: 'contacted', label: 'Đã liên hệ', count: cc.contacted ?? 0, tone: 'amber' }, { key: 'resolved', label: 'Đã xử lý', count: cc.resolved ?? 0, tone: 'green' }, { key: 'all', label: 'Tất cả', count: cc.all ?? 0 }]} />
                    {cases.loading && !cases.data ? <Loading /> : cases.err && !cases.data ? <ErrorBox msg={cases.err} retry={cases.reload} /> : (cases.data?.data.length ?? 0) === 0 ? (
                        <Card><Empty icon="flag" title="Chưa có hồ sơ theo dõi" text="Mở hồ sơ từ danh sách cảnh báo để ghi lại việc liên hệ phụ huynh." /></Card>
                    ) : (
                        <div className="ca-casegrid">{cases.data!.data.map((x) => (
                            <div key={x.id} className="ca-casewrap">
                                <button type="button" className="who" onClick={() => setOpen(x.student_id)}><Avatar name={x.name} tone="teal" /><span><b>{x.name}</b><small>{x.code} · Lớp {x.class_name || '—'}</small></span></button>
                                <CaseCard c={x} onChanged={changed} />
                            </div>
                        ))}</div>
                    )}
                </>
            )}
            {open !== null && <StudentDrawer id={open} range={range} onClose={() => setOpen(null)} onChanged={changed} />}
            {caseFor && <CaseModal student={{ id: caseFor.student_id, name: caseFor.name }} defaultTitle={`${caseFor.reasons[0] ?? 'Nghỉ học nhiều'}, cần liên hệ phụ huynh`} onClose={() => setCaseFor(null)} onSaved={changed} />}
        </div>
    );
}