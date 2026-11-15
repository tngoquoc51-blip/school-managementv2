'use client';

import { useEffect, useState } from 'react';
import { errMsg, rewardsApi } from '@/modules/bgh/rewards/rewardsService';
import type { Award, AwardsOverview, ViewProps } from '@/modules/bgh/rewards/types';
import { Empty, fdt, fmt, Icon, Skeleton } from '../ui';

const who = (a: Award) => (a.target_type === 'class' ? `Lớp ${a.class_name || '—'}` : `${a.student_name || '—'}${a.class_name ? ' · ' + a.class_name : ''}`);

/** Trang chủ phân hệ Khen thưởng: số liệu năm học, xu hướng, việc cần xử lý */
export default function AwardsHome({ meta, yearId, rev, go, openAward, openClass, mode, kinds }: ViewProps) {
    const D = mode === 'discipline';
    const [d, setD] = useState<AwardsOverview | null>(null);
    const [err, setErr] = useState('');

    useEffect(() => {
        setD(null); setErr('');
        rewardsApi.awardsOverview(yearId, kinds).then(setD).catch((e) => setErr(errMsg(e)));
    }, [yearId, rev, kinds]);

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;
    if (!d) return <div className="rw-stack"><Skeleton h={120} /><div className="rw-grid4"><Skeleton h={90} /><Skeleton h={90} /><Skeleton h={90} /><Skeleton h={90} /></div><Skeleton h={240} /></div>;

    const k = d.kpi;
    const maxM = Math.max(1, ...d.by_month.map((m) => m.n));
    const maxL = Math.max(1, ...d.by_level.map((l) => l.n));

    return (
        <div className="rw-stack">
            <section className="hero">
                <div>
                    <div className="big">{k.approved}</div>
                    <div className="cap">{D ? 'quyết định đã duyệt' : 'lượt khen thưởng đã duyệt'}</div>
                </div>
                <span className="ln" />
                <div>
                    <h2>{D ? 'Nhắc nhở & kỷ luật' : 'Khen thưởng'} năm học {meta.year.label}</h2>
                    <p>{D ? 'Theo dõi các trường hợp nhắc nhở, kỷ luật của lớp và học sinh. Mọi đề xuất đều cần Ban Giám hiệu phê duyệt trước khi có hiệu lực.' : 'Ghi nhận tập thể lớp và học sinh tiêu biểu. Khen thưởng tập thể được phê duyệt sẽ tự cộng điểm thưởng vào bảng xếp hạng thi đua.'}</p>
                </div>
                <div className="acts">
                    <button className="btn brass" onClick={() => openAward()}><Icon n="plus" s={16} />{D ? 'Lập đề xuất' : 'Tạo đề xuất'}</button>
                    <button className="btn ghost" onClick={() => go('awards')}><Icon n="check" s={16} />Xét duyệt{k.pending > 0 ? ` (${k.pending})` : ''}</button>
                    {!D && <button className="btn ghost" onClick={() => go('honor')}><Icon n="star" s={16} />Bảng vàng</button>}
                </div>
            </section>

            <section className="tiles">
                <button className="tile" onClick={() => go(D ? 'awards' : 'honor')}><span className={`ic ${D ? 'amber' : 'gold'}`}><Icon n={D ? 'alert' : 'award'} s={22} /></span><div><div className="v">{k.approved}</div><div className="l">{D ? 'Đã xử lý' : 'Đã khen thưởng'}</div></div></button>
                <button className="tile" onClick={() => go('awards')}><span className="ic amber"><Icon n="log" s={22} /></span><div><div className="v">{k.pending}</div><div className="l">Chờ xét duyệt</div></div></button>
                <div className="tile"><span className="ic blue"><Icon n="users" s={22} /></span><div><div className="v">{k.classes}<small className="muted" style={{ fontSize: 14, fontWeight: 600 }}>/{meta.classes.length}</small></div><div className="l">{D ? 'Lớp bị nhắc nhở, kỷ luật' : 'Lớp được khen thưởng'}</div></div></div>
                <div className="tile"><span className="ic green"><Icon n="user" s={22} /></span><div><div className="v">{k.students}</div><div className="l">{D ? 'Học sinh bị xử lý' : `Học sinh được khen · +${fmt(k.bonus)} điểm thi đua`}</div></div></div>
            </section>

            <section className="rw-cols">
                <div className="panel">
                    <div className="ph"><h3>{D ? 'Theo tháng' : 'Khen thưởng theo tháng'}</h3><span className="spacer" /><span className="muted">Số lượt đã duyệt</span></div>
                    <div className="pb">
                        {!d.by_month.length ? <Empty icon="award" text="Chưa có dữ liệu được duyệt." /> : (
                            <div className="vbars">
                                {d.by_month.map((m) => (
                                    <div className="c" key={m.ym}><b>{m.n}</b><i style={{ height: `${(m.n / maxM) * 100}%` }} title={`${m.label}: ${m.n}`} /><span>{m.label}</span></div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="panel">
                    <div className="ph"><h3>{D ? 'Theo hình thức' : 'Theo cấp khen thưởng'}</h3></div>
                    <div className="pb">
                        {(() => {
                            const rows = D ? d.by_kind.map((x) => ({ lv: x.kd === 'ky_luat' ? 'Kỷ luật' : 'Nhắc nhở', n: x.n })) : d.by_level;
                            return !rows.length ? <Empty icon="info" text="Chưa có dữ liệu." /> : rows.map((l) => (
                                <div className="hbar" key={l.lv}><span>{l.lv}</span><div className="t"><i style={{ width: `${(l.n / Math.max(1, ...rows.map((r) => r.n))) * 100}%` }} /></div><b>{l.n}</b></div>
                            ));
                        })()}
                    </div>
                </div>
            </section>

            <section className="rw-cols3">
                <div className="panel">
                    <div className="ph"><h3>Chờ xét duyệt</h3><span className="spacer" /><button className="btn ghost sm" onClick={() => go('awards')}>Xem tất cả</button></div>
                    {!d.pending.length ? <Empty icon="check" text="Không có đề xuất nào đang chờ." /> : d.pending.map((a) => (
                        <button className="mini" key={a.id} onClick={() => go('awards')}>
                            <span className="n"><b>{a.title}</b><span>{who(a)} · {fdt(a.created_at)}</span></span>
                            {Number(a.bonus_points) > 0 && <span className="badge good">+{fmt(a.bonus_points, 0)}</span>}
                        </button>
                    ))}
                </div>
                <div className="panel">
                    <div className="ph"><h3>{D ? 'Lớp bị xử lý nhiều nhất' : 'Lớp được khen nhiều nhất'}</h3></div>
                    {!d.top_classes.length ? <Empty icon="users" text="Chưa có dữ liệu." /> : d.top_classes.map((c, i) => (
                        <button className="mini" key={c.id} onClick={() => openClass(c.id)}>
                            <span className={`rank-no${i < 3 ? ' r' + (i + 1) : ''}`}>{i + 1}</span>
                            <span className="n"><b>Lớp {c.name}</b></span><span className="badge info">{c.n} lượt</span>
                        </button>
                    ))}
                </div>
                <div className="panel">
                    <div className="ph"><h3>{D ? 'Xử lý gần đây' : 'Khen thưởng gần đây'}</h3><span className="spacer" />{!D && <button className="btn ghost sm" onClick={() => go('honor')}>Bảng vàng</button>}</div>
                    {!d.recent.length ? <Empty icon="award" text={D ? 'Chưa có trường hợp nào.' : 'Chưa có khen thưởng.'} /> : d.recent.map((a) => (
                        <div className="mini" key={a.id}>
                            <span className="tile" style={{ padding: 0, border: 0 }}><span className="ic gold" style={{ width: 34, height: 34 }}><Icon n={D ? 'alert' : 'award'} s={17} /></span></span>
                            <span className="n"><b>{a.title}</b><span>{who(a)} · {fdt(a.reviewed_at || a.created_at)}</span></span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}