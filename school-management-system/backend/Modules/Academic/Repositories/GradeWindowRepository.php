<?php

namespace Modules\Academic\Repositories;

use Illuminate\Support\Facades\DB;

class GradeWindowRepository
{
    public function find(int $yearId, int $semester): ?object
    {
        return DB::table('sm_grade_windows')
            ->where('school_year_id', $yearId)->where('semester', $semester)->first();
    }

    public function all(int $yearId)
    {
        return DB::table('sm_grade_windows')->where('school_year_id', $yearId)->orderBy('semester')->get();
    }

    public function upsert(int $yearId, int $semester, array $data): int
    {
        $existing = $this->find($yearId, $semester);
        if ($existing) {
            DB::table('sm_grade_windows')->where('id', $existing->id)->update($data + ['updated_at' => now()]);
            return $existing->id;
        }
        return DB::table('sm_grade_windows')->insertGetId($data + [
            'school_year_id' => $yearId, 'semester' => $semester, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function exceptions(int $windowId)
    {
        return DB::table('sm_grade_window_exceptions as ex')
            ->join('sm_classes as c', 'c.id', '=', 'ex.class_id')
            ->leftJoin('sm_subjects as s', 's.id', '=', 'ex.subject_id')
            ->where('ex.window_id', $windowId)
            ->get(['ex.id', 'ex.class_id', 'c.name as class_name', 'ex.subject_id', 's.name as subject_name', 'ex.expires_at']);
    }

    public function addException(int $windowId, int $classId, ?int $subjectId, ?string $expiresAt, ?int $uid): int
    {
        return DB::table('sm_grade_window_exceptions')->insertGetId([
            'window_id' => $windowId, 'class_id' => $classId, 'subject_id' => $subjectId,
            'expires_at' => $expiresAt, 'created_by' => $uid, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function removeException(int $id): void
    {
        DB::table('sm_grade_window_exceptions')->where('id', $id)->delete();
    }

    /** Giáo viên có được nhập điểm cho lớp/môn này ngay lúc này không? */
    public function isOpenFor(int $yearId, int $semester, int $classId, int $subjectId): bool
    {
        $w = $this->find($yearId, $semester);
        if ($w && $w->status === 'open' && (! $w->closes_at || now()->lt($w->closes_at))) {
            return true;
        }
        if (! $w) return false;

        return DB::table('sm_grade_window_exceptions')
            ->where('window_id', $w->id)->where('class_id', $classId)
            ->where(fn ($q) => $q->whereNull('subject_id')->orWhere('subject_id', $subjectId))
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->exists();
    }

    public function log(int $yearId, int $semester, ?int $uid, string $action, ?string $detail): void
    {
        DB::table('sm_grade_activity')->insert([
            'school_year_id' => $yearId, 'semester' => $semester, 'user_id' => $uid,
            'action' => $action, 'detail' => $detail, 'created_at' => now(),
        ]);
    }

    public function activity(int $yearId, int $limit = 50)
    {
        return DB::table('sm_grade_activity as a')->leftJoin('users as u', 'u.id', '=', 'a.user_id')
            ->where('a.school_year_id', $yearId)->orderByDesc('a.id')->limit($limit)
            ->get(['a.*', 'u.name as user_name']);
    }

    public function classesSubjects()
    {
        return DB::table('sm_classes')->orderBy('grade')->orderBy('name')->get(['id', 'name', 'grade']);
    }

    public function subjects()
    {
        return DB::table('sm_subjects')->orderBy('sort_order')->get(['id', 'name', 'code']);
    }
}
