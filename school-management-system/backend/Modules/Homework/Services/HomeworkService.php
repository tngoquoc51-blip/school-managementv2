<?php

namespace Modules\Homework\Services;

use Carbon\Carbon;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class HomeworkService
{
    /** Trạng thái tính theo từng học sinh: todo | overdue | submitted | graded | returned */
    private const STATUS_SQL = "CASE WHEN sub.status = 'graded' THEN 'graded' WHEN sub.status = 'returned' THEN 'returned' WHEN sub.id IS NOT NULL THEN 'submitted' WHEN h.due_at < NOW() THEN 'overdue' ELSE 'todo' END";

    private function from(array $st)
    {
        return DB::table('sm_homework as h')
            ->join('sm_class_subjects as cs', 'cs.id', '=', 'h.class_subject_id')
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->join('sm_teachers as t', 't.id', '=', 'cs.teacher_id')
            ->leftJoin('sm_homework_submissions as sub', function ($j) use ($st) {
                $j->on('sub.homework_id', '=', 'h.id')->where('sub.student_id', '=', $st['id']);
            })
            ->leftJoin('sm_homework_student_state as ps', function ($j) use ($st) {
                $j->on('ps.homework_id', '=', 'h.id')->where('ps.student_id', '=', $st['id']);
            })
            ->where('cs.class_id', $st['class_id'])
            ->where('h.status', 'published');
    }

    private function cols(): array
    {
        return [
            'h.id', 'h.title', 'h.type', 'h.priority', 'h.max_score', 'h.assigned_at', 'h.due_at', 'h.allow_late',
            's.id as subject_id', 's.name as subject', 't.full_name as teacher',
            'sub.is_late', 'sub.score', 'sub.submitted_at', 'ps.starred', 'ps.progress',
            DB::raw(self::STATUS_SQL . ' as status'),
            DB::raw('(h.due_at < NOW()) as past_due'),
        ];
    }

    private function item(object $r): array
    {
        return [
            'id' => (int) $r->id, 'title' => $r->title, 'type' => $r->type, 'priority' => $r->priority,
            'max_score' => (float) $r->max_score, 'assigned_at' => $r->assigned_at, 'due_at' => $r->due_at,
            'allow_late' => (bool) $r->allow_late, 'subject_id' => (int) $r->subject_id, 'subject' => $r->subject,
            'teacher' => $r->teacher, 'status' => $r->status, 'is_late' => (bool) $r->is_late,
            'score' => $r->score === null ? null : (float) $r->score, 'submitted_at' => $r->submitted_at,
            'starred' => (bool) $r->starred, 'progress' => (int) ($r->progress ?? 0),
        ];
    }

    private function visible(array $st, int $id): bool
    {
        return $this->from($st)->where('h.id', $id)->exists();
    }

    public function subjects(array $st): array
    {
        return DB::table('sm_class_subjects as cs')
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->where('cs.class_id', $st['class_id'])->orderBy('s.sort_order')
            ->get(['s.id', 's.name'])->map(fn ($r) => ['id' => (int) $r->id, 'name' => $r->name])->all();
    }

    public function list(array $st, array $f, int $page, int $per): array
    {
        $q = $this->from($st)->select($this->cols());

        if (!empty($f['status']) && in_array($f['status'], ['todo', 'overdue', 'submitted', 'graded', 'returned'], true)) {
            $q->whereRaw('(' . self::STATUS_SQL . ') = ?', [$f['status']]);
        }
        if (!empty($f['subject_id'])) $q->where('s.id', (int) $f['subject_id']);
        if (!empty($f['starred'])) $q->where('ps.starred', 1);
        if (!empty($f['q'])) {
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], trim($f['q'])) . '%';
            $q->where(function ($w) use ($like) {
                $w->where('h.title', 'like', $like)->orWhere('s.name', 'like', $like);
            });
        }

        $sort = $f['sort'] ?? 'due';
        if ($sort === 'newest') {
            $q->orderByDesc('h.assigned_at');
        } elseif ($sort === 'subject') {
            $q->orderBy('s.sort_order')->orderBy('h.due_at');
        } else {
            // Việc cần làm lên trước (gấp nhất trước), việc đã xong xuống sau (mới nhất trước)
            $q->orderByRaw("FIELD(" . self::STATUS_SQL . ", 'returned', 'overdue', 'todo', 'submitted', 'graded')")
              ->orderByRaw("CASE WHEN (" . self::STATUS_SQL . ") IN ('submitted','graded') THEN -UNIX_TIMESTAMP(h.due_at) ELSE UNIX_TIMESTAMP(h.due_at) END");
        }

        $p = $q->paginate($per, ['*'], 'page', $page);
        return [
            'items' => collect($p->items())->map(fn ($r) => $this->item($r))->all(),
            'meta' => ['current_page' => $p->currentPage(), 'last_page' => $p->lastPage(), 'total' => $p->total(), 'per_page' => $p->perPage()],
        ];
    }

    public function summary(array $st): array
    {
        $counts = ['todo' => 0, 'overdue' => 0, 'submitted' => 0, 'graded' => 0, 'returned' => 0];
        $rows = $this->from($st)->select(DB::raw(self::STATUS_SQL . ' as st'), DB::raw('COUNT(*) as n'))->groupBy('st')->get();
        foreach ($rows as $r) $counts[$r->st] = (int) $r->n;
        $counts['total'] = array_sum($counts);

        $avg = $this->from($st)->where('sub.status', 'graded')->selectRaw('AVG(sub.score / h.max_score * 10) as v')->value('v');
        $sub = $this->from($st)->whereNotNull('sub.id')->selectRaw('COUNT(*) as n, SUM(sub.is_late = 0) as ontime')->first();
        $soon = $this->from($st)->whereNull('sub.id')->whereRaw('h.due_at >= NOW()')->whereRaw('h.due_at < NOW() + INTERVAL 48 HOUR')->count();

        $by = $this->from($st)
            ->select('s.id as subject_id', 's.name as subject', DB::raw('COUNT(*) as total'), DB::raw("SUM(sub.status IN ('submitted','graded')) as done"))
            ->groupBy('s.id', 's.name', 's.sort_order')->orderBy('s.sort_order')->get()
            ->map(fn ($r) => ['subject_id' => (int) $r->subject_id, 'subject' => $r->subject, 'total' => (int) $r->total, 'done' => (int) $r->done])->all();

        $alerts = [];
        $rowsA = $this->from($st)->select($this->cols())
            ->where(function ($w) {
                $w->where('sub.status', 'returned')
                  ->orWhere(function ($x) { $x->where('sub.status', 'graded')->whereRaw('sub.graded_at >= NOW() - INTERVAL 7 DAY'); })
                  ->orWhere(function ($x) { $x->whereNull('sub.id')->whereRaw('h.due_at < NOW() + INTERVAL 24 HOUR'); });
            })->orderBy('h.due_at')->limit(8)->get();
        foreach ($rowsA as $r) {
            $kind = $r->status === 'returned' ? 'returned' : ($r->status === 'graded' ? 'graded' : ($r->past_due ? 'overdue' : 'soon'));
            $text = match ($kind) {
                'returned' => "Giáo viên yêu cầu làm lại: {$r->title}",
                'graded' => "Đã có điểm: {$r->title} ({$r->score}/" . (float) $r->max_score . ')',
                'overdue' => "Quá hạn nộp: {$r->title}",
                default => "Sắp đến hạn: {$r->title} (" . Carbon::parse($r->due_at)->format('H:i d/m') . ')',
            };
            $alerts[] = ['id' => "$kind-{$r->id}", 'kind' => $kind, 'text' => $text, 'homework_id' => (int) $r->id];
        }

        return [
            'class' => DB::table('sm_classes')->where('id', $st['class_id'])->value('name'),
            'counts' => $counts,
            'due_soon' => $soon,
            'avg_score' => $avg === null ? null : round((float) $avg, 1),
            'on_time_rate' => ($sub && $sub->n > 0) ? (int) round(((int) $sub->ontime) / $sub->n * 100) : null,
            'by_subject' => $by,
            'alerts' => $alerts,
        ];
    }

    public function calendar(array $st, string $month): array
    {
        $start = Carbon::createFromFormat('!Y-m-d', $month . '-01');
        $end = (clone $start)->endOfMonth();
        return $this->from($st)->select($this->cols())->whereBetween('h.due_at', [$start, $end])
            ->orderBy('h.due_at')->get()->map(fn ($r) => $this->item($r))->all();
    }

    public function detail(array $st, int $id): ?array
    {
        $r = $this->from($st)->select(array_merge($this->cols(), [
            'h.description', 'sub.id as sub_id', 'sub.content', 'sub.link_url', 'sub.attempt',
            'sub.feedback', 'sub.graded_at', 'sub.status as sub_status', 'ps.notes',
        ]))->where('h.id', $id)->first();
        if (!$r) return null;

        $files = $r->sub_id
            ? DB::table('sm_homework_files')->where('submission_id', $r->sub_id)->get(['id', 'original_name', 'size_kb'])
                ->map(fn ($f) => ['id' => (int) $f->id, 'name' => $f->original_name, 'size_kb' => (int) $f->size_kb])->all()
            : [];

        $block = null;
        if ($r->sub_status === 'graded') $block = 'Bài đã được chấm điểm nên không thể nộp lại.';
        elseif ($r->past_due && !$r->allow_late && $r->sub_status !== 'returned') $block = 'Đã quá hạn nộp bài và giáo viên không nhận nộp muộn.';

        return $this->item($r) + [
            'description' => $r->description,
            'notes' => $r->notes,
            'attachments' => DB::table('sm_homework_attachments')->where('homework_id', $id)
                ->get(['id', 'name', 'url', 'size_kb'])->map(fn ($a) => (array) $a)->all(),
            'submission' => $r->sub_id ? [
                'status' => $r->sub_status, 'content' => $r->content, 'link_url' => $r->link_url,
                'submitted_at' => $r->submitted_at, 'is_late' => (bool) $r->is_late, 'attempt' => (int) $r->attempt,
                'score' => $r->score === null ? null : (float) $r->score, 'feedback' => $r->feedback,
                'graded_at' => $r->graded_at, 'files' => $files,
            ] : null,
            'can_submit' => $block === null,
            'submit_block_reason' => $block,
            'comments_count' => DB::table('sm_homework_comments')->where('homework_id', $id)->count(),
        ];
    }

    public function submit(array $st, int $id, ?string $content, ?string $link, array $files): array
    {
        $d = $this->detail($st, $id);
        if (!$d) throw new DomainException('Không tìm thấy bài tập.');
        if (!$d['can_submit']) throw new DomainException($d['submit_block_reason']);

        return DB::transaction(function () use ($st, $id, $content, $link, $files) {
            $late = (int) DB::selectOne('SELECT (due_at < NOW()) AS late FROM sm_homework WHERE id = ?', [$id])->late;
            $old = DB::table('sm_homework_submissions')->where(['homework_id' => $id, 'student_id' => $st['id']])->first();
            $row = [
                'content' => filled($content) ? trim($content) : null, 'link_url' => filled($link) ? trim($link) : null,
                'status' => 'submitted', 'is_late' => $late, 'submitted_at' => now(), 'score' => null, 'graded_at' => null,
            ];

            if ($old) {
                DB::table('sm_homework_submissions')->where('id', $old->id)->update($row + ['attempt' => $old->attempt + 1]);
                $sid = $old->id;
                $attempt = $old->attempt + 1;
                if (count($files)) {
                    foreach (DB::table('sm_homework_files')->where('submission_id', $sid)->pluck('path') as $p) Storage::disk('local')->delete($p);
                    DB::table('sm_homework_files')->where('submission_id', $sid)->delete();
                }
            } else {
                $sid = DB::table('sm_homework_submissions')->insertGetId($row + ['homework_id' => $id, 'student_id' => $st['id'], 'attempt' => 1]);
                $attempt = 1;
            }

            foreach ($files as $f) {
                DB::table('sm_homework_files')->insert([
                    'submission_id' => $sid,
                    'original_name' => mb_substr($f->getClientOriginalName(), 0, 190),
                    'path' => $f->store("homework/{$id}/{$st['id']}", 'local'),
                    'mime' => $f->getClientMimeType(),
                    'size_kb' => (int) ceil($f->getSize() / 1024),
                    'created_at' => now(),
                ]);
            }

            $this->upsertState($st, $id, ['progress' => 100]);
            return ['submitted_at' => now()->format('Y-m-d H:i:s'), 'is_late' => (bool) $late, 'attempt' => (int) $attempt];
        });
    }

    private function upsertState(array $st, int $id, array $data): array
    {
        $cur = DB::table('sm_homework_student_state')->where(['homework_id' => $id, 'student_id' => $st['id']])->first();
        $row = [
            'homework_id' => $id, 'student_id' => $st['id'],
            'starred' => (int) ($data['starred'] ?? ($cur->starred ?? 0)),
            'progress' => (int) ($data['progress'] ?? ($cur->progress ?? 0)),
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : ($cur->notes ?? null),
        ];
        DB::table('sm_homework_student_state')->upsert([$row], ['homework_id', 'student_id'], ['starred', 'progress', 'notes']);
        return ['starred' => (bool) $row['starred'], 'progress' => $row['progress'], 'notes' => $row['notes']];
    }

    public function saveState(array $st, int $id, array $data): ?array
    {
        return $this->visible($st, $id) ? $this->upsertState($st, $id, $data) : null;
    }

    public function comments(array $st, int $id): ?array
    {
        if (!$this->visible($st, $id)) return null;
        return DB::table('sm_homework_comments')->where('homework_id', $id)->orderBy('created_at')->orderBy('id')->get()
            ->map(fn ($c) => [
                'id' => (int) $c->id, 'author_type' => $c->author_type, 'author_name' => $c->author_name,
                'body' => $c->body, 'created_at' => $c->created_at,
                'mine' => $c->author_type === 'student' && (int) $c->author_id === $st['id'],
            ])->all();
    }

    public function addComment(array $st, int $id, string $body): ?array
    {
        if (!$this->visible($st, $id)) return null;
        $cid = DB::table('sm_homework_comments')->insertGetId([
            'homework_id' => $id, 'author_type' => 'student', 'author_id' => $st['id'],
            'author_name' => $st['name'], 'body' => $body, 'created_at' => now(),
        ]);
        return ['id' => (int) $cid, 'author_type' => 'student', 'author_name' => $st['name'], 'body' => $body,
                'created_at' => now()->format('Y-m-d H:i:s'), 'mine' => true];
    }

    public function ownedFile(array $st, int $fileId): ?object
    {
        return DB::table('sm_homework_files as f')
            ->join('sm_homework_submissions as sb', 'sb.id', '=', 'f.submission_id')
            ->where('f.id', $fileId)->where('sb.student_id', $st['id'])
            ->first(['f.path', 'f.original_name']);
    }
}
