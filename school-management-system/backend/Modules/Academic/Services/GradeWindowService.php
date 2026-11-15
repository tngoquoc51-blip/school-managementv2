<?php

namespace Modules\Academic\Services;

use Modules\Academic\Exceptions\ClassException;
use Modules\Academic\Repositories\GradeWindowRepository;

class GradeWindowService
{
    public function __construct(private GradeWindowRepository $repo) {}

    private function format(?object $w, int $yearId, int $semester): array
    {
        return [
            'school_year_id' => $yearId, 'semester' => $semester,
            'status' => $w->status ?? 'closed',
            'opened_at' => $w->opened_at ?? null, 'closes_at' => $w->closes_at ?? null,
            'closed_at' => $w->closed_at ?? null, 'note' => $w->note ?? null,
            'exceptions' => $w ? $this->repo->exceptions($w->id)->values()->all() : [],
        ];
    }

    public function overview(int $yearId): array
    {
        $out = [];
        foreach ([1, 2] as $sem) {
            $w = $this->repo->find($yearId, $sem);
            $out[] = $this->format($w, $yearId, $sem);
        }
        return [
            'windows' => $out,
            'classes' => $this->repo->classesSubjects(),
            'subjects' => $this->repo->subjects(),
        ];
    }

    public function open(int $yearId, int $semester, ?string $closesAt, ?string $note, ?int $uid): array
    {
        $this->repo->upsert($yearId, $semester, [
            'status' => 'open', 'opened_at' => now(), 'opened_by' => $uid,
            'closes_at' => $closesAt, 'closed_at' => null, 'closed_by' => null, 'note' => $note,
        ]);
        $this->repo->log($yearId, $semester, $uid, 'open_window', "Mở nhập điểm học kỳ $semester" . ($closesAt ? " (tự đóng lúc $closesAt)" : ''));
        return $this->format($this->repo->find($yearId, $semester), $yearId, $semester);
    }

    public function close(int $yearId, int $semester, ?string $note, ?int $uid): array
    {
        $this->repo->upsert($yearId, $semester, [
            'status' => 'closed', 'closed_at' => now(), 'closed_by' => $uid, 'note' => $note,
        ]);
        $this->repo->log($yearId, $semester, $uid, 'close_window', "Khóa nhập điểm học kỳ $semester");
        return $this->format($this->repo->find($yearId, $semester), $yearId, $semester);
    }

    public function addException(int $yearId, int $semester, int $classId, ?int $subjectId, ?string $expiresAt, ?int $uid): array
    {
        $w = $this->repo->find($yearId, $semester);
        $id = $w ? $w->id : $this->repo->upsert($yearId, $semester, ['status' => 'closed']);
        $this->repo->addException($id, $classId, $subjectId, $expiresAt, $uid);
        $this->repo->log($yearId, $semester, $uid, 'add_exception', "Mở ngoại lệ nhập điểm cho lớp #$classId" . ($subjectId ? ", môn #$subjectId" : ' (mọi môn)'));
        return $this->format($this->repo->find($yearId, $semester), $yearId, $semester);
    }

    public function removeException(int $yearId, int $semester, int $exceptionId, ?int $uid): array
    {
        $this->repo->removeException($exceptionId);
        $this->repo->log($yearId, $semester, $uid, 'remove_exception', "Gỡ ngoại lệ #$exceptionId");
        return $this->format($this->repo->find($yearId, $semester), $yearId, $semester);
    }

    public function activity(int $yearId): array
    {
        return $this->repo->activity($yearId)->values()->all();
    }

    /** Dùng cho phía giáo viên: chặn ở tầng backend, không chỉ ẩn ở giao diện. */
    public function assertCanEnter(int $yearId, int $semester, int $classId, int $subjectId): void
    {
        if (! $this->repo->isOpenFor($yearId, $semester, $classId, $subjectId)) {
            throw new ClassException('Kỳ nhập điểm hiện đang đóng. Vui lòng liên hệ Giáo vụ/Quản trị để được mở.', 423);
        }
    }
}
