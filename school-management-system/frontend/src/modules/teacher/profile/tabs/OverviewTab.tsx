'use client';

import { profileApi } from '@/services/teacherProfileService';
import { Empty, Icon, Skeleton, ago, colorOf, fmtDate, inHomeroom, useFetch, GENDER } from '../ui';
import type { Overview, TabKey } from '../types';
import s from '../profile.module.css';

const LINKS = [['/teacher/attendance', 'Điểm danh', 'users'], ['/teacher/grades', 'Nhập điểm', 'grade'], ['/teacher/classes', 'Lớp của tôi', 'book'], ['/teacher/homework', 'Bài tập', 'pen'], ['/teacher/dashboard', 'Tổng quan giảng dạy', 'home']];

export default function OverviewTab({ ov, go }: { ov: Overview; go: (t: TabKey) => void }) {
    const teaching = useFetch(() => profileApi.teaching());
    const activity = useFetch(() => profileApi.activity(1));
    const d = new Date().getDay(); const wd = d === 0 ? 0 : d + 1;
    const today = (teaching.data?.slots || []).filter((x) => x.weekday === wd);
    const periods = teaching.data?.periods || [];
    const p = ov.profile;
    const hr = inHomeroom();

    return (
        <div className={`${s.panel} ${s.g21}`}>
            <div className={s.stack}>
                {ov.homeroom_detail?.map((h) => (
                    <section key={h.id} className={s.card}>
                        <div className={s.cardHead}>
                            <div><h3 className={s.cardTitle}><Icon n="home" /> Lớp chủ nhiệm {h.name}</h3><div className={s.cardSub}>Khối {h.grade}{h.room ? ` • Phòng ${h.room}` : ''}</div></div>
                            {h.pending_leaves > 0 ? <span className={`${s.badge} ${s.bWarn}`}>{h.pending_leaves} đơn xin nghỉ chờ duyệt</span> : <span className={`${s.badge} ${s.bOk}`}>Không có đơn chờ duyệt</span>}
                        </div>
                        <div className={s.g3}>
                            <div className={s.miniItem}><b>{h.students}</b><span>Sĩ số (tối đa {h.capacity})</span></div>
                            <div className={s.miniItem}><b>{h.male}</b><span>Học sinh nam</span></div>
                            <div className={s.miniItem}><b>{h.female}</b><span>Học sinh nữ</span></div>
                        </div>
                        <div className={s.bar} style={{ marginTop: 14 }}><div className={s.barFill} style={{ width: `${Math.min(100, Math.round((h.students / Math.max(1, h.capacity)) * 100))}%` }} /></div>
                    </section>))}
                <section className={s.card}>
                    <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="clock" /> Lịch dạy hôm nay</h3><div className={s.cardSub}>{wd === 0 ? 'Chủ nhật – không có tiết dạy' : `Thứ ${wd} • ${new Date().toLocaleDateString('vi-VN')}`}</div></div>
                        <button className={s.btn} onClick={() => go('teaching')}>Xem tuần</button></div>
                    {teaching.loading ? <Skeleton h={56} n={2} /> : today.length === 0 ? <Empty icon="☕" text="Hôm nay bạn không có tiết dạy." /> : (
                        <div className={s.stack} style={{ gap: 10 }}>{today.map((t) => { const per = periods.find((x) => x.id === t.period); return (
                            <div key={t.period} className={s.item}><div className={s.itemIco} style={{ background: colorOf(t.subject_name), color: '#fff', fontWeight: 700 }}>{t.period}</div>
                                <div style={{ flex: 1 }}><b>{t.subject_name} – Lớp {t.class_name}</b><div className={s.cardSub}>{per ? `${per.start_time.slice(0, 5)} – ${per.end_time.slice(0, 5)}` : `Tiết ${t.period}`}{t.room ? ` • Phòng ${t.room}` : ''}</div></div>
                                {!hr && <a className={`${s.btn} ${s.btnS}`} href="/teacher/attendance">Điểm danh</a>}</div>); })}</div>)}
                </section>

                {!hr && <section className={s.card}>
                    <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="send" /> Truy cập nhanh</h3></div>
                    <div className={s.quick} style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>{LINKS.map(([h, l, i]) => <a key={h} href={h}><Icon n={i} /> {l}</a>)}</div>
                </section>}

                <section className={s.card}>
                    <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="list" /> Hoạt động gần đây</h3><button className={s.btn} onClick={() => go('activity')}>Tất cả</button></div>
                    {activity.loading ? <Skeleton h={40} n={3} /> : !activity.data?.data.length ? <Empty text="Chưa có hoạt động." /> : (
                        <div className={s.timeline}>{activity.data.data.slice(0, 5).map((a) => <div key={a.id} className={s.tlItem}><b>{a.description}</b><small>{ago(a.created_at)}</small></div>)}</div>)}
                </section>
            </div>

            <div className={s.stack}>
                <section className={s.card}>
                    <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="user" /> Thông tin nhanh</h3><button className={s.btn} onClick={() => go('personal')}>Sửa</button></div>
                    <dl className={s.kv}>
                        <dt>Tên đăng nhập</dt><dd>{ov.user.username || '—'}</dd><dt>Điện thoại</dt><dd>{ov.user.phone || '—'}</dd>
                        <dt>Email</dt><dd>{p?.email || '—'}</dd><dt>Giới tính</dt><dd>{(p?.gender && GENDER[p.gender]) || ov.teacher?.gender || '—'}</dd>
                        <dt>Ngày sinh</dt><dd>{fmtDate(p?.birth_date)}</dd><dt>Dân tộc</dt><dd>{p?.ethnicity || '—'}</dd>
                        <dt>Trình độ</dt><dd>{p?.degree_level || '—'}</dd><dt>Chuyên ngành</dt><dd>{p?.major || '—'}</dd>
                        <dt>Tổ chuyên môn</dt><dd>{p?.department || '—'}</dd><dt>Vào trường</dt><dd>{fmtDate(p?.joined_at)}</dd>
                        <dt>Quê quán</dt><dd>{p?.hometown || '—'}</dd><dt>Nơi ở hiện nay</dt><dd>{p?.address || '—'}</dd>
                    </dl>
                    {p?.bio && <p style={{ color: 'var(--ink2)', borderTop: '1px dashed var(--line)', paddingTop: 12, marginBottom: 0 }}>{p.bio}</p>}
                </section>
            </div>
        </div>
    );
}