<?php

namespace App\Http\Controllers\Api\Bgh;

use App\Services\Plans\PlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlanController extends BasePlanController
{
    public function __construct(private PlanService $svc) {}

    private function rules(bool $partial = false): array
    {
        $c = fn (string $k) => array_keys(config("school_plans.$k"));
        $req = $partial ? ['sometimes', 'required'] : ['required'];
        return [
            'title'       => array_merge($req, ['string', 'max:255']),
            'level'       => ['sometimes', Rule::in($c('levels'))],
            'category'    => ['sometimes', Rule::in($c('categories'))],
            'priority'    => ['sometimes', Rule::in($c('priorities'))],
            'school_year' => ['nullable', 'string', 'max:9'],
            'term'        => ['nullable', Rule::in(['HK1', 'HK2', 'CN'])],
            'parent_id'   => ['nullable', 'integer', 'exists:school_plans,id'],
            'owner_name'  => ['nullable', 'string', 'max:120'],
            'department'  => ['nullable', 'string', 'max:120'],
            'start_date'  => ['nullable', 'date'],
            'end_date'    => ['nullable', 'date', 'after_or_equal:start_date'],
            'budget'      => ['nullable', 'integer', 'min:0'],
            'spent'       => ['nullable', 'integer', 'min:0'],
            'progress'    => ['nullable', 'integer', 'between:0,100'],
            'objectives'  => ['nullable', 'string', 'max:5000'],
            'content'     => ['nullable', 'string', 'max:30000'],
            'result'      => ['nullable', 'string', 'max:5000'],
        ];
    }

    /** GET plans */
    public function index(Request $r): JsonResponse
    {
        $res = $this->svc->list($r->only(['q', 'status', 'level', 'category', 'school_year', 'priority', 'owner', 'view', 'parent_id', 'sort', 'dir', 'page', 'per_page']) + ['all' => $r->boolean('all'), 'root' => $r->boolean('root')], $r->user()?->getAuthIdentifier());

        return $this->ok($res['rows'], 'OK', ['meta' => $res['meta']]);
    }

    /** GET plans/stats */
    public function stats(Request $r): JsonResponse
    {
        return $this->ok($this->svc->dashboard($r->query('school_year')));
    }

    /** GET plans/options */
    public function options(): JsonResponse
    {
        return $this->ok($this->svc->options());
    }

    /** GET plans/{id} */
    public function show(int $id): JsonResponse
    {
        $d = $this->svc->show($id);

        return $d ? $this->ok($d) : response()->json(['success' => false, 'message' => 'Không tìm thấy kế hoạch.', 'data' => null], 404);
    }

    /** POST plans */
    public function store(Request $r): JsonResponse
    {
        $v = $r->validate($this->rules(), $this->messages());

        return $this->run(fn () => $this->ok(['id' => $this->svc->store($v, $this->actor($r))], 'Đã tạo kế hoạch.', [], 201));
    }

    /** PUT plans/{id} */
    public function update(Request $r, int $id): JsonResponse
    {
        $v = $r->validate($this->rules(true), $this->messages());

        return $this->run(function () use ($r, $id, $v) {
            $this->svc->update($id, $v, $this->actor($r));
            return $this->ok(null, 'Đã lưu thay đổi.');
        });
    }

    /** DELETE plans/{id} */
    public function destroy(Request $r, int $id): JsonResponse
    {
        return $this->run(function () use ($r, $id) {
            $this->svc->destroy($id, $this->actor($r));
            return $this->ok(null, 'Đã xóa kế hoạch.');
        });
    }

    /** POST plans/{id}/transition  {to, note?, force?} */
    public function transition(Request $r, int $id): JsonResponse
    {
        $v = $r->validate([
            'to' => ['required', Rule::in(array_keys(config('school_plans.statuses')))],
            'note' => ['nullable', 'string', 'max:500'], 'force' => ['nullable', 'boolean'],
        ], $this->messages());

        return $this->run(fn () => $this->ok($this->svc->transition($id, $v['to'], $v['note'] ?? null, (bool) ($v['force'] ?? false), $this->actor($r)), 'Đã cập nhật trạng thái.'));
    }

    /** POST plans/{id}/duplicate  {start_date, title?} */
    public function duplicate(Request $r, int $id): JsonResponse
    {
        $v = $r->validate(['start_date' => ['required', 'date'], 'title' => ['nullable', 'string', 'max:255']], $this->messages());

        return $this->run(fn () => $this->ok(['id' => $this->svc->duplicate($id, $v['start_date'], $v['title'] ?? null, $this->actor($r))], 'Đã nhân bản kế hoạch.', [], 201));
    }

    /** POST plans/from-template  {template, start_date, title?, owner_name?, school_year?} */
    public function fromTemplate(Request $r): JsonResponse
    {
        $v = $r->validate([
            'template' => ['required', 'string'], 'start_date' => ['required', 'date'], 'title' => ['nullable', 'string', 'max:255'],
            'owner_name' => ['nullable', 'string', 'max:120'], 'school_year' => ['nullable', 'string', 'max:9'],
        ], $this->messages());

        return $this->run(fn () => $this->ok(['id' => $this->svc->fromTemplate($v['template'], $v, $this->actor($r))], 'Đã tạo kế hoạch từ mẫu.', [], 201));
    }
}
