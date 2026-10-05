<?php

use Database\Seeders\DemoUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('the root redirects to the login screen', function () {
    $this->get(route('home'))->assertRedirect(route('login'));
});

test('login screen offers demo credentials and creates the demo user in the local environment', function () {
    app()->detectEnvironment(fn () => 'local');

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/login')
            ->where('demoCredentials.email', DemoUserSeeder::EMAIL)
            ->where('demoCredentials.password', DemoUserSeeder::PASSWORD));

    $this->postJson('/api/login', DemoUserSeeder::credentials())->assertOk();
});

test('login screen hides demo credentials outside the local environment', function () {
    app()->detectEnvironment(fn () => 'production');

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('demoCredentials', null));
});

test('the demo user seeder is idempotent', function () {
    (new DemoUserSeeder)->run();
    (new DemoUserSeeder)->run();

    expect(App\Models\User::where('email', DemoUserSeeder::EMAIL)->count())->toBe(1);
});
