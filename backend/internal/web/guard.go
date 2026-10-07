package web

import "github.com/gin-gonic/gin"

// Guard arma el middleware que exige permisos en una ruta: pasa quien tenga
// ALGUNO de los códigos dados (por ejemplo "erp.catalog.products.edit").
//
// Los submódulos reciben un Guard al registrar sus rutas en lugar de importar
// el paquete de permisos: así ninguno depende del otro.
type Guard func(codes ...string) gin.HandlerFunc
