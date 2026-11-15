<?php

namespace Modules\Catalog\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Modules\Catalog\Models\CatalogGroup;
use Modules\Catalog\Models\CatalogItem;
use Modules\Catalog\Repositories\ItemRepository;

class ItemService extends CatalogService
{
    protected string $entity = 'item';

    public function __construct(ItemRepository $repository, AuditService $audit)
    {
        parent::__construct($repository, $audit);
    }

    protected function exportColumns(): array
    {
        return [
            'Mã' => 'code',
            'Tên' => 'name',
            'Tên viết tắt' => 'short_name',
            'Giá trị' => 'value',
            'Mô tả' => 'description',
            'Thứ tự' => 'sort_order',
            'Trạng thái' => fn (Model $m) => $this->yesNo($m),
        ];
    }

    /**
     * Nhập hàng loạt từ file (đã parse ở frontend). Báo cáo từng dòng lỗi thay vì dừng cả lô.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{created:int, updated:int, skipped:int, errors: array<int, array{row:int, message:string}>}
     */
    public function import(CatalogGroup $group, array $rows, string $mode): array
    {
        $summary = ['created' => 0, 'updated' => 0, 'skipped' => 0, 'errors' => []];
        $actor = $this->audit->actorId();
        $nextSort = (int) CatalogItem::where('group_id', $group->id)->max('sort_order');

        DB::transaction(function () use ($group, $rows, $mode, $actor, &$summary, &$nextSort) {
            foreach ($rows as $index => $row) {
                $line = $index + 1;
                $row = [
                    'code' => strtoupper(trim((string) ($row['code'] ?? ''))),
                    'name' => trim((string) ($row['name'] ?? '')),
                    'short_name' => trim((string) ($row['short_name'] ?? '')) ?: null,
                    'value' => trim((string) ($row['value'] ?? '')) ?: null,
                    'description' => trim((string) ($row['description'] ?? '')) ?: null,
                ];

                $v = Validator::make($row, [
                    'code' => ['required', 'max:50', 'regex:/^[A-Z0-9_\-\.]+$/'],
                    'name' => ['required', 'max:191'],
                    'short_name' => ['nullable', 'max:50'],
                    'value' => ['nullable', 'max:100'],
                    'description' => ['nullable', 'max:500'],
                ], [
                    'code.required' => 'Thiếu mã',
                    'code.regex' => 'Mã chỉ gồm chữ HOA, số, gạch dưới/ngang',
                    'code.max' => 'Mã tối đa 50 ký tự',
                    'name.required' => 'Thiếu tên',
                    'name.max' => 'Tên tối đa 191 ký tự',
                ]);

                if ($v->fails()) {
                    $summary['errors'][] = ['row' => $line, 'message' => $v->errors()->first()];
                    continue;
                }

                $existing = CatalogItem::where('group_id', $group->id)->where('code', $row['code'])->first();

                if ($existing) {
                    if ($mode === 'update') {
                        $existing->fill(array_filter($row, fn ($x, $k) => $k !== 'code' && $x !== null, ARRAY_FILTER_USE_BOTH) + ['updated_by' => $actor])->save();
                        $summary['updated']++;
                    } else {
                        $summary['skipped']++;
                    }
                    continue;
                }

                CatalogItem::create($row + ['group_id' => $group->id, 'sort_order' => ++$nextSort, 'is_active' => true, 'created_by' => $actor, 'updated_by' => $actor]);
                $summary['created']++;
            }
        });

        if ($summary['created'] || $summary['updated']) {
            $this->audit->record('group', $group->id, $group->label(), 'import', null, [
                'created' => $summary['created'], 'updated' => $summary['updated'], 'skipped' => $summary['skipped'], 'errors' => count($summary['errors']),
            ]);
        }

        return $summary;
    }
}
