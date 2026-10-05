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
    Gauge,
    Gift,
    GraduationCap,
    Handshake,
    HandCoins,
    Hash,
    HardHat,
    Headset,
    History,
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
    Medal,
    Megaphone,
    MessageCircle,
    MessageSquareWarning,
    Monitor,
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
    label: string;
    icon: LucideIcon;
};

export type NavModule = NavItem & {
    items: NavItem[];
};

const item = (label: string, icon: LucideIcon): NavItem => ({ label, icon });

const mod = (label: string, icon: LucideIcon, items: NavItem[]): NavModule => ({
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
 * leen de aquí.
 */
export const SYSTEM_NAV: Record<PortalKey, NavModule[]> = {
    pos: [
        mod('Ventas', ShoppingCart, [
            item('Venta rápida', ScanBarcode),
            item('Venta con cliente', UserRound),
            item('Venta a crédito', CreditCard),
            item('Ventas en espera', Clock),
        ]),
        mod('Facturación electrónica', FileText, [
            item('Comprobantes', Receipt),
            item('Envío a SUNAT', Send),
            item('Contingencia y reenvío', RefreshCw),
        ]),
        mod('Caja', Wallet, [
            item('Apertura y cierre', DoorOpen),
            item('Arqueo', Calculator),
            item('Ingresos y retiros', ArrowLeftRight),
            item('Cierre por turno', Clock),
        ]),
        mod('Medios de pago', Banknote, [
            item('Efectivo y tarjetas', CreditCard),
            item('Yape y Plin', Smartphone),
            item('Pago mixto', Shuffle),
            item('Conciliación por medio', Scale),
        ]),
        mod('Promociones y precios', Ticket, [
            item('Descuentos y combos', Percent),
            item('Precios por sucursal', Store),
            item('Cupones', Ticket),
        ]),
        mod('Devoluciones y anulaciones', Undo2, [
            item('Devolución con nota de crédito', FileMinus),
            item('Anulación con autorización', ShieldCheck),
        ]),
        mod('Seguridad y configuración', Settings, [
            item('Usuarios y roles', Users),
            item('Terminales y series', Monitor),
            item('Modo offline', WifiOff),
        ]),
    ],

    erp: [
        mod('Catálogo y maestros', Boxes, [
            item('Productos', Package),
            item('Unidades y presentaciones', Ruler),
            item('Proveedores y clientes', Handshake),
            item('Sucursales y almacenes', Warehouse),
            item('Listas de precios', ListChecks),
        ]),
        mod('Inventario', PackageSearch, [
            item('Stock por sucursal y lote', Boxes),
            item('Kardex valorizado', BookOpen),
            item('Control de vencimientos', CalendarClock),
            item('Transferencias', ArrowLeftRight),
            item('Ajustes y mermas', SlidersHorizontal),
            item('Inventario cíclico', ClipboardCheck),
        ]),
        mod('Compras', ShoppingBag, [
            item('Requerimientos', ClipboardList),
            item('Cotizaciones', FileSearch),
            item('Órdenes de compra', FileText),
            item('Recepción de mercadería', PackageOpen),
            item('Devoluciones a proveedor', Undo2),
            item('Costeo', Calculator),
        ]),
        mod('Ventas y distribución', Truck, [
            item('Ventas mayoristas', Store),
            item('Cotizaciones y pedidos', FileText),
            item('Guías de remisión', FileCheck),
            item('Cuentas por cobrar', HandCoins),
        ]),
        mod('Finanzas y contabilidad', Landmark, [
            item('Contabilidad general', BookOpen),
            item('Cuentas por pagar', Receipt),
            item('Tesorería y bancos', Landmark),
            item('Conciliación bancaria', Scale),
            item('Centros de costo', ChartPie),
            item('Libros electrónicos e impuestos', FileSpreadsheet),
        ]),
        mod('Activos fijos', Building2, [
            item('Registro de activos', Package),
            item('Depreciación', TrendingDown),
            item('Mantenimiento', Wrench),
        ]),
        mod('Administración del sistema', Settings, [
            item('Multiempresa y multisucursal', Building2),
            item('Roles y auditoría', ShieldCheck),
            item('Integraciones', Plug),
        ]),
    ],

    scm: [
        mod('Planeación de la demanda', TrendingUp, [
            item('Pronóstico por SKU', ChartLine),
            item('Estacionalidad y eventos', CalendarDays),
            item('Rotación ABC', ListOrdered),
        ]),
        mod('Reposición', RefreshCw, [
            item('Stock mínimo y máximo', Gauge),
            item('Pedido sugerido por tienda', ShoppingCart),
            item('Alertas de quiebre', BellRing),
        ]),
        mod('Abastecimiento', Handshake, [
            item('Pedido sugerido a proveedores', FileText),
            item('Lead times', Timer),
            item('Evaluación de proveedores', Star),
        ]),
        mod('Distribución y transporte', Route, [
            item('Rutas y despachos', Map),
            item('Flota y transportistas', Truck),
            item('Seguimiento de entregas', MapPin),
            item('Costos logísticos', Coins),
        ]),
        mod('Control de mermas y calidad', TriangleAlert, [
            item('Mermas por causa', Trash2),
            item('Productos por vencer', CalendarClock),
            item('Reclamos a proveedores', MessageSquareWarning),
        ]),
    ],

    wms: [
        mod('Estructura del almacén', Warehouse, [
            item('Zonas, pasillos y ubicaciones', LayoutGrid),
            item('Capacidades y tipos', Thermometer),
        ]),
        mod('Recepción', PackageOpen, [
            item('Citas de recepción', CalendarClock),
            item('Verificación contra orden de compra', ClipboardCheck),
            item('Etiquetado de lote y vencimiento', Barcode),
        ]),
        mod('Almacenamiento', Layers, [
            item('Ubicación sugerida', MapPin),
            item('Reubicaciones', ArrowRightLeft),
            item('Stock por ubicación', Boxes),
        ]),
        mod('Picking', ScanBarcode, [
            item('Por orden, ola o ruta', ListChecks),
            item('Con handheld o scanner', ScanLine),
            item('Reposición de zona de picking', RefreshCw),
        ]),
        mod('Packing y despacho', Truck, [
            item('Consolidación por tienda', PackageCheck),
            item('Guías de remisión', FileText),
            item('Carga y salida de vehículos', Truck),
        ]),
        mod('Inventarios', ClipboardCheck, [
            item('Conteos cíclicos', ClipboardList),
            item('Conciliación y ajustes', Scale),
        ]),
        mod('Devoluciones (logística inversa)', Undo2, [
            item('Retorno desde tiendas', Store),
            item('Clasificación', ListFilter),
        ]),
    ],

    hcm: [
        mod('Administración de personal', UserRound, [
            item('Legajo y contratos', FolderOpen),
            item('Estructura y puestos', Network),
            item('T-Registro', FileCheck),
        ]),
        mod('Asistencia y turnos', Clock, [
            item('Marcación', Fingerprint),
            item('Turnos por tienda', CalendarDays),
            item('Horas extra, tardanzas y faltas', Timer),
            item('Permisos y licencias', CalendarOff),
        ]),
        mod('Planilla', Banknote, [
            item('Remuneraciones y descuentos', Calculator),
            item('Gratificaciones, CTS y vacaciones', Gift),
            item('PLAME, AFP/ONP y EsSalud', Landmark),
            item('Boletas de pago', Receipt),
            item('Liquidaciones', FileCheck),
        ]),
        mod('Compensaciones y desempeño', Target, [
            item('Comisiones y bonos', Award),
            item('Evaluación de desempeño', ClipboardCheck),
        ]),
        mod('Reclutamiento y capacitación', GraduationCap, [
            item('Vacantes y postulantes', UserPlus),
            item('Onboarding', Rocket),
            item('Capacitaciones y certificaciones', Award),
        ]),
        mod('Seguridad y salud ocupacional', HardHat, [
            item('Exámenes médicos', Stethoscope),
            item('Incidentes y accidentes', TriangleAlert),
            item('Entrega de EPP y uniformes', Shirt),
        ]),
    ],

    crm: [
        mod('Clientes', Users, [
            item('Base única de clientes', Database),
            item('Segmentación', Filter),
            item('Historial de compras', History),
        ]),
        mod('Programa de puntos', Star, [
            item('Acumulación y canje', Gift),
            item('Niveles y beneficios', Medal),
            item('Identificación por DNI o celular', Smartphone),
        ]),
        mod('Campañas', Megaphone, [
            item('Cupones segmentados', Ticket),
            item('WhatsApp, SMS y email', MessageCircle),
            item('Promociones por comportamiento', Sparkles),
        ]),
        mod('Atención al cliente', Headset, [
            item('Reclamos y libro de reclamaciones', BookOpen),
            item('Encuestas de satisfacción', Smile),
        ]),
    ],

    bi: [
        mod('Ventas', TrendingUp, [
            item('Por tienda', Store),
            item('Por hora y categoría', Clock),
            item('Por SKU y cajero', ScanBarcode),
        ]),
        mod('Inventario', Boxes, [
            item('Rotación y días de inventario', RefreshCw),
            item('Quiebres', TriangleAlert),
            item('Mermas', Trash2),
        ]),
        mod('Rentabilidad', Percent, [
            item('Margen por producto', Package),
            item('Margen por sucursal', Store),
        ]),
        mod('Operaciones', Gauge, [
            item('Productividad por tienda y turno', Activity),
            item('Cumplimiento de reposición y despachos', ClipboardCheck),
        ]),
        mod('Gerencial', LayoutDashboard, [
            item('Dashboards ejecutivos', ChartColumn),
            item('Alertas y KPIs por sucursal', BellRing),
            item('Presupuesto vs. real', Scale),
        ]),
    ],

    config: [
        mod('Usuarios', Users, [
            item('Lista de usuarios', Users),
            item('Nuevo usuario', UserPlus),
        ]),
        mod('Roles y permisos', ShieldCheck, [
            item('Roles', ShieldCheck),
            item('Permisos por sistema', KeyRound),
        ]),
        mod('Empresa y sucursales', Building2, [
            item('Datos de la empresa', Building2),
            item('Sucursales', Store),
            item('Almacenes', Warehouse),
        ]),
        mod('Terminales y series', Monitor, [
            item('Terminales POS', Monitor),
            item('Series de comprobantes', Hash),
        ]),
        mod('Auditoría', History, [item('Historial de acciones', History)]),
        mod('Integraciones', Plug, [
            item('SUNAT', FileCheck),
            item('Bancos', Landmark),
            item('APIs y webhooks', Plug),
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
