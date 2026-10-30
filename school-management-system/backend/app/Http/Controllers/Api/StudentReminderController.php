<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class StudentReminderController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(['success' => true, 'data' => []]);
    }

    public function readAll(Request $request)
    {
        return response()->json(['success' => true]);
    }

    public function read(Request $request, int $id)
    {
        return response()->json(['success' => true]);
    }
}
