'use client';

import React, { useState } from 'react';
import { Btn, Card, Counts, Empty, ErrorBox, Ico, Loading, RangeBar, Seg, ca, downloadFile, fmtD, num, presetRange, qs, useCa, useLoad } from '../_ca';

type Rep = { columns: string[]; rows: (string | number)[][]; group: string; from: string; to: string };
const GROUPS: [string, string][] = [['class', 'Theo lớp'], ['grade', 'Theo khối'], ['day', 'Theo ngày'], ['student', 'Học sinh vắng nhiều']];

export default function Reports() {
    const { toast } = useCa();
    const [range, setRange] = useState(presetRange('month'));
    const [group, setGroup] = useState('class');
    const [busy, setBusy] = useState(false);
    const { data, err, loading, reload } = useLoad(async () => (await ca<Rep>(`report${qs({ from: range.from, to: range.to, group })}`)).data, [range.from, range.to, group]);
    const sum = useLoad(async () => (await ca<unknown[]>(`classes${qs({ from: range.from, to: range.to })}`)).meta as unknown as { summary: Counts }, [range.from, range.to]);
    const s = sum.data?.summary;

    const exportCsv = async () => {
        setBusy(true);
        try { await downloadFile(`report/export${qs({ from: range.from, to: range.to, group })}`, `chuyen-can-${group}-${range.from}-${range.to}.csv`); toast('Đã tải tệp CSV (mở được bằng Excel).'); }
        catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
    };
    const rateCol = data ? data.columns.findIndex((c) => c.startsWith('Tỉ lệ')) : -1;

    return (
        <div className="ca-page ca-report">
            <div className="ca-ptitle">
                <div><h2>Báo cáo chuyên cần</h2><p>Xuất số liệu theo lớp, khối, ngày hoặc danh sách học sinh vắng nhiều để nộp lên cấp trên hoặc họp hội đồng.</p></div>
                <div className="acts"><Btn onClick={() => window.print()}><Ico n="print" size={16} />In báo cáo</Btn><Btn tone="primary" busy={busy} onClick={exportCsv}><Ico n="download" size={16} />Xuất CSV</Btn></div>
            </div>
            <RangeBar value={range} onChange={setRange} />
            <Seg value={group} onChange={setGroup} items={GROUPS} />

            <div className="ca-printhead"><h2>BÁO CÁO CHUYÊN CẦN HỌC SINH</h2><p>{GROUPS.find(([k]) => k === group)?.[1]} · Từ {fmtD(range.from)} đến {fmtD(range.to)}</p></div>

            {s && (
                <div className="ca-kpis four">
                    <div className="ca-kpi t-teal"><span className="ic"><Ico n="trend" size={20} /></span><div><small>Tỉ lệ toàn trường</small><b>{s.total ? `${s.rate}%` : '—'}</b><em>{num(s.total)} lượt điểm danh</em></div></div>
                    <div className="ca-kpi t-green"><span className="ic"><Ico n="check" size={20} /></span><div><small>Có mặt</small><b>{num(s.present)}</b><em>{num(s.late)} đi muộn</em></div></div>
                    <div className="ca-kpi t-sky"><span className="ic"><Ico n="doc" size={20} /></span><div><small>Vắng có phép</small><b>{num(s.excused)}</b></div></div>
                    <div className="ca-kpi t-rose"><span className="ic"><Ico n="x" size={20} /></span><div><small>Vắng không phép</small><b>{num(s.unexcused)}</b></div></div>
                </div>
            )}

            <Card pad={false}>
                {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : !data || data.rows.length === 0 ? <Empty icon="doc" title="Không có số liệu trong khoảng này" text="Hãy chọn khoảng ngày có điểm danh." /> : (
                    <div className="ca-tablewrap"><table className="ca-tbl zebra"><thead><tr>{data.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                        <tbody>{data.rows.map((r, i) => (
                            <tr key={i}>{r.map((v, j) => <td key={j} className={j === rateCol ? 'rate' : typeof v === 'number' ? 'n' : ''}>{typeof v === 'number' ? (j === rateCol ? `${v}%` : num(v)) : v}</td>)}</tr>
                        ))}</tbody></table></div>
                )}
            </Card>
            <p className="ca-foot">Số liệu cập nhật theo thời gian thực từ dữ liệu điểm danh. Tệp CSV có mã hóa UTF-8, mở trực tiếp bằng Excel.</p>
        </div>
    );
}