<?php

namespace Modules\Catalog\Services;

use App\Core\Services\BaseService;
use Generator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Exceptions\CatalogException;
use Modules\Catalog\Models\AuditLog;
use Modules\Catalog\Repositories\CatalogRepository;

/**
 * Nghiệp vụ chung cho mọi danh mục: CRUD + nhật ký, bật/tắt, thao tác hàng loạt, xuất CSV.
 * Lớp con chỉ khai báo $entity, cột xuất và các ràng buộc xóa riêng.
 */
abstract class CatalogService extends BaseService
{
    /** Khóa thực thể trong nhật ký (khớp AuditService::MODELS). */
    protected string $entity;

    public function __construct(CatalogRepository $repository, protected AuditService $audit)
    {
        parent::__construct($repository);
    }

    /** @return array<string, string|callable> tiêu đề cột => tên thuộc tính | closure(Model) */
    abstract protected function exportColumns(): array;

    public function search(array $filters, int $perPage = 15)
    {
        return $this->repository->search($filters, $perPage);
    }

    public function store(array $data): Model
    {
        return DB::transaction(function () use ($data) {
            $actor = $this->audit->actorId();
            $model = $this->repository->create($data + ['created_by' => $actor, 'updated_by' => $actor]);
            $model = $this->repository->find($model->getKey());
            $this->audit->record($this->entity, (int) $model->getKey(), $model->label(), 'create', null, $this->snapshot($model));

            return $model;
        });
    }

    public function update(int $id, array $data): Model
    {
        return DB::transaction(function () use ($id, $data) {
            $model = $this->repository->find($id);

            if ($model->getAttribute('is_system')) {
                unset($data['code']); // mã của mục hệ thống là bất biến
            }

            $before = $this->snapshot($model);
            $model->fill($data + ['updated_by' => $this->audit->actorId()])->save();
            $model = $this->repository->find($id);
            $this->logDiff($model, $before);

            return $model;
        });
    }

    public function toggle(int $id): Model
    {
        return $this->setActive($id, ! $this->repository->find($id)->getAttribute('is_active'));
    }

    public function setActive(int $id, bool $active): Model
    {
        return DB::transaction(function () use ($id, $active) {
            $model = $this->repository->find($id);
            $before = $this->snapshot($model);
            $model->forceFill(['is_active' => $active, 'updated_by' => $this->audit->actorId()])->save();
            $this->logDiff($model, $before);

            return $this->repository->find($id);
        });
    }

    public function destroy(int $id): bool
    {
        return (bool) $this->remove($id);
    }

    public function remove(int $id, bool $force = false): AuditLog
    {
        return DB::transaction(function () use ($id, $force) {
            $model = $this->repository->find($id);
            $this->assertDeletable($model, $force);

            $snapshot = $this->deleteSnapshot($model);
            $label = $model->label();
            $model->delete();

            return $this->audit->record($this->entity, $id, $label, 'delete', $snapshot, null);
        });
    }

    /** Thao tác hàng loạt; mục không thực hiện được sẽ được báo lại chứ không làm hỏng cả lô. */
    public function bulk(string $action, array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $done = 0;
        $skipped = [];

        foreach ($ids as $id) {
            try {
                match ($action) {
                    'activate' => $this->setActive($id, true),
                    'deactivate' => $this->setActive($id, false),
                    'delete' => $this->remove($id),
                };
                $done++;
            } catch (ModelNotFoundException) {
                $skipped[] = ['id' => $id, 'reason' => 'Không tìm thấy bản ghi'];
            } catch (CatalogException $e) {
                $skipped[] = ['id' => $id, 'reason' => $e->getMessage()];
            }
        }

        return ['action' => $action, 'processed' => $done, 'skipped' => $skipped];
    }

    public function exportHeaders(): array
    {
        return array_keys($this->exportColumns());
    }

    public function exportRows(array $filters): Generator
    {
        $columns = $this->exportColumns();

        foreach ($this->repository->query($filters)->lazy(500) as $model) {
            yield array_map(
                fn ($source) => is_callable($source) ? $source($model) : $model->getAttribute($source),
                array_values($columns)
            );
        }
    }

    // ---- hook cho lớp con -------------------------------------------------

    protected function assertDeletable(Model $model, bool $force): void
    {
        if ($model->getAttribute('is_system')) {
            throw new CatalogException('"' . $model->label() . '" là mục hệ thống nên không thể xóa. Hãy chuyển sang "Ngừng hoạt động".', 422);
        }
    }

    protected function deleteSnapshot(Model $model): array
    {
        return $this->snapshot($model);
    }

    // ---- tiện ích ---------------------------------------------------------

    /** Ảnh chụp thuộc tính (không có quan hệ / cột theo dõi) dùng cho nhật ký + khôi phục. */
    protected function snapshot(Model $model): array
    {
        return Arr::except($model->attributesToArray(), ['created_at', 'updated_at', 'created_by', 'updated_by']);
    }

    protected function logDiff(Model $model, array $before): void
    {
        $after = $this->snapshot($model);
        $changedBefore = [];
        $changedAfter = [];

        foreach ($after as $key => $value) {
            if (json_encode($before[$key] ?? null) !== json_encode($value)) {
                $changedBefore[$key] = $before[$key] ?? null;
                $changedAfter[$key] = $value;
            }
        }

        if ($changedAfter) {
            $this->audit->record($this->entity, (int) $model->getKey(), $model->label(), 'update', $changedBefore, $changedAfter);
        }
    }

    protected function yesNo(Model $m): string
    {
        return $m->getAttribute('is_active') ? 'Đang dùng' : 'Ngừng';
    }
}
