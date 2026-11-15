<?php

namespace App\Http\Controllers\Api\Bgh;

use App\Services\Plans\PlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlanTaskController extends BasePlanController
{
    public function __construct(private PlanService $svc) {}

    private function rules(bool $partial): array
    {
        $req = $partial ? ['sometimes', 'required'] : ['required'];

        return [
            'title'         => array_merge($req, ['string', 'max:255']),
            'description'   => ['nullable', 'string', 'max:3000'],
            'assignee_name' => ['nullable', 'string', 'max:120'],
            'start_date'    => ['nullable', 'date'],
            'due_date'      => ['nullable', 'date', 'after_or_equal:start_date'],
            'status'        => ['sometimes', Rule::in(array_keys(config('school_plans.task_statuses')))],
            'priority'      => ['sometimes', Rule::in(array_keys(config('school_plans.priorities')))],
            'weight'        => ['sometimes', 'integer', 'between:1,10'],
        ];
    }

    /** POST plans/{id}/tasks */
    public function store(Request $r, int $id): JsonResponse
    {
        $v = $r->validate($this->rules(false), $this->messages());

        return $this->run(fn () => $this->ok(['id' => $this->svc->storeTask($id, $v, $this->actor($r))], 'Đã thêm nhiệm vụ.', [], 201));
    }

    /** PUT plans/tasks/{task} */
    public function update(Request $r, int $task): JsonResponse
    {
        $v = $r->validate($this->rules(true), $this->messages());

        return $this->run(fn () => $this->ok($this->svc->updateTask($task, $v, $this->actor($r)), 'Đã cập nhật nhiệm vụ.'));
    }

    /** DELETE plans/tasks/{task} */
    public function destroy(Request $r, int $task): JsonResponse
    {
        return $this->run(fn () => $this->ok($this->svc->destroyTask($task, $this->actor($r)), 'Đã xóa nhiệm vụ.'));
    }
}
