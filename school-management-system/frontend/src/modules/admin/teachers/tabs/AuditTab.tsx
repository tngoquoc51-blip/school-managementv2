'use client';
import { useState } from 'react';
import { teacherApi } from '../api';
import Icon from '../../subjects/ui/Icon';
import { fmtDate } from '../../subjects/theme';
import { Empty, ErrorBox, Loading, useLoad } from '../../subjects/tabs/shared';

const KINDS: [string, string][] = [['', 'Tất cả'], ['create', 'Tạo mới'], ['update', 'Cập nhật'], ['delete', 'Xóa'], ['homeroom', 'Chủ nhiệm'], ['transfer', 'Chuyển phân công'], ['leave', 'Nghỉ phép'], ['substitute', 'Dạy thay'], ['cert', 'Chứng chỉ'], ['bulk', 'Hàng loạt']];

export default function AuditTab() {
    const [f, setF] = useState('');
    const q = useLoad(() => teacherApi.audit(), []);
    const rows = (q.data ?? []).filter((r) => !f || r.action === f);
    return (
        <>
            <div className="sj-bar"><div className="sj-seg" style={{ flexWrap: 'wrap' }}>{KINDS.map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div><span className="sj-spacer" />
                <button className="sj-btn" onClick={() => q.reload()}><Icon name="refresh" size={16} /> Làm mới</button></div>
            <div className="sj-card">
                {q.loading && !q.data ? <Loading rows={2} /> : q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : !rows.length ? <Empty icon="clock" title="Chưa có nhật ký" /> : (
                    <div className="sj-tl">{rows.map((r) => (
                        <div key={r.id} className={`sj-tl-i ${r.action}`}><p>{r.summary}</p><small>{r.actor || 'hệ thống'} • {fmtDate(r.created_at)} • <code>{r.action}</code>{r.ip ? ` • ${r.ip}` : ''}</small></div>))}</div>)}
            </div>
        </>
    );
}