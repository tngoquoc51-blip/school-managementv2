<?php

namespace Modules\Subject\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/** Ghi nhật ký thay đổi của module môn học (không bao giờ làm hỏng thao tác chính). */
class Audit
{
    public static function log(string $action, string $summary, ?int $subjectId = null): void
    {
        try {
            $user = request()->user();
            DB::table('sm_subj_audit')->insert([
                'subject_id' => $subjectId,
                'action'     => $action,
                'summary'    => mb_substr($summary, 0, 255),
                'actor'      => $user->name ?? $user->full_name ?? $user->username ?? 'system',
                'ip'         => request()->ip(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('subject audit failed: ' . $e->getMessage());
        }
    }

    public static function currentYearId(?int $requested = null): int
    {
        if ($requested) {
            return $requested;
        }
        $id = DB::table('sm_school_years')->where('is_current', 1)->value('id')
            ?? DB::table('sm_school_years')->orderByDesc('id')->value('id');

        return (int) $id;
    }
}
