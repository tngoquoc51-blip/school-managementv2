<?php

namespace Database\Seeders;

use App\Services\LessonLog\LessonLogService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Dữ liệu mẫu: php artisan db:seed --class=LessonLogDemoSeeder (chỉ chạy khi chưa có bản ghi sổ đầu bài). */
class LessonLogDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (DB::table('sm_lesson_logs')->exists()) {
            $this->command?->warn('Đã có dữ liệu sổ đầu bài – bỏ qua.');
            return;
        }
        $svc = app(LessonLogService::class);
        $class = $svc->classes()[0] ?? null;
        if (! $class) {
            $this->command?->warn('Chưa có lớp nào trong năm học hiện hành – không tạo được dữ liệu mẫu.');
            return;
        }
        $staff = DB::table(config('lesson_log.tables.staff'))->whereIn('role', array_merge(config('lesson_log.allowed_roles'), config('lesson_log.admin_roles')))->first();
        $a = ['id' => (int) ($staff->id ?? 0), 'name' => $staff->full_name ?? 'Giáo viên mẫu', 'role' => strtolower((string) ($staff->role ?? 'teacher'))];
        $roster = $svc->roster($class['id']);
        $subjects = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lí', 'Hóa học'];
        $titles = ['Hàm số bậc hai', 'Đọc hiểu văn bản nghị luận', 'Unit 5: Cultural identity', 'Chuyển động tròn đều', 'Cân bằng hóa học'];
        $ratings = ['good', 'fair', 'good', 'pass', 'fair'];

        $d = Carbon::today();
        $made = 0;
        while ($made < 6) {
            if ($d->dayOfWeekIso <= 6) {
                foreach ([1, 2, 3] as $p) {
                    $i = ($made * 3 + $p) % 5;
                    $abs = [];
                    if ($roster && $p === 1) {
                        $abs[] = ['student_id' => $roster[$made % count($roster)]['id'], 'type' => $made % 2 ? 'excused' : 'unexcused', 'reason' => $made % 2 ? 'Ốm' : null];
                        if (count($roster) > 3) {
                            $abs[] = ['student_id' => $roster[(($made + 2) % count($roster))]['id'], 'type' => 'late', 'reason' => 'Đến muộn 10 phút'];
                        }
                    }
                    try {
                        $id = $svc->store(['class_id' => $class['id'], 'lesson_date' => $d->toDateString(), 'period' => $p, 'subject_name' => $subjects[$i],
                            'lesson_no' => 10 + $made, 'title' => $titles[$i], 'content' => 'Giảng bài mới, làm bài tập vận dụng, củng cố cuối tiết.',
                            'equipment' => 'Máy chiếu', 'homework' => 'Làm bài tập trang 45–46', 'rating' => $ratings[$i], 'remark' => 'Lớp học tập nghiêm túc.', 'absences' => $abs], $a);
                        if (! ($made === 0 && $p === 3)) {            // để lại 1 tiết ở trạng thái nháp
                            $svc->sign($id, $a);
                        }
                    } catch (\Throwable $e) {
                        // bỏ qua ô bị trùng / quá hạn
                    }
                }
                $made++;
            }
            $d->subDay();
        }
        $this->command?->info("Đã tạo sổ đầu bài mẫu cho lớp {$class['name']}.");
    }
}
