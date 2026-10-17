'use client';

import BGHLayout from '@/layouts/BGHLayout';

export default function BGHRootLayout({
                                          children,
                                      }: {
    children: React.ReactNode;
}) {
    return <BGHLayout>{children}</BGHLayout>;
}