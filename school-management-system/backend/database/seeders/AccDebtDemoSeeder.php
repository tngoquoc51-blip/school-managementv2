<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Dữ liệu mẫu để thử giao diện: php artisan db:seed --class=AccDebtDemoSeeder (chỉ chạy khi bảng còn trống). */
class AccDebtDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (DB::table('acc_receivables')->exists()) {
            $this->command?->warn('Đã có dữ liệu công nợ – bỏ qua.');
            return;
        }

        $students = DB::table(config('accountant_debts.students.table'))->orderBy('id')->limit(40)->pluck('id');
        $tuition = [1320000, 1200000, 1380000];

        foreach ($students as $i => $sid) {
            $amount = $tuition[$i % 3];
            $tuitionId = DB::table('acc_receivables')->insertGetId([
                'student_id' => $sid, 'school_year' => '2026-2027', 'term' => 'HK1', 'title' => 'Học phí HK1',
                'amount' => $amount, 'discount' => $i % 7 === 0 ? 120000 : 0,
                'due_date' => $i % 4 === 0 ? '2026-09-15' : '2026-10-31', 'created_at' => now(), 'updated_at' => now(),
            ]);
            $insuranceId = DB::table('acc_receivables')->insertGetId([
                'student_id' => $sid, 'school_year' => '2026-2027', 'term' => 'CN', 'title' => 'Bảo hiểm y tế',
                'amount' => 704000, 'discount' => 0, 'due_date' => '2026-10-15', 'created_at' => now(), 'updated_at' => now(),
            ]);

            // mẫu: 0 = chưa đóng, 1/2 = đóng một phần, còn lại = đóng đủ
            $pattern = $i % 5;
            $pay = function (int $rid, int $amt, string $method, string $at) use ($sid) {
                if ($amt <= 0) {
                    return;
                }
                $id = DB::table('acc_payments')->insertGetId([
                    'receivable_id' => $rid, 'student_id' => $sid, 'amount' => $amt, 'method' => $method,
                    'paid_at' => $at, 'created_at' => now(), 'updated_at' => now(),
                ]);
                DB::table('acc_payments')->where('id', $id)->update(['receipt_no' => 'PT2026-' . str_pad((string) $id, 6, '0', STR_PAD_LEFT)]);
            };

            if ($pattern === 1) {
                $pay($tuitionId, (int) round($amount * 0.55, -3), 'cash', '2026-09-20 09:30:00');
            } elseif ($pattern === 2) {
                $pay($tuitionId, (int) round($amount * 0.3, -3), 'transfer', '2026-09-25 14:10:00');
            } elseif ($pattern >= 3) {
                $pay($tuitionId, $amount - ($i % 7 === 0 ? 120000 : 0), $pattern === 3 ? 'cash' : 'transfer', '2026-09-12 08:45:00');
                $pay($insuranceId, 704000, 'cash', '2026-09-12 08:46:00');
            }
        }

        $this->command?->info('Đã tạo dữ liệu mẫu công nợ cho ' . count($students) . ' học sinh.');
    }
}
