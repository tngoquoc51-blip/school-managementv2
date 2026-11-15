<?php

namespace Modules\Catalog\Services;

use Illuminate\Database\Eloquent\Model;
use Modules\Catalog\Repositories\RoomRepository;

class RoomService extends CatalogService
{
    public const TYPES = [
        'classroom' => 'Phòng học', 'lab_physics' => 'PTN Vật lí', 'lab_chemistry' => 'PTN Hóa học', 'lab_biology' => 'PTN Sinh học',
        'computer' => 'Phòng Tin học', 'music' => 'Phòng Âm nhạc', 'art' => 'Phòng Mĩ thuật', 'library' => 'Thư viện',
        'hall' => 'Hội trường', 'gym' => 'Nhà thể chất', 'other' => 'Khác',
    ];
    public const STATUSES = ['available' => 'Sẵn sàng', 'maintenance' => 'Đang bảo trì', 'unavailable' => 'Ngừng sử dụng'];

    protected string $entity = 'room';

    public function __construct(RoomRepository $repository, AuditService $audit)
    {
        parent::__construct($repository, $audit);
    }

    protected function exportColumns(): array
    {
        return [
            'Mã phòng' => 'code',
            'Tên phòng' => 'name',
            'Loại phòng' => fn (Model $m) => self::TYPES[$m->room_type] ?? $m->room_type,
            'Tòa nhà' => 'building',
            'Tầng' => 'floor',
            'Sức chứa' => 'capacity',
            'Trang thiết bị' => 'facilities',
            'Tình trạng' => fn (Model $m) => self::STATUSES[$m->status] ?? $m->status,
            'Trạng thái' => fn (Model $m) => $this->yesNo($m),
        ];
    }
}
