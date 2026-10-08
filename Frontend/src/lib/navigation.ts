import {
    Activity,
    ArrowLeftRight,
    ArrowRightLeft,
    Award,
    Banknote,
    Barcode,
    BellRing,
    BookOpen,
    Boxes,
    Building2,
    CalendarClock,
    CalendarDays,
    CalendarOff,
    Calculator,
    ChartColumn,
    ChartLine,
    ChartPie,
    ClipboardCheck,
    ClipboardList,
    Clock,
    Coins,
    ContactRound,
    Container,
    CreditCard,
    Database,
    DoorOpen,
    FileCheck,
    FileMinus,
    FileSearch,
    FileSpreadsheet,
    FileText,
    Filter,
    Fingerprint,
    FolderOpen,
    Fuel,
    Gauge,
    GitMerge,
    Gift,
    Globe,
    GraduationCap,
    Handshake,
    HandCoins,
    Hash,
    HardHat,
    Headset,
    History,
    IdCard,
    KeyRound,
    Landmark,
    Layers,
    LayoutDashboard,
    LayoutGrid,
    ListChecks,
    ListFilter,
    ListOrdered,
    Map,
    MapPin,
    MapPinned,
    Medal,
    Megaphone,
    MessageCircle,
    MessageSquareWarning,
    Monitor,
    Navigation,
    Network,
    Package,
    PackageCheck,
    PackageOpen,
    PackageSearch,
    Percent,
    Plug,
    Receipt,
    RefreshCw,
    Rocket,
    Radar,
    Route,
    Ruler,
    Scale,
    ScanBarcode,
    ScanLine,
    Send,
    Settings,
    ShieldCheck,
    Shirt,
    ShoppingBag,
    ShoppingCart,
    Shuffle,
    SlidersHorizontal,
    Smartphone,
    Smile,
    Sparkles,
    Star,
    Stethoscope,
    Store,
    Tag,
    Target,
    Thermometer,
    Ticket,
    Timer,
    Trash2,
    TrendingDown,
    TrendingUp,
    TriangleAlert,
    Truck,
    Undo2,
    UserPlus,
    UserRound,
    Users,
    Wallet,
    Warehouse,
    WifiOff,
    Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PortalKey } from '@/lib/systems';

export type NavItem = {
    /** Código del permiso (el del backend): "products", "quick_sale"… */
    code: string;
    label: string;
    icon: LucideIcon;
};

export type NavModule = NavItem & {
    items: NavItem[];
};

const item = (code: string, label: string, icon: LucideIcon): NavItem => ({
    code,
    label,
    icon,
});

const mod = (
    code: string,
    label: string,
    icon: LucideIcon,
    items: NavItem[],
): NavModule => ({
    code,
    label,
    icon,
    items,
});

/** "Facturación electrónica" → "facturacion-electronica" (para las URL). */
export function slugify(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Módulos y submódulos de cada sistema (según docs/arquitectura-sistemas.md).
 * Es la única fuente de los nombres: el sidebar y la pantalla de sistemas
 * leen de aquí. Los códigos son los del catálogo de permisos del backend
 * (internal/permission): sistema.módulo.submódulo.
 */
export const SYSTEM_NAV: Record<PortalKey, NavModule[]> = {
    pos: [
        mod('sales', 'Ventas', ShoppingCart, [
            item('quick_sale', 'Venta rápida', ScanBarcode),
            item('customer_sale', 'Venta con cliente', UserRound),
            item('credit_sale', 'Venta a crédito', CreditCard),
            item('held_sales', 'Ventas en espera', Clock),
        ]),
        mod('billing', 'Facturación electrónica', FileText, [
            item('documents', 'Comprobantes', Receipt),
            item('sunat_submission', 'Envío a SUNAT', Send),
            item('contingency', 'Contingencia y reenvío', RefreshCw),
        ]),
        mod('cash', 'Caja', Wallet, [
            item('open_close', 'Apertura y cierre', DoorOpen),
            item('count', 'Arqueo', Calculator),
            item('movements', 'Ingresos y retiros', ArrowLeftRight),
            item('shift_close', 'Cierre por turno', Clock),
        ]),
        mod('payment_methods', 'Medios de pago', Banknote, [
            item('cash_cards', 'Efectivo y tarjetas', CreditCard),
            item('digital_wallets', 'Yape y Plin', Smartphone),
            item('mixed', 'Pago mixto', Shuffle),
            item('reconciliation', 'Conciliación por medio', Scale),
        ]),
        mod('promotions', 'Promociones y precios', Ticket, [
            item('discounts', 'Descuentos y combos', Percent),
            item('branch_prices', 'Precios por sucursal', Store),
            item('coupons', 'Cupones', Ticket),
        ]),
        mod('returns', 'Devoluciones y anulaciones', Undo2, [
            item('credit_notes', 'Devolución con nota de crédito', FileMinus),
            item('cancellations', 'Anulación con autorización', ShieldCheck),
        ]),
        mod('security', 'Seguridad y configuración', Settings, [
            item('users_roles', 'Usuarios y roles', Users),
            item('terminals', 'Terminales y series', Monitor),
            item('offline', 'Modo offline', WifiOff),
        ]),
    ],

    erp: [
        mod('catalog', 'Catálogo y maestros', Boxes, [
            item('products', 'Productos', Package),
            item('units', 'Unidades y presentaciones', Ruler),
            item('partners', 'Proveedores y clientes', Handshake),
            item('branches', 'Sucursales y almacenes', Warehouse),
            item('price_lists', 'Listas de precios', ListChecks),
        ]),
        mod('inventory', 'Inventario', PackageSearch, [
            item('stock', 'Stock por sucursal y lote', Boxes),
            item('kardex', 'Kardex valorizado', BookOpen),
            item('expiry', 'Control de vencimientos', CalendarClock),
            item('transfers', 'Transferencias', ArrowLeftRight),
            item('adjustments', 'Ajustes y mermas', SlidersHorizontal),
            item('cycle_count', 'Inventario cíclico', ClipboardCheck),
        ]),
        mod('purchasing', 'Compras', ShoppingBag, [
            item('requirements', 'Requerimientos', ClipboardList),
            item('quotes', 'Cotizaciones', FileSearch),
            item('purchase_orders', 'Órdenes de compra', FileText),
            item('receipts', 'Recepción de mercadería', PackageOpen),
            item('supplier_returns', 'Devoluciones a proveedor', Undo2),
            item('costing', 'Costeo', Calculator),
        ]),
        mod('sales', 'Ventas y distribución', Truck, [
            item('wholesale', 'Ventas mayoristas', Store),
            item('quotes_orders', 'Cotizaciones y pedidos', FileText),
            item('dispatch_guides', 'Guías de remisión', FileCheck),
            item('receivables', 'Cuentas por cobrar', HandCoins),
        ]),
        mod('finance', 'Finanzas y contabilidad', Landmark, [
            item('ledger', 'Contabilidad general', BookOpen),
            item('payables', 'Cuentas por pagar', Receipt),
            item('treasury', 'Tesorería y bancos', Landmark),
            item('bank_reconciliation', 'Conciliación bancaria', Scale),
            item('cost_centers', 'Centros de costo', ChartPie),
            item('tax_books', 'Libros electrónicos e impuestos', FileSpreadsheet),
        ]),
        mod('fixed_assets', 'Activos fijos', Building2, [
            item('asset_register', 'Registro de activos', Package),
            item('depreciation', 'Depreciación', TrendingDown),
            item('maintenance', 'Mantenimiento', Wrench),
        ]),
        mod('administration', 'Administración del sistema', Settings, [
            item('multicompany', 'Multiempresa y multisucursal', Building2),
            item('roles_audit', 'Roles y auditoría', ShieldCheck),
            item('integrations', 'Integraciones', Plug),
        ]),
    ],

    mdm: [
        mod('products', 'Productos', Tag, [
            item('products', 'Productos', Package),
            item('brands', 'Marcas', Award),
            item('categories', 'Categorías y subcategorías', Layers),
            item('barcodes', 'Códigos de barras', Barcode),
            item('taxes', 'Impuestos', Percent),
            item('units', 'Unidades y equivalencias', Ruler),
        ]),
        mod('locations', 'Zonas y formatos', MapPinned, [
            item('regions', 'Regiones y zonas', Globe),
            item('formats', 'Formatos de tienda', Store),
            item('hours', 'Horarios de atención', Clock),
        ]),
        mod('suppliers', 'Proveedores', Handshake, [
            item('suppliers', 'Maestro de proveedores', Building2),
            item('contracts', 'Contactos y contratos', FileText),
            item('terms', 'Condiciones y plazos', CalendarClock),
        ]),
        mod('customers', 'Clientes', Users, [
            item('records', 'Datos del cliente', ContactRound),
            item('consents', 'Consentimientos', ShieldCheck),
        ]),
        mod('quality', 'Calidad de datos', ListChecks, [
            item('duplicates', 'Duplicados y fusiones', GitMerge),
            item('approvals', 'Aprobación de altas', ClipboardCheck),
            item('changes', 'Historial de cambios', History),
        ]),
    ],

    scm: [
        mod('demand', 'Planeación de la demanda', TrendingUp, [
            item('forecast', 'Pronóstico por SKU', ChartLine),
            item('seasonality', 'Estacionalidad y eventos', CalendarDays),
            item('abc', 'Rotación ABC', ListOrdered),
        ]),
        mod('replenishment', 'Reposición', RefreshCw, [
            item('min_max', 'Stock mínimo y máximo', Gauge),
            item('suggested_order', 'Pedido sugerido por tienda', ShoppingCart),
            item('stockout_alerts', 'Alertas de quiebre', BellRing),
        ]),
        mod('sourcing', 'Abastecimiento', Handshake, [
            item('supplier_orders', 'Pedido sugerido a proveedores', FileText),
            item('lead_times', 'Lead times', Timer),
            item('supplier_rating', 'Evaluación de proveedores', Star),
        ]),
        mod('distribution', 'Distribución y transporte', Route, [
            item('routes', 'Rutas y despachos', Map),
            item('fleet', 'Flota y transportistas', Truck),
            item('tracking', 'Seguimiento de entregas', MapPin),
            item('logistics_costs', 'Costos logísticos', Coins),
        ]),
        mod('quality', 'Control de mermas y calidad', TriangleAlert, [
            item('waste_by_cause', 'Mermas por causa', Trash2),
            item('expiring', 'Productos por vencer', CalendarClock),
            item('supplier_claims', 'Reclamos a proveedores', MessageSquareWarning),
        ]),
    ],

    wms: [
        mod('structure', 'Estructura del almacén', Warehouse, [
            item('locations', 'Zonas, pasillos y ubicaciones', LayoutGrid),
            item('capacities', 'Capacidades y tipos', Thermometer),
        ]),
        mod('receiving', 'Recepción', PackageOpen, [
            item('appointments', 'Citas de recepción', CalendarClock),
            item('po_verification', 'Verificación contra orden de compra', ClipboardCheck),
            item('lot_labeling', 'Etiquetado de lote y vencimiento', Barcode),
        ]),
        mod('storage', 'Almacenamiento', Layers, [
            item('suggested_location', 'Ubicación sugerida', MapPin),
            item('relocations', 'Reubicaciones', ArrowRightLeft),
            item('location_stock', 'Stock por ubicación', Boxes),
        ]),
        mod('picking', 'Picking', ScanBarcode, [
            item('orders_waves', 'Por orden, ola o ruta', ListChecks),
            item('handheld', 'Con handheld o scanner', ScanLine),
            item('pick_replenishment', 'Reposición de zona de picking', RefreshCw),
        ]),
        mod('packing', 'Packing y despacho', Truck, [
            item('consolidation', 'Consolidación por tienda', PackageCheck),
            item('dispatch_guides', 'Guías de remisión', FileText),
            item('vehicle_loading', 'Carga y salida de vehículos', Truck),
        ]),
        mod('inventories', 'Inventarios', ClipboardCheck, [
            item('cycle_counts', 'Conteos cíclicos', ClipboardList),
            item('reconciliation', 'Conciliación y ajustes', Scale),
        ]),
        mod('reverse_logistics', 'Devoluciones (logística inversa)', Undo2, [
            item('store_returns', 'Retorno desde tiendas', Store),
            item('classification', 'Clasificación', ListFilter),
        ]),
    ],

    tms: [
        mod('fleet', 'Flota', Truck, [
            item('vehicles', 'Vehículos', Container),
            item('drivers', 'Conductores', IdCard),
            item('carriers', 'Transportistas', Building2),
            item('maintenance', 'Mantenimiento', Wrench),
        ]),
        mod('routes', 'Rutas y planificación', Route, [
            item('route_plans', 'Rutas', Map),
            item('optimization', 'Optimización de rutas', Navigation),
            item('calendar', 'Calendario de entregas', CalendarDays),
        ]),
        mod('dispatch', 'Despachos', PackageCheck, [
            item('assignment', 'Asignación de pedidos', ClipboardList),
            item('departures', 'Salidas y retornos', ArrowLeftRight),
        ]),
        mod('tracking', 'Seguimiento', Radar, [
            item('live', 'Seguimiento en vivo', MapPin),
            item('deliveries', 'Entregas y prueba de entrega', FileCheck),
            item('incidents', 'Incidencias', TriangleAlert),
        ]),
        mod('costs', 'Costos de transporte', Coins, [
            item('fuel', 'Combustible', Fuel),
            item('trip_costs', 'Costos por ruta y entrega', Receipt),
            item('freight', 'Fletes de transportistas', HandCoins),
        ]),
    ],

    hcm: [
        mod('personnel', 'Administración de personal', UserRound, [
            item('files', 'Legajo y contratos', FolderOpen),
            item('structure', 'Estructura y puestos', Network),
            item('t_registro', 'T-Registro', FileCheck),
        ]),
        mod('attendance', 'Asistencia y turnos', Clock, [
            item('clocking', 'Marcación', Fingerprint),
            item('shifts', 'Turnos por tienda', CalendarDays),
            item('overtime', 'Horas extra, tardanzas y faltas', Timer),
            item('leaves', 'Permisos y licencias', CalendarOff),
        ]),
        mod('payroll', 'Planilla', Banknote, [
            item('remuneration', 'Remuneraciones y descuentos', Calculator),
            item('benefits', 'Gratificaciones, CTS y vacaciones', Gift),
            item('plame', 'PLAME, AFP/ONP y EsSalud', Landmark),
            item('payslips', 'Boletas de pago', Receipt),
            item('settlements', 'Liquidaciones', FileCheck),
        ]),
        mod('compensation', 'Compensaciones y desempeño', Target, [
            item('commissions', 'Comisiones y bonos', Award),
            item('performance', 'Evaluación de desempeño', ClipboardCheck),
        ]),
        mod('recruiting', 'Reclutamiento y capacitación', GraduationCap, [
            item('vacancies', 'Vacantes y postulantes', UserPlus),
            item('onboarding', 'Onboarding', Rocket),
            item('training', 'Capacitaciones y certificaciones', Award),
        ]),
        mod('occupational_health', 'Seguridad y salud ocupacional', HardHat, [
            item('medical_exams', 'Exámenes médicos', Stethoscope),
            item('incidents', 'Incidentes y accidentes', TriangleAlert),
            item('ppe', 'Entrega de EPP y uniformes', Shirt),
        ]),
    ],

    crm: [
        mod('customers', 'Clientes', Users, [
            item('base', 'Base única de clientes', Database),
            item('segmentation', 'Segmentación', Filter),
            item('history', 'Historial de compras', History),
        ]),
        mod('loyalty', 'Programa de puntos', Star, [
            item('points', 'Acumulación y canje', Gift),
            item('tiers', 'Niveles y beneficios', Medal),
            item('identification', 'Identificación por DNI o celular', Smartphone),
        ]),
        mod('campaigns', 'Campañas', Megaphone, [
            item('coupons', 'Cupones segmentados', Ticket),
            item('messaging', 'WhatsApp, SMS y email', MessageCircle),
            item('behavior_promos', 'Promociones por comportamiento', Sparkles),
        ]),
        mod('service', 'Atención al cliente', Headset, [
            item('complaints', 'Reclamos y libro de reclamaciones', BookOpen),
            item('surveys', 'Encuestas de satisfacción', Smile),
        ]),
    ],

    bi: [
        mod('sales', 'Ventas', TrendingUp, [
            item('by_store', 'Por tienda', Store),
            item('by_hour_category', 'Por hora y categoría', Clock),
            item('by_sku_cashier', 'Por SKU y cajero', ScanBarcode),
        ]),
        mod('inventory', 'Inventario', Boxes, [
            item('turnover', 'Rotación y días de inventario', RefreshCw),
            item('stockouts', 'Quiebres', TriangleAlert),
            item('waste', 'Mermas', Trash2),
        ]),
        mod('profitability', 'Rentabilidad', Percent, [
            item('product_margin', 'Margen por producto', Package),
            item('branch_margin', 'Margen por sucursal', Store),
        ]),
        mod('operations', 'Operaciones', Gauge, [
            item('productivity', 'Productividad por tienda y turno', Activity),
            item('compliance', 'Cumplimiento de reposición y despachos', ClipboardCheck),
        ]),
        mod('executive', 'Gerencial', LayoutDashboard, [
            item('dashboards', 'Dashboards ejecutivos', ChartColumn),
            item('alerts', 'Alertas y KPIs por sucursal', BellRing),
            item('budget', 'Presupuesto vs. real', Scale),
        ]),
    ],

    config: [
        mod('users', 'Usuarios', Users, [item('list', 'Lista de usuarios', Users)]),
        mod('roles', 'Roles y permisos', ShieldCheck, [
            item('roles', 'Roles', ShieldCheck),
            item('permissions', 'Permisos por sistema', KeyRound),
        ]),
        mod('company', 'Empresa y sucursales', Building2, [
            item('info', 'Datos de la empresa', Building2),
            item('branches', 'Sucursales', Store),
            item('warehouses', 'Almacenes', Warehouse),
        ]),
        mod('terminals', 'Terminales y series', Monitor, [
            item('pos_terminals', 'Terminales POS', Monitor),
            item('series', 'Series de comprobantes', Hash),
        ]),
        mod('audit', 'Auditoría', History, [item('history', 'Historial de acciones', History)]),
        mod('integrations', 'Integraciones', Plug, [
            item('sunat', 'SUNAT', FileCheck),
            item('banks', 'Bancos', Landmark),
            item('apis_webhooks', 'APIs y webhooks', Plug),
        ]),
    ],
};

export function moduleLabels(key: PortalKey): string[] {
    return SYSTEM_NAV[key].map((entry) => entry.label);
}

/** Busca el módulo y el submódulo que corresponden a los slugs de la URL. */
export function findNav(
    key: PortalKey,
    moduleSlug?: string | null,
    itemSlug?: string | null,
): { module: NavModule | null; item: NavItem | null } {
    const current = SYSTEM_NAV[key].find(
        (entry) => slugify(entry.label) === moduleSlug,
    );
    const subItem = current?.items.find(
        (entry) => slugify(entry.label) === itemSlug,
    );

    return { module: current ?? null, item: subItem ?? null };
}

/** Código completo del permiso para ver un submódulo: "erp.catalog.products.view". */
export function viewCode(system: PortalKey, module: NavModule, subItem: NavItem) {
    return `${system}.${module.code}.${subItem.code}.view`;
}

/**
 * Los módulos y submódulos de un sistema que `canView` deja pasar. Un módulo
 * sin submódulos visibles no se muestra.
 */
export function visibleNav(
    key: PortalKey,
    canView: (code: string) => boolean,
): NavModule[] {
    return SYSTEM_NAV[key]
        .map((entry) => ({
            ...entry,
            items: entry.items.filter((subItem) =>
                canView(viewCode(key, entry, subItem)),
            ),
        }))
        .filter((entry) => entry.items.length > 0);
}
