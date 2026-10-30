import type { Metadata } from 'next';
import Link from 'next/link';
import s from '@/modules/website/site.module.css';
import Icon from '@/modules/website/components/Icons';
import { AdmitBand, NewsCard, PageHead, SectionHead } from '@/modules/website/components/Parts';
import { load, type NewsItem, type NewsList } from '@/modules/website/lib/api';
import { CLUBS, DAY, FACILITIES } from '@/modules/website/data/school';

export const metadata: Metadata = { title: 'Đời sống học đường', description: 'Một ngày ở trường, câu lạc bộ, cơ sở vật chất và hoạt động của học sinh.' };

export default async function LifePage() {
    const nw = await load<NewsList>('news?category=Ho%E1%BA%A1t%20%C4%91%E1%BB%99ng&per_page=3', { items: [] as NewsItem[], total: 0, page: 1, pages: 1, per_page: 3, categories: [] });
    const groups = Array.from(new Set(CLUBS.map((c) => c.group)));
    return (
        <>
            <PageHead title="Đời sống học đường" desc="Học tập nghiêm túc, nhưng không chỉ có sách vở. Đây là một ngày và những nơi các em gắn bó." trail={[['Đời sống học đường']]} />

            <section className={s.section}>
                <div className={`${s.container} ${s.split}`}>
                    <div>
                        <h2 className={s.h2}>Một ngày ở trường</h2>
                        <p className={s.lead}>Lịch học mẫu. Thời gian cụ thể có thể thay đổi theo từng học kỳ và được thông báo trên cổng thông tin.</p>
                    </div>
                    <ol className={s.day}>{DAY.map(([t, h, d]) => <li key={t}><time>{t}</time><div><h3>{h}</h3><p>{d}</p></div></li>)}</ol>
                </div>
            </section>

            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={s.container}>
                    <SectionHead title="Câu lạc bộ" desc="Học sinh chọn câu lạc bộ theo sở thích và có thể tham gia nhiều nơi, miễn là cân đối được việc học." />
                    <div className={s.clubs}>
                        {groups.map((g) => (
                            <section key={g}>
                                <h3>{g}</h3>
                                <ul className={s.chips}>{CLUBS.filter((c) => c.group === g).map((c) => <li key={c.name}>{c.name}</li>)}</ul>
                            </section>
                        ))}
                    </div>
                </div>
            </section>

            <section className={s.section}>
                <div className={s.container}>
                    <SectionHead title="Cơ sở vật chất" />
                    <div className={s.bento}>
                        {FACILITIES.map((f) => (
                            <article key={f.title} className={`${s.bentoItem} ${f.size === 'lg' ? s.bentoLg : f.size === 'wide' ? s.bentoWide : ''}`}>
                                <span className={s.bentoIc}><Icon name={f.icon} size={26} /></span><h3>{f.title}</h3><p>{f.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {nw.data.items.length > 0 && (
                <section className={`${s.section} ${s.sectionTint}`}>
                    <div className={s.container}>
                        <SectionHead title="Hoạt động gần đây" action={<Link href="/tin-tuc?category=Ho%E1%BA%A1t%20%C4%91%E1%BB%99ng" className={s.link}>Xem thêm<Icon name="arrow" size={18} /></Link>} />
                        <div className={s.newsRow}>{nw.data.items.map((n) => <NewsCard key={n.id} n={n} />)}</div>
                    </div>
                </section>
            )}
            <AdmitBand />
        </>
    );
}