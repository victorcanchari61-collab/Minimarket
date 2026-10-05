<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('users can log in through the api and receive a bearer token', function () {
    $user = User::factory()->create();

    $response = $this->postJson('/api/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertOk()
        ->assertJsonStructure(['token', 'token_type', 'user' => ['id', 'name', 'email']])
        ->assertJsonPath('user.email', $user->email);

    $this->withToken($response->json('token'))
        ->getJson('/api/user')
        ->assertOk()
        ->assertJsonPath('data.email', $user->email);
});

test('api login rejects a wrong password', function () {
    $user = User::factory()->create();

    $this->postJson('/api/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');
});

test('api login requires email and password', function () {
    $this->postJson('/api/login', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email', 'password']);
});

test('api user endpoint rejects guests with a json 401', function () {
    $this->getJson('/api/user')->assertUnauthorized();
});

test('api logout revokes the current token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)->postJson('/api/logout')->assertOk();

    expect($user->tokens()->count())->toBe(0);
});
