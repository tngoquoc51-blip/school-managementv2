<?php

namespace Modules\Setting\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Setting\Services\BackupService;
use Modules\Setting\Services\SettingService;

class BackupController extends Controller
{
    use ApiResponse;

    public function __construct(private BackupService $bk, private SettingService $svc) {}

    public function index()
    {
        $rows = DB::table('sm_backups as b')->leftJoin('users as u', 'u.id', '=', 'b.triggered_by')
            ->orderByDesc('b.id')->limit(200)
            ->get(['b.id', 'b.code', 'b.type', 'b.status', 'b.file_name', 'b.file_size', 'b.note', 'b.error_message', 'b.started_at', 'b.finished_at', 'b.created_at', 'b.file_path', 'u.name as by_name']);
        foreach ($rows as $r) { $r->file_exists = $r->file_path && is_file($r->file_path); unset($r->file_path); }
        $s = $this->bk->settings();
        return $this->success(['items' => $rows, 'settings' => $s,
            'disk_free_gb' => round(@disk_free_space(base_path()) / 1073741824, 1),
            'total_size' => (int) DB::table('sm_backups')->where('status', 'done')->sum('file_size')]);
    }

    public function store(Request $r)
    {
        $d = $r->validate(['type' => 'required|in:db,files,full', 'note' => 'nullable|string|max:500']);
        $row = $this->bk->create($d['type'], $d['note'] ?? null, $r->user()->id);
        $ok = $row->status === 'done';
        $this->svc->audit($r->user(), 'backup.create', ($ok ? 'Tạo' : 'Tạo thất bại') . ' bản sao lưu ' . $row->code, ['severity' => $ok ? 'notice' : 'warning', 'status' => $ok ? 'success' : 'failed', 'entity_type' => 'backup', 'entity_id' => $row->id]);
        return $ok ? $this->success($row, 'Đã tạo bản sao lưu', 201) : $this->error($row->error_message ?: 'Sao lưu thất bại', 500);
    }

    public function updateSettings(Request $r)
    {
        $d = $r->validate(['auto_enabled' => 'required|boolean', 'auto_time' => ['required', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'], 'keep_days' => 'required|integer|min:1|max:3650', 'max_files' => 'required|integer|min:1|max:500', 'storage_path' => 'required|string|max:255']);
        $this->bk->settings();
        DB::table('sm_backup_settings')->where('id', 1)->update([
            'auto_enabled' => $d['auto_enabled'] ? 1 : 0, 'auto_time' => strlen($d['auto_time']) === 5 ? $d['auto_time'] . ':00' : $d['auto_time'],
            'keep_days' => $d['keep_days'], 'max_files' => $d['max_files'], 'storage_path' => $d['storage_path'], 'updated_at' => now()]);
        $this->svc->audit($r->user(), 'backup.settings', 'Cập nhật lịch sao lưu tự động', ['entity_type' => 'backup_settings']);
        return $this->success($this->bk->settings(), 'Đã lưu cấu hình sao lưu');
    }

    public function download(Request $r, int $id)
    {
        $b = DB::table('sm_backups')->find($id);
        if (! $b || ! $b->file_path || ! is_file($b->file_path)) return $this->error('File sao lưu không còn trên máy chủ', 404);
        $this->svc->audit($r->user(), 'backup.download', 'Tải xuống bản sao lưu ' . $b->code, ['severity' => 'notice', 'entity_type' => 'backup', 'entity_id' => $id]);
        return response()->download($b->file_path, $b->file_name);
    }

    public function destroy(Request $r, int $id)
    {
        $b = DB::table('sm_backups')->find($id);
        if (! $b) return $this->error('Không tìm thấy', 404);
        $this->bk->remove($b);
        $this->svc->audit($r->user(), 'backup.delete', 'Xóa bản sao lưu ' . $b->code, ['severity' => 'warning', 'entity_type' => 'backup', 'entity_id' => $id]);
        return $this->success(null, 'Đã xóa bản sao lưu');
    }

    public function restore(Request $r, int $id)
    {
        $r->validate(['confirm' => 'required|in:KHOI PHUC']);
        $b = DB::table('sm_backups')->find($id);
        if (! $b) return $this->error('Không tìm thấy', 404);
        $safety = $this->bk->create('db', 'Tự động sao lưu trước khi phục hồi ' . $b->code, $r->user()->id); // lưới an toàn
        if ($safety->status !== 'done') return $this->error('Không tạo được bản sao lưu an toàn trước khi phục hồi: ' . $safety->error_message, 500);
        try { $this->bk->restore($b); }
        catch (\Throwable $e) {
            $this->svc->audit($r->user(), 'backup.restore', 'Phục hồi thất bại ' . $b->code, ['severity' => 'critical', 'status' => 'failed']);
            return $this->error($e->getMessage(), 500);
        }
        $this->svc->audit($r->user(), 'backup.restore', 'Phục hồi CSDL từ ' . $b->code, ['severity' => 'critical', 'entity_type' => 'backup', 'entity_id' => $id]);
        return $this->success(null, 'Đã phục hồi dữ liệu. Bản sao lưu an toàn: ' . $safety->code);
    }
}
