package internal_test

import (
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"
)

const modulePath = "minimarket/backend/internal/"

// Paquetes de funcionalidad: internal/auth y internal/<sistema>/<submódulo>.
var systems = map[string]bool{"erp": true, "pos": true, "scm": true, "wms": true, "hcm": true, "crm": true, "bi": true}

type goFile struct {
	dir     string // relativo a internal/, con /
	name    string
	imports []string
}

func load(t *testing.T) []goFile {
	t.Helper()

	var files []goFile

	err := filepath.WalkDir(".", func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return err
		}

		parsed, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
		if err != nil {
			return err
		}

		file := goFile{dir: filepath.ToSlash(filepath.Dir(path)), name: entry.Name()}
		for _, spec := range parsed.Imports {
			file.imports = append(file.imports, strings.Trim(spec.Path.Value, `"`))
		}

		files = append(files, file)

		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	return files
}

func isFeature(dir string) bool {
	parts := strings.Split(dir, "/")

	return dir == "auth" || (len(parts) == 2 && systems[parts[0]])
}

func importsAny(file goFile, prefixes ...string) string {
	for _, imp := range file.imports {
		for _, prefix := range prefixes {
			if imp == prefix || strings.HasPrefix(imp, prefix+"/") {
				return imp
			}
		}
	}

	return ""
}

// Solo http.go (y el middleware de auth) conoce a Gin: el resto del paquete
// no sabe que existe HTTP.
func TestOnlyHTTPFilesKnowGin(t *testing.T) {
	for _, file := range load(t) {
		if !isFeature(file.dir) || file.name == "http.go" || file.name == "middleware.go" {
			continue
		}

		if imp := importsAny(file, "github.com/gin-gonic/gin", "net/http"); imp != "" {
			t.Errorf("%s/%s importa %s: solo http.go puede conocer HTTP", file.dir, file.name, imp)
		}
	}
}

// El handler no habla con la base de datos: eso es del store y del servicio.
func TestHandlersDoNotTouchTheDatabase(t *testing.T) {
	for _, file := range load(t) {
		if !isFeature(file.dir) || file.name != "http.go" {
			continue
		}

		if imp := importsAny(file, "github.com/jackc/pgx/v5", modulePath+"platform/database"); imp != "" {
			t.Errorf("%s/http.go importa %s: el handler no accede a la base de datos", file.dir, imp)
		}
	}
}

// Las piezas comunes no dependen de ninguna funcionalidad: la dependencia va
// siempre de las funcionalidades hacia lo común, nunca al revés.
func TestSharedCodeDoesNotDependOnFeatures(t *testing.T) {
	shared := map[string]bool{"apperror": true, "pagination": true, "web": true, "platform": true}

	for _, file := range load(t) {
		top := strings.Split(file.dir, "/")[0]
		if !shared[top] {
			continue
		}

		for _, imp := range file.imports {
			rest, ok := strings.CutPrefix(imp, modulePath)
			if !ok {
				continue
			}

			if isFeature(strings.TrimSuffix(rest, "/")) || strings.HasPrefix(rest, "server") {
				t.Errorf("%s/%s importa %s: lo común no puede depender de una funcionalidad", file.dir, file.name, imp)
			}
		}
	}
}

// Ninguna funcionalidad arma el enrutador: eso es de internal/server.
func TestFeaturesDoNotImportTheServer(t *testing.T) {
	for _, file := range load(t) {
		if !isFeature(file.dir) {
			continue
		}

		if imp := importsAny(file, modulePath+"server"); imp != "" {
			t.Errorf("%s/%s importa %s", file.dir, file.name, imp)
		}
	}
}
