import type { ReactNode } from 'react';
import { Suspense } from 'react';
import './finance.css';
import { ToastProvider } from '@/modules/accountant/finance/Toast';
import { SessionProvider } from '@/modules/accountant/finance/session';
import Shell from '@/modules/accountant/finance/Shell';

export const metadata = { title: 'Hồ sơ tài chính học sinh | Kế toán' };

/** Embed trong AccountantLayout — không fixed full screen */
export default function FinanceLayout({ children }: { children: ReactNode }) {
    return (
        <div className="fx-root fx-embed" data-theme="light">
            <ToastProvider>
                <SessionProvider>
                    <Suspense fallback={null}>
                        <Shell>{children}</Shell>
                    </Suspense>
                </SessionProvider>
            </ToastProvider>
        </div>
    );
}