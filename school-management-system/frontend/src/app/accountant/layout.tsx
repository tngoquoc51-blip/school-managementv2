import AccountantLayout from '@/layouts/AccountantLayout';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
    return <AccountantLayout>{children}</AccountantLayout>;
}