import s from '../website.module.css';
import { FAQ } from '../data/school';

export default function Faq() {
    return (
        <div className={s.faq}>
            {FAQ.map((f) => (
                <details key={f.q} className={s.faqItem}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                </details>
            ))}
        </div>
    );
}
