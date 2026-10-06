package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"

	"minimarket/backend/internal/shared/apperror"
)

const (
	bcryptCost = 12
	tokenBytes = 40
)

// Credenciales del usuario de prueba. Solo se usan en el entorno local.
const (
	DemoName     = "Administrador"
	DemoEmail    = "admin@minimarket.test"
	DemoPassword = "password"
)

// Service concentra las reglas de acceso. No conoce HTTP.
type Service struct {
	repo     *Repository
	tokenTTL time.Duration
	// dummyHash se compara cuando el correo no existe, para que el tiempo de
	// respuesta no delate qué correos están registrados.
	dummyHash []byte
}

func NewService(repo *Repository, tokenTTL time.Duration) *Service {
	dummy, _ := bcrypt.GenerateFromPassword([]byte("no-existe"), bcryptCost)

	return &Service{repo: repo, tokenTTL: tokenTTL, dummyHash: dummy}
}

func hashToken(plain string) string {
	sum := sha256.Sum256([]byte(plain))

	return hex.EncodeToString(sum[:])
}

func newToken() (string, error) {
	raw := make([]byte, tokenBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func invalidCredentials() *apperror.Error {
	err := apperror.New(apperror.InvalidCredentials, "Las credenciales ingresadas no son correctas.")
	err.Fields = map[string][]string{"email": {err.Message}}

	return err
}

// Login cambia credenciales por un token de acceso. Devuelve el token en claro
// (es la única vez que existe) y el usuario.
func (s *Service) Login(ctx context.Context, email, password, device string) (string, User, error) {
	user, err := s.repo.FindUserByEmail(ctx, email)

	switch {
	case errors.Is(err, ErrNotFound):
		_ = bcrypt.CompareHashAndPassword(s.dummyHash, []byte(password))

		return "", User{}, invalidCredentials()
	case err != nil:
		return "", User{}, err
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return "", User{}, invalidCredentials()
	}

	plain, err := newToken()
	if err != nil {
		return "", User{}, err
	}

	if device == "" {
		device = "web"
	}

	var expiresAt *time.Time
	if s.tokenTTL > 0 {
		at := time.Now().Add(s.tokenTTL)
		expiresAt = &at
	}

	if err := s.repo.CreateToken(ctx, user.ID, device, hashToken(plain), expiresAt); err != nil {
		return "", User{}, err
	}

	return plain, user, nil
}

// Authenticate resuelve el token de una petición. Devuelve el usuario y el id
// del token (para poder cerrarlo).
func (s *Service) Authenticate(ctx context.Context, plain string) (User, int64, error) {
	user, tokenID, err := s.repo.FindUserByToken(ctx, hashToken(plain))
	if errors.Is(err, ErrNotFound) {
		return User{}, 0, apperror.New(apperror.Unauthenticated, "No has iniciado sesión.")
	}

	return user, tokenID, err
}

// Logout revoca el token usado en la petición.
func (s *Service) Logout(ctx context.Context, tokenID int64) error {
	return s.repo.DeleteToken(ctx, tokenID)
}

// EnsureDemoUser crea el usuario de prueba si falta.
func (s *Service) EnsureDemoUser(ctx context.Context) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(DemoPassword), bcryptCost)
	if err != nil {
		return err
	}

	_, err = s.repo.EnsureUser(ctx, DemoName, DemoEmail, string(hash))

	return err
}
