<?php

namespace App\Console\Commands;

use App\Support\DataCrypto;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class EncryptExistingPii extends Command
{
    protected $signature = 'school:encrypt-pii {--dry-run : Chỉ thống kê, không ghi}';
    protected $description = 'Mã hóa PII trong sm_student_profiles (an toàn, bỏ qua đã mã hóa)';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $cols = DataCrypto::SENSITIVE_COLS;
        $n = 0;

        DB::table('sm_student_profiles')->orderBy('student_id')->chunkById(100, function ($rows) use ($cols, $dry, &$n) {
            foreach ($rows as $row) {
                $update = [];
                foreach ($cols as $c) {
                    $v = $row->$c ?? null;
                    if (!is_string($v) || $v === '') {
                        continue;
                    }
                    if (DataCrypto::looksEncrypted($v)) {
                        continue;
                    }
                    $update[$c] = DataCrypto::encrypt($v);
                }
                if ($update) {
                    $n++;
                    if (!$dry) {
                        DB::table('sm_student_profiles')
                            ->where('student_id', $row->student_id)
                            ->update($update);
                    }
                }
            }
        }, 'student_id');

        $this->info(($dry ? '[DRY] ' : '') . "Đã xử lý {$n} hồ sơ.");
        return self::SUCCESS;
    }
}
