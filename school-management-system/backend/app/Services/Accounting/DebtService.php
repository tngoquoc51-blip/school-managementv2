<?php

namespace App\Services\Accounting;

class DebtService
{
    public function summary(?int $yearId = null): array
    {
        return [
            'total_debt' => 0,
            'student_count' => 0,
        ];
    }

    public function list(array $filters = []): array
    {
        return [];
    }

    public function __call(string $name, array $arguments)
    {
        return null;
    }
}
