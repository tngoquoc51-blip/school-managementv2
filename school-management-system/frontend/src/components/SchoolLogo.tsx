'use client';

import Image from 'next/image';

type Props = {
    size?: number;       // px, mặc định 42
    showText?: boolean;  // hiện tên trường bên cạnh
    className?: string;
};

export default function SchoolLogo({ size = 42, showText = true, className = '' }: Props) {
    return (
        <div
            className={className}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
            }}
        >
            <Image
                src="/images/logo-thpt-ngo-sy-lien.png"
                alt="Logo Trường THPT Ngô Sỹ Liên"
                width={size}
                height={size}
                style={{
                    objectFit: 'contain',
                    borderRadius: 8,
                    flexShrink: 0,
                }}
                priority
            />
            {showText && (
                <div style={{ lineHeight: 1.25 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'inherit' }}>
                        THPT Ngô Sỹ Liên
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.85 }}>
                        Cổng Học sinh
                    </div>
                </div>
            )}
        </div>
    );
}