<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->with('roles');

        if ($search = $request->get('q')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($role = $request->get('role')) {
            $query->role($role);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        $users = $query->orderByDesc('id')->get();

        return response()->json([
            'data' => $users->map(function ($u) {
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'username' => $u->username,
                    'email' => $u->email,
                    'phone' => $u->phone,
                    'status' => $u->status ?? 'active',
                    'roles' => $u->roles->pluck('name')->values(),
                    'created_at' => $u->created_at?->format('d/m/Y'),
                    'last_login' => null,
                ];
            }),
            'stats' => [
                'total' => User::count(),
                'active' => User::where('status', 'active')->count(),
                'locked' => User::where('status', 'locked')->count(),
                'pending' => User::where('status', 'pending')->count(),
            ],
        ]);
    }
}
