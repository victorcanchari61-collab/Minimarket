<?php

namespace App\Http\Controllers;

use Database\Seeders\DemoUserSeeder;
use Inertia\Inertia;
use Inertia\Response;

class LoginPageController extends Controller
{
    /**
     * Render the login screen. Test credentials are offered only in the local
     * environment, and the demo user is created on demand so the login works.
     */
    public function __invoke(): Response
    {
        $demoCredentials = null;

        if (app()->environment('local')) {
            DemoUserSeeder::ensureExists();
            $demoCredentials = DemoUserSeeder::credentials();
        }

        return Inertia::render('auth/login', [
            'demoCredentials' => $demoCredentials,
        ]);
    }
}
