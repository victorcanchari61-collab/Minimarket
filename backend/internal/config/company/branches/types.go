// Package branches es Configuraciones › Empresa y sucursales › Sucursales: los
// puntos físicos de la cadena (tiendas y centros de distribución).
package branches

// Kind es el tipo de sucursal. Es un enum: nunca se usan cadenas sueltas
// ("store") fuera de este archivo.
type Kind string

const (
	KindStore        Kind = "store"        // vende al público
	KindDistribution Kind = "distribution" // abastece a las tiendas; no vende
)

func (k Kind) Label() string {
	switch k {
	case KindStore:
		return "Tienda"
	case KindDistribution:
		return "Centro de distribución"
	default:
		return string(k)
	}
}

type Branch struct {
	ID      int64
	Code    string
	Name    string
	Address string
	Kind    Kind
}
