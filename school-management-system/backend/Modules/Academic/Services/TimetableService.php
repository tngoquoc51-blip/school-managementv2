<?php

namespace Modules\Academic\Services;

use Modules\Academic\Models\ClassRoom;
use Modules\Academic\Repositories\TimetableRepository;

class TimetableService
{
    public function __construct(private TimetableRepository $repo) {}

    public function forClass(int $classId, ?string $year = null, ?int $semester = null): array
    {
        $year = $year ?: '2025-2026';
        $semester = $semester ?: 1;

        $class = ClassRoom::find($classId);
        $slots = $this->repo->byClass($classId, $year, $semester);

        // grid[0..5] = Thứ 2 .. Thứ 7 | period 1..5
        $grid = [];
        for ($d = 0; $d < 6; $d++) {
            $grid[$d] = [];
            for ($p = 1; $p <= 5; $p++) {
                $grid[$d][$p] = null;
            }
        }

        foreach ($slots as $s) {
            $dayIdx = (int) $s->day_of_week - 1; // 1 → 0
            if ($dayIdx < 0 || $dayIdx > 5) {
                continue;
            }

            $grid[$dayIdx][(int) $s->period] = [
                'id'         => $s->id,
                'subject'    => $s->subject?->name ?? '',
                'subject_id' => $s->subject_id,
                'color'      => $s->subject?->color ?? 'sky',
                'teacher'    => $s->teacher_name,
                'room'       => $s->room,
            ];
        }

        return [
            'class' => [
                'id'            => $class?->id,
                'name'          => $class?->name ?? '',
                'academic_year' => $year,
                'semester'      => $semester,
            ],
            'grid'  => $grid,
            'slots' => $slots,
        ];
    }

    public function forStudent(int $userId, ?string $year = null, ?int $semester = null): array
    {
        $year = $year ?: '2025-2026';
        $classId = $this->repo->classIdOfStudent($userId, $year);

        if (!$classId) {
            return [
                'class'   => null,
                'grid'    => new \stdClass(),
                'message' => 'Học sinh chưa được xếp lớp',
            ];
        }

        return $this->forClass($classId, $year, $semester);
    }

    public function upsert(array $data)
    {
        return $this->repo->upsertSlot($data);
    }

    public function destroy(int $id): void
    {
        $this->repo->deleteSlot($id);
    }
}
