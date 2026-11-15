<?php

namespace Database\Seeders;

use App\Services\Plans\PlanService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Dữ liệu mẫu: php artisan db:seed --class=SchoolPlanDemoSeeder (chỉ chạy khi chưa có kế hoạch nào). */
class SchoolPlanDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (DB::table('school_plans')->exists()) {
            $this->command?->warn('Đã có kế hoạch – bỏ qua.');
            return;
        }
        $svc = app(PlanService::class);
        $actor = ['id' => null, 'name' => 'Hiệu trưởng'];
        $y = Carbon::now()->month >= 8 ? Carbon::now()->year : Carbon::now()->year - 1;
        $sy = $y . '-' . ($y + 1);

        $year = $svc->store(['title' => "Kế hoạch năm học $y – " . ($y + 1), 'level' => 'year', 'category' => 'academic', 'school_year' => $sy, 'owner_name' => 'Hiệu trưởng',
            'start_date' => "$y-08-15", 'end_date' => ($y + 1) . '-07-31', 'priority' => 'high', 'status' => 'running', 'progress' => 35,
            'objectives' => 'Nâng cao chất lượng giáo dục toàn diện, đổi mới quản lý bằng hệ thống số.'], $actor);

        $hk1 = $svc->store(['title' => 'Kế hoạch học kỳ I', 'level' => 'semester', 'term' => 'HK1', 'category' => 'academic', 'school_year' => $sy, 'parent_id' => $year, 'owner_name' => 'Phó Hiệu trưởng chuyên môn',
            'start_date' => "$y-08-15", 'end_date' => ($y + 1) . '-01-15', 'status' => 'running', 'progress' => 70], $actor);
        $svc->store(['title' => 'Kế hoạch học kỳ II', 'level' => 'semester', 'term' => 'HK2', 'category' => 'academic', 'school_year' => $sy, 'parent_id' => $year, 'owner_name' => 'Phó Hiệu trưởng chuyên môn',
            'start_date' => ($y + 1) . '-01-16', 'end_date' => ($y + 1) . '-05-31', 'status' => 'approved'], $actor);

        $mid = $svc->fromTemplate('midterm', ['start_date' => "$y-10-10", 'title' => 'Kiểm tra giữa học kỳ I', 'owner_name' => 'Phòng Giáo vụ', 'school_year' => $sy], $actor);
        DB::table('school_plans')->where('id', $mid)->update(['parent_id' => $hk1, 'status' => 'running', 'budget' => 12000000, 'spent' => 4500000]);
        DB::table('school_plan_tasks')->where('plan_id', $mid)->orderBy('id')->limit(3)->update(['status' => 'done', 'completed_at' => now()]);
        $svc->recalc($mid);

        $adm = $svc->fromTemplate('admission', ['start_date' => ($y + 1) . '-03-01', 'title' => 'Tuyển sinh lớp 10 năm học ' . ($y + 1) . ' – ' . ($y + 2), 'owner_name' => 'Ban Tuyển sinh', 'school_year' => $sy], $actor);
        DB::table('school_plans')->where('id', $adm)->update(['status' => 'pending', 'submitted_at' => now(), 'priority' => 'high']);

        $spo = $svc->fromTemplate('sports', ['start_date' => "$y-11-01", 'title' => 'Hội thao truyền thống', 'owner_name' => 'Tổ GDTC', 'school_year' => $sy], $actor);
        DB::table('school_plans')->where('id', $spo)->update(['status' => 'draft']);

        $fac = $svc->fromTemplate('facility', ['start_date' => Carbon::now()->subDays(75)->toDateString(), 'title' => 'Sửa chữa phòng học và mua sắm thiết bị', 'owner_name' => 'Phòng Hành chính', 'school_year' => $sy], $actor);
        DB::table('school_plans')->where('id', $fac)->update(['status' => 'running', 'budget' => 85000000, 'spent' => 41000000]);  // trễ hạn để thử cảnh báo
        $svc->addLink($mid, ['kind' => 'exam', 'label' => 'Lịch thi & Kiểm tra', 'url' => '/bgh/exams'], $actor);
        $svc->addLink($mid, ['kind' => 'report', 'label' => 'Báo cáo thống kê', 'url' => '/bgh/reports'], $actor);

        $this->command?->info('Đã tạo kế hoạch mẫu.');
    }
}
