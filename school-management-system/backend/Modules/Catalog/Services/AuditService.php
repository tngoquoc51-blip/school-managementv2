<?php

namespace Modules\Catalog\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Exceptions\CatalogException;
use Modules\Catalog\Models\AuditLog;
use Modules\Catalog\Models\CatalogGroup;
use Modules\Catalog\Models\CatalogItem;
use Modules\Catalog\Models\Department;
use Modules\Catalog\Models\Room;
use Modules\Catalog\Models\Subject;

/** Ghi / đọc nhật ký thay đổi và khôi phục bản ghi đã xóa. */
class AuditService
{
    public const MODELS = [
        'group' => CatalogGroup::class,
        'item' => CatalogItem::class,
        'subject' => Subject::class,
        'department' => Department::class,
        'room' => Room::class,
    ];

    public function actorId(): ?int
    {
        $id = Auth::id();
        return $id ? (int) $id : null;
    }

    public function record(string $entity, int $entityId, string $label, string $action, ?array $before, ?array $after): AuditLog
    {
        $user = Auth::user();

        return AuditLog::create([
            'entity' => $entity,
            'entity_id' => $entityId,
            'entity_label' => mb_substr($label, 0, 255),
            'action' => $action,
            'before' => $before,
            'after' => $after,
            'user_id' => $this->actorId(),
            'user_name' => $user ? mb_substr((string) ($user->name ?? $user->username ?? $user->email ?? ''), 0, 100) : null,
            'ip' => request()?->ip(),
        ]);
    }

    public function paginate(array $f, int $perPage = 20): LengthAwarePaginator
    {
        $q = AuditLog::query()->orderByDesc('id');

        if (! empty($f['entity'])) {
            $q->where('entity', $f['entity']);
        }
        if (! empty($f['action'])) {
            $q->where('action', $f['action']);
        }
        if (! empty($f['search'])) {
            $like = '%' . addcslashes(trim((string) $f['search']), '%_\\') . '%';
            $q->where(fn ($w) => $w->where('entity_label', 'like', $like)->orWhere('user_name', 'like', $like));
        }
        if (! empty($f['from'])) {
            $q->whereDate('created_at', '>=', $f['from']);
        }
        if (! empty($f['to'])) {
            $q->whereDate('created_at', '<=', $f['to']);
        }

        return $q->paginate($perPage);
    }

    /** Khôi phục bản ghi từ một dòng nhật ký 'delete'. */
    public function restore(int $logId): Model
    {
        $log = AuditLog::findOrFail($logId);

        if ($log->action !== 'delete' || empty($log->before)) {
            throw new CatalogException('Chỉ khôi phục được thao tác xóa.', 422);
        }
        if ($log->restored_at) {
            throw new CatalogException('Bản ghi này đã được khôi phục trước đó.', 409);
        }

        $class = self::MODELS[$log->entity] ?? null;
        if (! $class) {
            throw new CatalogException('Loại dữ liệu không hỗ trợ khôi phục.', 422);
        }

        $data = $log->before;
        $children = Arr::pull($data, 'items');
        unset($data['created_at'], $data['updated_at']);

        if ($class::query()->whereKey($data['id'])->exists()) {
            throw new CatalogException('Bản ghi đã tồn tại, không cần khôi phục.', 409);
        }

        $dup = $class::query()->where('code', $data['code']);
        if ($log->entity === 'item') {
            $dup->where('group_id', $data['group_id']);
            if (! CatalogGroup::query()->whereKey($data['group_id'])->exists()) {
                throw new CatalogException('Nhóm chứa mục này đã bị xóa — hãy khôi phục nhóm trước.', 409);
            }
        }
        if ($dup->exists()) {
            throw new CatalogException('Mã "' . $data['code'] . '" đã được dùng bởi bản ghi khác.', 409);
        }
        if ($log->entity === 'subject' && ! empty($data['department_id'])
            && ! Department::query()->whereKey($data['department_id'])->exists()) {
            $data['department_id'] = null; // tổ đã bị xóa → khôi phục môn nhưng bỏ liên kết
        }

        return DB::transaction(function () use ($class, $data, $children, $log) {
            $model = new $class();
            $model->forceFill($data)->save();

            foreach ($children ?? [] as $child) {
                unset($child['created_at'], $child['updated_at']);
                (new CatalogItem())->forceFill($child)->save();
            }

            $log->forceFill(['restored_at' => now()])->save();
            $this->record($log->entity, (int) $model->getKey(), $model->label(), 'restore', null, ['restored_from_log' => $log->id]);

            return $model;
        });
    }
}
