import ClassDetailPage from '@/modules/admin/pages/ClassDetailPage';

export default function Page({ params }: { params: { id: string } }) {
    return <ClassDetailPage classId={Number(params.id)} />;
}