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

test('the systems screen and every known system render', function () {
    $this->get(route('systems.index'))->assertOk();

    foreach (App\Enums\SystemKey::cases() as $system) {
        $this->get(route('systems.show', $system))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('sistema')
                ->where('system', $system->value));
    }
});

test('an unknown system returns 404', function () {
    $this->get('/sistemas/ecommerce')->assertNotFound();
});

test('a system page accepts a module and a submodule', function () {
    $this->get('/sistemas/erp/inventario/kardex-valorizado')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('sistema')
            ->where('system', 'erp')
            ->where('module', 'inventario')
            ->where('item', 'kardex-valorizado'));

    $this->get('/sistemas/erp/Inventario%20X')->assertNotFound();
});
