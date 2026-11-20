<?php

namespace Modules\Roster\Services;

use Illuminate\Support\Facades\DB;
use Modules\Catalog\Exceptions\CatalogException;

/** Hàm dùng chung: năm học, sĩ số, giáo viên. */
class RosterSupport
{
    public const CLASS_MAX = 45;
    public const CLASS_MIN = 20;

    public function years(): array
    {
        return DB::table('sm_school_years')->orderByDesc('start_date')->get()
            ->map(fn ($y) => ['id' => (int) $y->id, 'label' => $y->label, 'is_current' => (bool) $y->is_current, 'status' => $y->status, 'start_date' => $y->start_date, 'end_date' => $y->end_date])->all();
    }

    public function resolveYear(?int $yearId): int
    {
        if ($yearId && DB::table('sm_school_years')->where('id', $yearId)->exists()) {
            return $yearId;
        }
        $id = DB::table('sm_school_years')->where('is_current', 1)->value('id') ?? DB::table('sm_school_years')->max('id');
        if (! $id) {
            throw new CatalogException('Chưa có năm học nào trong hệ thống.', 404);
        }

        return (int) $id;
    }

    public function teachers(int $yearId): array
    {
        $homeroom = DB::table('sm_classes')->where('school_year_id', $yearId)->whereNotNull('homeroom_teacher_id')->pluck('name', 'homeroom_teacher_id');

        return DB::table('sm_teachers as t')->leftJoin('sm_subjects as s', 's.id', '=', 't.main_subject_id')
            ->select('t.id', 't.code', 't.full_name', 't.gender', 's.name as subject')->orderBy('t.full_name')->get()
            ->map(fn ($t) => ['id' => (int) $t->id, 'code' => $t->code, 'full_name' => $t->full_name, 'gender' => $t->gender, 'subject' => $t->subject, 'homeroom_of' => $homeroom[$t->id] ?? null])->all();
    }

    public function subjects(): array
    {
        return DB::table('sm_subjects')->orderBy('sort_order')->get(['id', 'code', 'name', 'periods_per_week'])->map(fn ($s) => (array) $s)->all();
    }
}
