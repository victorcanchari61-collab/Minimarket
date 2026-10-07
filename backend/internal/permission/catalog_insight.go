package permission

// BI solo mira y exporta, salvo lo gerencial (dashboards, alertas, presupuesto).
func bi() System {
	return sys("bi", "BI",
		mod("sales", "Ventas",
			sub("by_store", "Por tienda", Export),
			sub("by_hour_category", "Por hora y categoría", Export),
			sub("by_sku_cashier", "Por SKU y cajero", Export),
		),
		mod("inventory", "Inventario",
			sub("turnover", "Rotación y días de inventario", Export),
			sub("stockouts", "Quiebres", Export),
			sub("waste", "Mermas", Export),
		),
		mod("profitability", "Rentabilidad",
			sub("product_margin", "Margen por producto", Export),
			sub("branch_margin", "Margen por sucursal", Export),
		),
		mod("operations", "Operaciones",
			sub("productivity", "Productividad por tienda y turno", Export),
			sub("compliance", "Cumplimiento de reposición y despachos", Export),
		),
		mod("executive", "Gerencial",
			sub("dashboards", "Dashboards ejecutivos", Create, Edit, Export),
			sub("alerts", "Alertas y KPIs por sucursal", Create, Edit, Delete),
			sub("budget", "Presupuesto vs. real", Edit, Approve),
		),
	)
}

// configSystem es Configuraciones: quién entra, a qué, y con qué empresa,
// sucursales y terminales.
func configSystem() System {
	return sys("config", "Configuraciones",
		mod("users", "Usuarios",
			// Elegir los roles de un usuario es parte de crearlo y editarlo.
			sub("list", "Lista de usuarios", Create, Edit, Delete, ResetPassword),
		),
		mod("roles", "Roles y permisos",
			sub("roles", "Roles", Create, Edit, Delete),
			sub("permissions", "Permisos por sistema", Assign),
		),
		mod("company", "Empresa y sucursales",
			sub("info", "Datos de la empresa", Edit),
			sub("branches", "Sucursales", Create, Edit, Delete),
			sub("warehouses", "Almacenes", Create, Edit, Delete),
		),
		mod("terminals", "Terminales y series",
			sub("pos_terminals", "Terminales POS", Create, Edit, Delete),
			sub("series", "Series de comprobantes", Create, Edit, Delete),
		),
		mod("audit", "Auditoría",
			sub("history", "Historial de acciones", Export),
		),
		mod("integrations", "Integraciones",
			sub("sunat", "SUNAT", Edit, Test),
			sub("banks", "Bancos", Edit, Test),
			sub("apis_webhooks", "APIs y webhooks", Create, Edit, Delete, Test),
		),
	)
}
