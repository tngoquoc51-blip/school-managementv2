import { redirect } from 'next/navigation';

// Menu cũ trỏ tới /homeroom/rewards -> chuyển sang trang Thi đua - Khen thưởng mới.
export default function RewardsRedirect() {
    redirect('/homeroom/awards');
}