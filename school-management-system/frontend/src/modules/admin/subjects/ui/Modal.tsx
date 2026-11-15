'use client';
import { ReactNode, useEffect } from 'react';
import Icon from './Icon';

interface Props { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; side?: boolean }

export default function Modal({ title, subtitle, onClose, children, footer, size = 'md', side }: Props) {
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, [onClose]);
    return (
        <div className={`sj-overlay ${side ? 'is-side' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <section className={`sj-modal ${side ? 'sj-drawer' : `size-${size}`}`} role="dialog" aria-modal="true">
                <header className="sj-modal-h">
                    <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
                    <button className="sj-x" onClick={onClose} aria-label="Đóng"><Icon name="x" /></button>
                </header>
                <div className="sj-modal-b">{children}</div>
                {footer && <footer className="sj-modal-f">{footer}</footer>}
            </section>
        </div>
    );
}