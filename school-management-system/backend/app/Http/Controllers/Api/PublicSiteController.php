<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\PublicSiteRepo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** API công khai cho website trường (không cần đăng nhập): /api/public/* */
class PublicSiteController extends Controller
{
    private function repo(): PublicSiteRepo
    {
        return new PublicSiteRepo(DB::connection()->getPdo());
    }

    private function out(array $x)
    {
        if (!$x['ok']) {
            return response()->json(array_filter(['message' => $x['message'], 'errors' => $x['errors'] ?? null]), $x['status']);
        }
        return response()->json(['message' => $x['message'] ?? 'OK', 'data' => array_diff_key($x, ['ok' => 1, 'status' => 1, 'message' => 1])]);
    }

    private function cached(array $data, int $seconds = 60)
    {
        return response()->json(['data' => $data])->header('Cache-Control', "public, max-age=$seconds");
    }

    public function overview()
    {
        return $this->cached($this->repo()->overview(), 300);
    }

    public function news(Request $r)
    {
        return $this->cached($this->repo()->news($r->query()), 30);
    }

    public function events(Request $r)
    {
        return $this->cached(['items' => $this->repo()->events((int) $r->query('limit', 5))], 60);
    }

    public function newsOne(string $slug)
    {
        $x = $this->repo()->newsOne($slug);
        return $x ? response()->json(['data' => $x]) : response()->json(['message' => 'Không tìm thấy bài viết.'], 404);
    }

    public function admit(Request $r)
    {
        return $this->out($this->repo()->admit($r->all(), $r->ip()));
    }

    public function lookup(Request $r)
    {
        return $this->out($this->repo()->lookup((string) $r->input('code'), (string) $r->input('phone')));
    }

    public function contact(Request $r)
    {
        return $this->out($this->repo()->contact($r->all(), $r->ip()));
    }
}
