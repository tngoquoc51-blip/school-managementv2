<?php

namespace Modules\Academic\Repositories;

use App\Core\Repositories\BaseRepository;
use Modules\Academic\Models\ClassStudent;
use Modules\Academic\Models\TimetableSlot;

class TimetableRepository extends BaseRepository
{
    public function __construct(TimetableSlot $model)
    {
        parent::__construct($model);
    }

    public function byClass(int $classId, string $year = '2025-2026', int $semester = 1)
    {
        return TimetableSlot::query()
            ->with('subject:id,name,color,code')
            ->where('class_id', $classId)
            ->where('academic_year', $year)
            ->where('semester', $semester)
            ->orderBy('day_of_week')
            ->orderBy('period')
            ->get();
    }

    public function classIdOfStudent(int $userId, string $year = '2025-2026'): ?int
    {
        $row = ClassStudent::query()
            ->where('user_id', $userId)
            ->where('academic_year', $year)
            ->first();

        return $row?->class_id;
    }

    public function upsertSlot(array $data): TimetableSlot
    {
        return TimetableSlot::updateOrCreate(
            [
                'class_id'       => $data['class_id'],
                'academic_year'  => $data['academic_year'] ?? '2025-2026',
                'semester'       => $data['semester'] ?? 1,
                'day_of_week'    => $data['day_of_week'],
                'period'         => $data['period'],
            ],
            [
                'subject_id'   => $data['subject_id'],
                'teacher_name' => $data['teacher_name'],
                'teacher_id'   => $data['teacher_id'] ?? null,
                'room'         => $data['room'] ?? '',
                'note'         => $data['note'] ?? null,
            ]
        );
    }

    public function deleteSlot(int $id): bool
    {
        $slot = TimetableSlot::findOrFail($id);

        return (bool) $slot->delete();
    }
}
