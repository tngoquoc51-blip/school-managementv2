'use client';

import DataHub from './_components/DataHub';

/** Trang tĩnh /admin/data – không phụ thuộc thư mục [section], nên không còn bị 404. */
export default function AdminDataPage() {
    return <DataHub />;
}