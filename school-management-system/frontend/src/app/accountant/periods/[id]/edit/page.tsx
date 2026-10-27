'use client';
import { useParams } from 'next/navigation';
import PeriodForm from '../../_components/PeriodForm';

export default function EditPeriodPage() {
    const { id } = useParams<{ id: string }>();
    return <PeriodForm editId={Number(id)} />;
}