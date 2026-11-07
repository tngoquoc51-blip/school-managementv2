'use client';

import React, { useState } from 'react';
import { Leave, LeaveModal, LeaveRow } from '../_student';
import { Btn, Card, Empty, ErrorBox, Ico, Loading, Pager, Tabs, ca, qs, useCa, useDebounced, useLoad } from '../_ca';

type St = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled';

export default function Leaves() {
    const { refresh } = useCa();
    const [st, setSt] = useState<St>('pending'); const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1);
    const [add, setAdd] = useState(false);
    const { data, err, loading, reload } = useLoad(() => ca<Leave[]>(`leaves${qs({ status: st, q: dq, page, per: 15 })}`), [st, dq, page]);
    const c = data?.counts ?? {}; const rows = data?.data ?? [];
    const changed = () => { reload(); refresh(); };

    return (
        <div className="ca-page">
            <div className="ca-ptitle">
                <div><h2>Đơn xin nghỉ</h2><p>Ghi nhận đơn nghỉ khi phụ huynh gọi điện hoặc nộp đơn. Đơn đã duyệt tự chuyển các buổi “vắng không phép” thành “vắng có phép”.</p></div>
                <div className="acts"><Btn tone="primary" onClick={() => setAdd(true)}><Ico n="plus" size={16} />Ghi nhận đơn nghỉ</Btn></div>
            </div>
            <Tabs<St> value={st} onChange={(k) => { setSt(k); setPage(1); }} items={[
                { key: 'pending', label: 'Chờ duyệt', count: c.pending ?? 0, tone: 'amber' }, { key: 'approved', label: 'Đã duyệt', count: c.approved ?? 0, tone: 'green' },
                { key: 'rejected', label: 'Từ chối', count: c.rejected ?? 0, tone: 'rose' }, { key: 'cancelled', label: 'Đã hủy', count: c.cancelled ?? 0 }, { key: 'all', label: 'Tất cả', count: c.all ?? 0 },
            ]} />
            <div className="ca-filters"><label className="ca-search"><Ico n="search" size={16} /><input placeholder="Tìm theo tên, mã học sinh hoặc lý do…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label></div>
            <Card pad={false}>
                {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : rows.length === 0 ? (
                    <Empty icon="doc" title={st === 'pending' ? 'Không có đơn nào chờ duyệt' : 'Không có đơn nghỉ'} text="Bấm “Ghi nhận đơn nghỉ” khi phụ huynh báo con nghỉ." action={<Btn tone="primary" onClick={() => setAdd(true)}>Ghi nhận đơn nghỉ</Btn>} />
                ) : <div className="ca-leaves">{rows.map((l) => <LeaveRow key={l.id} l={l} onChanged={changed} />)}</div>}
                {data?.meta && rows.length > 0 && <Pager page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPage={setPage} />}
            </Card>
            {add && <LeaveModal onClose={() => setAdd(false)} onSaved={changed} />}
        </div>
    );
}