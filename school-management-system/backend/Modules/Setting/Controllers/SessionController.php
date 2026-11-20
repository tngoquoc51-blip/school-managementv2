<?php

namespace Modules\Setting\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Setting\Services\SettingService;

/** Phiên đăng nhập = Sanctum personal_access_tokens. */
class SessionController extends Controller
{
    use ApiResponse;

    public function __construct(private SettingService $svc) {}

    public function index(Request $r)
    {
        $current = $r->user()->currentAccessToken()->id ?? null;
        $q = DB::table('personal_access_tokens as t')
            ->leftJoin('users as u', function ($j) { $j->on('u.id', '=', 't.tokenable_id')->where('t.tokenable_type', 'App\\Models\\User'); })
            ->select('t.id', 't.name', 't.last_used_at', 't.expires_at', 't.created_at', 't.tokenable_id', 'u.name as user_name', 'u.email as user_email');
        if ($s = trim((string) $r->query('q'))) $q->where(fn ($w) => $w->where('u.name', 'like', "%$s%")->orWhere('u.email', 'like', "%$s%")->orWhere('u.username', 'like', "%$s%"));
        if ($r->query('state') === 'active') $q->where(fn ($w) => $w->whereNull('t.expires_at')->orWhere('t.expires_at', '>', now()));
        if ($r->query('state') === 'expired') $q->where('t.expires_at', '<=', now());
        $page = $q->orderByRaw('t.last_used_at IS NULL, t.last_used_at DESC')->orderByDesc('t.id')->paginate(20);
        foreach ($page->items() as $x) { $x->is_current = $x->id === $current; $x->expired = $x->expires_at && $x->expires_at <= now()->toDateTimeString(); }

        return $this->success(['items' => $page->items(), 'meta' => ['total' => $page->total(), 'page' => $page->currentPage(), 'last_page' => $page->lastPage()],
            'stats' => ['total' => DB::table('personal_access_tokens')->count(),
                        'active' => DB::table('personal_access_tokens')->where(fn ($w) => $w->whereNull('expires_at')->orWhere('expires_at', '>', now()))->count(),
                        'expired' => DB::table('personal_access_tokens')->where('expires_at', '<=', now())->count()]]);
    }

    public function destroy(Request $r, int $id)
    {
        if (($r->user()->currentAccessToken()->id ?? null) === $id) return $this->error('Không thể thu hồi phiên bạn đang dùng. Hãy đăng xuất.', 409);
        $n = DB::table('personal_access_tokens')->where('id', $id)->delete();
        if ($n) $this->svc->audit($r->user(), 'session.revoke', "Thu hồi phiên đăng nhập #$id", ['severity' => 'notice', 'entity_type' => 'token', 'entity_id' => $id]);
        return $n ? $this->success(null, 'Đã thu hồi phiên đăng nhập') : $this->error('Không tìm thấy', 404);
    }

    /** POST /sessions/revoke-all  body: { scope: 'others' | 'expired' } */
    public function revokeAll(Request $r)
    {
        $scope = $r->validate(['scope' => 'required|in:others,expired'])['scope'];
        $q = DB::table('personal_access_tokens');
        if ($scope === 'expired') $q->where('expires_at', '<=', now());
        else $q->where('id', '!=', $r->user()->currentAccessToken()->id ?? 0);
        $n = $q->delete();
        $this->svc->audit($r->user(), 'session.revoke_all', "Thu hồi $n phiên đăng nhập ($scope)", ['severity' => $scope === 'others' ? 'warning' : 'info']);
        return $this->success(['deleted' => $n], "Đã thu hồi $n phiên");
    }
}
