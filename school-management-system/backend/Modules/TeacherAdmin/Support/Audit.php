<?php

namespace Modules\TeacherAdmin\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/** Nhật ký thay đổi module giáo viên (không bao giờ làm hỏng thao tác chính). */
class Audit
{
    public static function log(string $action, string $summary, ?int $teacherId = null): void
    {
        try {
            $u = request()->user();
            DB::table('sm_tch_audit')->insert([
                'teacher_id' => $teacherId,
                'action'     => $action,
                'summary'    => mb_substr($summary, 0, 255),
                'actor'      => $u->name ?? $u->full_name ?? $u->username ?? 'system',
                'ip'         => request()->ip(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('teacher audit failed: ' . $e->getMessage());
        }
    }

    public static function yearId(?int $requested = null): int
    {
        if ($requested) {
            return $requested;
        }
        return (int) (DB::table('sm_school_years')->where('is_current', 1)->value('id')
            ?? DB::table('sm_school_years')->orderByDesc('id')->value('id'));
    }
}
