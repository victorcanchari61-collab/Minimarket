<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DemoUserSeeder extends Seeder
{
    public const NAME = 'Administrador';

    public const EMAIL = 'admin@minimarket.test';

    public const PASSWORD = 'password';

    public function run(): void
    {
        self::ensureExists();
    }

    /**
     * Create the demo user when it does not exist yet.
     */
    public static function ensureExists(): User
    {
        return User::query()->firstOrCreate(
            ['email' => self::EMAIL],
            ['name' => self::NAME, 'password' => self::PASSWORD, 'email_verified_at' => now()],
        );
    }

    /**
     * @return array{email: string, password: string}
     */
    public static function credentials(): array
    {
        return ['email' => self::EMAIL, 'password' => self::PASSWORD];
    }
}
