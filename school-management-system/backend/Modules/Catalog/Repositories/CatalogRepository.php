<?php

namespace Modules\Catalog\Repositories;

use App\Core\Repositories\BaseRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/** Repository chung: tìm kiếm, lọc, sắp xếp theo whitelist (không bao giờ đưa input thẳng vào orderBy). */
abstract class CatalogRepository extends BaseRepository
{
    /** Cột tìm kiếm bằng LIKE. */
    protected array $searchable = ['code', 'name'];

    /** key trên query string => cột, lọc bằng dấu =. */
    protected array $filterable = [];

    protected array $sortable = ['id', 'code', 'name', 'sort_order', 'is_active', 'created_at', 'updated_at'];

    protected string $defaultSort = 'sort_order';

    public function query(array $filters = []): Builder
    {
        $q = $this->model->newQuery();
        $this->scope($q, $filters);

        $term = trim((string) ($filters['search'] ?? ''));
        if ($term !== '') {
            $like = '%' . addcslashes($term, '%_\\') . '%';
            $q->where(function (Builder $w) use ($like) {
                foreach ($this->searchable as $column) {
                    $w->orWhere($column, 'like', $like);
                }
            });
        }

        $status = $filters['status'] ?? null;
        if (in_array($status, ['active', 'inactive'], true)) {
            $q->where('is_active', $status === 'active');
        }

        foreach ($this->filterable as $key => $column) {
            if (isset($filters[$key]) && $filters[$key] !== '') {
                $q->where($column, $filters[$key]);
            }
        }

        $sort = in_array($filters['sort'] ?? null, $this->sortable, true) ? $filters['sort'] : $this->defaultSort;
        $dir = strtolower((string) ($filters['dir'] ?? 'asc')) === 'desc' ? 'desc' : 'asc';
        $q->orderBy($sort, $dir);
        if ($sort !== 'id') {
            $q->orderBy('id');
        }

        return $q;
    }

    public function search(array $filters, int $perPage = 15): LengthAwarePaginator
    {
        return $this->query($filters)->paginate($perPage);
    }

    /** Hook để repo con eager-load / thêm điều kiện cố định. */
    protected function scope(Builder $q, array $filters): void {}
}
