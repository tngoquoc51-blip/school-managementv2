'use client';

import Link from 'next/link';
import '../fees.css';
import { vnd } from '../_shared/api';
import { Crumbs, ErrorBox, Loading, useFee } from '../_shared/ui';

export default function Schedule() {
    const { data: d, err, reload } = useFee<any>('catalog');
    if (err) return <div className="fe-page"><ErrorBox msg={err} retry={reload} /></div>;
    if (!d) return <div className="fe-page"><Loading /></div>;
    return (
        <div className="fe-page">
            <Crumbs items={[{ label: 'Học phí', href: '/student/fees' }, { label: 'Biểu phí và miễn giảm' }]} />
            <header className="fe-hero" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
                <div><p className="fe-eyebrow">Năm học {d.year}</p><h1>Biểu phí và miễn giảm</h1><p className="sub">{d.class ? `Lớp ${d.class} · Khối ${d.grade}` : 'Các khoản thu của nhà trường'}</p>
                    <p className="fe-big">{vnd(d.mandatory_total)}</p><p className="sub">Dự kiến khoản bắt buộc cả năm · khoản tự nguyện tối đa {vnd(d.optional_total)}</p>
                    <div className="fe-hero-act"><Link className="fe-btn light" href="/student/fees">Về danh sách hóa đơn</Link></div></div>
            </header>
            {d.waivers.length > 0 && (
                <section className="fe-card"><div className="fe-card-h"><h2>Chế độ miễn giảm của bạn</h2></div><div className="fe-card-b"><div className="fe-grid fe-g3">
                    {d.waivers.map((w: any) => <div key={w.id} className="fe-stat ok"><span>Năm học {w.year}</span><b>Giảm {w.percent}%</b><em>{w.label}{w.note ? ` · ${w.note}` : ''}</em></div>)}
                </div><p className="fe-sub" style={{ marginTop: 12 }}>Miễn giảm được áp dụng trực tiếp lên khoản học phí khi lập hóa đơn.</p></div></section>
            )}
            {d.groups.map((g: any) => (
                <section key={g.key} className="fe-card"><div className="fe-card-h"><h2>{g.label}</h2></div>
                    <div className="fe-tw"><table className="fe-table"><thead><tr><th>Khoản thu</th><th>Loại</th><th className="n">Mức thu</th><th className="n">Dự kiến cả năm</th></tr></thead><tbody>
                    {g.items.map((it: any) => <tr key={it.code}><td>{it.name}{it.note && <span className="fe-sub">{it.note}</span>}</td><td><span className={`fe-pill ${it.mandatory ? 'info' : 'mut'}`}>{it.mandatory ? 'Bắt buộc' : 'Tự nguyện'}</span></td><td className="n">{vnd(it.amount)}<span className="fe-sub">/ {it.unit}</span></td><td className="n"><b>{vnd(it.yearly)}</b></td></tr>)}
                    </tbody></table></div></section>
            ))}
            <p className="fe-sub">Mức thu có thể điều chỉnh theo thông báo của nhà trường. Số tiền thực tế căn cứ vào hóa đơn đã lập.</p>
        </div>
    );
}