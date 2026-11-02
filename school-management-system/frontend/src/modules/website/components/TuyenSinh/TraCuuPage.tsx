import Link from 'next/link';
import s from './TuyenSinh.module.css';
import ImageSlot from '../ImageSlot';
import Icon from '../Icons';
import TraCuuForm from './TraCuuForm';
import { SCHOOL } from '../../data/school';
import { TL_HELP, TL_HERO, TS_IMG } from './tuyen-sinh.data';

/** Trang Tra cứu hồ sơ tuyển sinh. Dùng chung TuyenSinh.module.css và tuyen-sinh.data.ts. */
export default function TraCuuPage() {
    const phone = SCHOOL.phone?.trim() || '';
    const tel = phone.replace(/\s/g, '');
    return (
        <div className={s.page}>
            <section className={`${s.hero} ${s.heroSm}`}>
                <ImageSlot src={TS_IMG.hero} fallback="/images/hero-chung.jpg" alt="" tone="a" className={s.heroBg} hint={false} eager />
                <div className={s.heroShade} />
                <div className={`${s.container} ${s.heroIn}`}>
                    <nav className={s.crumb} aria-label="Đường dẫn">
                        <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span><Link href="/tuyen-sinh">Tuyển sinh</Link><span aria-hidden="true">›</span><b aria-current="page">Tra cứu hồ sơ</b>
                    </nav>
                    <span className={s.eyebrow}>{TL_HERO.eyebrow}</span>
                    <h1>{TL_HERO.title}</h1>
                    <p>{TL_HERO.intro}</p>
                </div>
            </section>

            <section className={`${s.section} ${s.sectionLookup}`}>
                <div className={`${s.container} ${s.lookupWrap}`}>
                    <TraCuuForm />
                    <aside className={s.help}>
                        <h2>{TL_HELP.title}</h2>
                        <ul>{TL_HELP.items.map((x) => <li key={x}><Icon name="check" size={18} />{x}</li>)}</ul>
                        <div className={s.sideCall}>
                            <span className={s.ic}><Icon name="phone" size={22} /></span>
                            <div>
                                <small>Gọi nhà trường</small>
                                {phone ? <a href={`tel:${tel}`}><b>{phone}</b></a> : <b>Đang cập nhật</b>}
                                <em>{SCHOOL.hours}</em>
                            </div>
                        </div>
                        <p className={s.center}><Link href="/tuyen-sinh#dang-ky" className={`${s.btn} ${s.btnLine}`}>Chưa đăng ký? Đăng ký ngay</Link></p>
                    </aside>
                </div>
            </section>
        </div>
    );
}