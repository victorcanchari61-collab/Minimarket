package audit

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	maxCaptured  = 32 << 10 // de la respuesta solo hace falta el id y el nombre
	maxBody      = 64 << 10 // un login es diminuto; lo demás no se lee
	writeTimeout = 3 * time.Second
)

// capture copia lo que responde el handler (hasta maxCaptured) para sacarle el
// id y el nombre del registro creado.
type capture struct {
	gin.ResponseWriter
	body bytes.Buffer
}

func (w *capture) Write(data []byte) (int, error) {
	w.keep(data)

	return w.ResponseWriter.Write(data)
}

func (w *capture) WriteString(text string) (int, error) {
	w.keep([]byte(text))

	return w.ResponseWriter.WriteString(text)
}

func (w *capture) keep(data []byte) {
	if room := maxCaptured - w.body.Len(); room > 0 {
		w.body.Write(data[:min(room, len(data))])
	}
}

// save guarda sin depender de la petición: si el cliente cierra la conexión, la
// acción ya ocurrió y debe quedar anotada. Un fallo aquí nunca rompe la respuesta.
func save(c *gin.Context, service *Service, entry Entry) {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(c.Request.Context()), writeTimeout)
	defer cancel()

	if err := service.Record(ctx, entry); err != nil {
		log.Printf("auditoría: no se pudo registrar %s %s: %v", entry.Action, entry.Entity, err)
	}
}

// Record anota cada cambio que sale bien (POST, PUT, PATCH, DELETE con 2xx) del
// grupo al que se le ponga. Va después de la autenticación: actor dice quién es.
func Record(service *Service, actor func(*gin.Context) Actor) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodGet || c.Request.Method == http.MethodHead || c.Request.Method == http.MethodOptions {
			c.Next()

			return
		}

		writer := &capture{ResponseWriter: c.Writer}
		c.Writer = writer

		c.Next()

		// Los errores se escriben después, en web.Errors: aquí el estado aún es 200.
		if len(c.Errors) > 0 || c.Writer.Status() < 200 || c.Writer.Status() > 299 {
			return
		}

		who := actor(c)
		entity, action := Describe(c.Request.Method, c.FullPath())
		data := responseData(writer.body.Bytes())

		save(c, service, Entry{
			Actor: &who, Action: action, Entity: entity, EntityID: entityID(c, data), Label: labelOf(data),
			Method: c.Request.Method, Path: c.Request.URL.Path, Status: c.Writer.Status(), IP: c.ClientIP(),
		})
	}
}

// Login anota los ingresos y los intentos fallidos. Va en POST /login, que no
// pasa por la autenticación: el correo se lee del cuerpo (la contraseña no se toca).
func Login(service *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var attempt struct {
			Email string `json:"email"`
		}

		if raw, err := io.ReadAll(io.LimitReader(c.Request.Body, maxBody)); err == nil {
			_ = json.Unmarshal(raw, &attempt)
			c.Request.Body = io.NopCloser(io.MultiReader(bytes.NewReader(raw), c.Request.Body))
		}

		writer := &capture{ResponseWriter: c.Writer}
		c.Writer = writer

		c.Next()

		entry := Entry{
			Entity: "session", Method: c.Request.Method, Path: c.Request.URL.Path,
			Status: c.Writer.Status(), IP: c.ClientIP(),
		}

		switch {
		case len(c.Errors) == 0:
			user := userOf(writer.body.Bytes())
			if user == nil {
				return
			}

			entry.Action, entry.Actor = ActionLogin, user
		case attempt.Email != "":
			// Los errores se escriben después, en web.Errors: aquí solo se sabe que falló.
			entry.Action, entry.Email, entry.Status = ActionLoginFailed, attempt.Email, 0
		default:
			return
		}

		save(c, service, entry)
	}
}

// responseData es el "data" de una respuesta JSON, o nada si no hay.
func responseData(body []byte) map[string]any {
	var envelope struct {
		Data map[string]any `json:"data"`
	}

	if json.Unmarshal(body, &envelope) != nil {
		return nil
	}

	return envelope.Data
}

// userOf lee el usuario que devuelve un login correcto.
func userOf(body []byte) *Actor {
	var response struct {
		User struct {
			ID    int64  `json:"id"`
			Name  string `json:"name"`
			Email string `json:"email"`
		} `json:"user"`
	}

	if json.Unmarshal(body, &response) != nil || response.User.ID == 0 {
		return nil
	}

	return &Actor{ID: response.User.ID, Name: response.User.Name, Email: response.User.Email}
}

// entityID es el :id de la ruta o, si se acaba de crear, el id que devolvió.
func entityID(c *gin.Context, data map[string]any) *int64 {
	if id, err := strconv.ParseInt(c.Param("id"), 10, 64); err == nil && id > 0 {
		return &id
	}

	if value, ok := data["id"].(float64); ok && value > 0 {
		id := int64(value)

		return &id
	}

	return nil
}

// labelOf es un nombre legible del registro, si la respuesta lo trae.
func labelOf(data map[string]any) string {
	for _, key := range []string{"name", "title", "series", "code", "email"} {
		if text, ok := data[key].(string); ok && text != "" {
			return text
		}
	}

	return ""
}
