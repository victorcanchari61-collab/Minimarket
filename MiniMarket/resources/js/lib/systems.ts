import {
    Banknote,
    Boxes,
    Building2,
    ClipboardCheck,
    Clock,
    CreditCard,
    FileText,
    Handshake,
    HardHat,
    Heart,
    Landmark,
    Layers,
    Megaphone,
    MessageSquareWarning,
    Package,
    PackageOpen,
    Receipt,
    RefreshCw,
    Route,
    ScanBarcode,
    ShoppingBag,
    ShoppingCart,
    Smile,
    Star,
    Store,
    Tag,
    Target,
    TrendingUp,
    TriangleAlert,
    Truck,
    UserRound,
    Users,
    Wallet,
    Warehouse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const BRAND_NAME = 'MiniMarket';

export type SystemKey = 'pos' | 'erp' | 'scm' | 'wms' | 'hcm' | 'crm';

export type StatusTone = 'ok' | 'warn' | 'info' | 'bad';

export type ShowcaseRow = {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    status: string;
    tone: StatusTone;
};

export type SystemModule = {
    label: string;
    icon: LucideIcon;
};

export type SystemDefinition = {
    key: SystemKey;
    name: string;
    fullName: string;
    icon: LucideIcon;
    headline: string;
    blurb: string;
    modules: SystemModule[];
    rows: [ShowcaseRow, ShowcaseRow, ShowcaseRow];
    footer: string;
};

export const SYSTEMS: Record<SystemKey, SystemDefinition> = {
    pos: {
        key: 'pos',
        name: 'POS',
        fullName: 'Punto de venta',
        icon: ShoppingCart,
        headline: 'Cada venta queda registrada una sola vez',
        blurb: 'Venta rápida con código de barras, comprobantes electrónicos a SUNAT, caja y medios de pago en el mismo registro.',
        modules: [
            { label: 'Ventas', icon: Receipt },
            { label: 'Facturación', icon: FileText },
            { label: 'Caja', icon: Wallet },
            { label: 'Pagos', icon: CreditCard },
            { label: 'Promociones', icon: Tag },
        ],
        rows: [
            {
                icon: Receipt,
                title: 'Boleta B001-0412',
                subtitle: 'Cliente varios · S/ 38.50',
                status: 'Emitida',
                tone: 'ok',
            },
            {
                icon: FileText,
                title: 'Factura F001-0087',
                subtitle: 'Andina Foods SAC · S/ 1,240.00',
                status: 'Aceptada',
                tone: 'ok',
            },
            {
                icon: Wallet,
                title: 'Caja 02 · Turno mañana',
                subtitle: 'Rosa Quispe · Apertura S/ 200.00',
                status: 'Abierta',
                tone: 'info',
            },
        ],
        footer: 'Ventas de hoy · 148 comprobantes · S/ 9,840.60',
    },

    erp: {
        key: 'erp',
        name: 'ERP',
        fullName: 'Gestión empresarial',
        icon: Building2,
        headline: 'Un solo núcleo para todas las sucursales',
        blurb: 'Catálogo, inventario, compras, finanzas y sucursales sobre los mismos datos, con kardex valorizado y control de vencimientos.',
        modules: [
            { label: 'Catálogo', icon: Boxes },
            { label: 'Inventario', icon: Package },
            { label: 'Compras', icon: ShoppingBag },
            { label: 'Finanzas', icon: Landmark },
            { label: 'Sucursales', icon: Store },
        ],
        rows: [
            {
                icon: Boxes,
                title: 'Arroz extra 5 kg',
                subtitle: 'SKU 100234 · Abarrotes · Unidad: saco',
                status: 'Activo',
                tone: 'ok',
            },
            {
                icon: Package,
                title: 'Transferencia TR-0211',
                subtitle: 'Almacén central → Miraflores · 24 ítems',
                status: 'En tránsito',
                tone: 'info',
            },
            {
                icon: ShoppingBag,
                title: 'Orden de compra OC-2026-0156',
                subtitle: 'Alicorp S.A.A. · S/ 18,420.00',
                status: 'Aprobada',
                tone: 'ok',
            },
        ],
        footer: 'Valor de inventario · S/ 482,310.00',
    },

    scm: {
        key: 'scm',
        name: 'SCM',
        fullName: 'Suministro y reposición',
        icon: Truck,
        headline: 'Pide lo justo antes de que se acabe',
        blurb: 'Pronóstico de demanda, reposición por tienda, abastecimiento a proveedores y distribución, para que cada sucursal tenga lo que vende.',
        modules: [
            { label: 'Demanda', icon: TrendingUp },
            { label: 'Reposición', icon: RefreshCw },
            { label: 'Abastecimiento', icon: Handshake },
            { label: 'Distribución', icon: Route },
            { label: 'Mermas', icon: TriangleAlert },
        ],
        rows: [
            {
                icon: TrendingUp,
                title: 'Arroz extra 5 kg · Surco',
                subtitle: 'Pronóstico semana 41 · 320 unidades',
                status: '+12%',
                tone: 'ok',
            },
            {
                icon: RefreshCw,
                title: 'Leche evaporada 400 g',
                subtitle: 'Miraflores · quedan 18 · mínimo 40',
                status: 'Quiebre',
                tone: 'bad',
            },
            {
                icon: Route,
                title: 'Ruta Sur · 6 tiendas',
                subtitle: 'Unidad ABC-123 · 4 de 6 entregas',
                status: 'En ruta',
                tone: 'info',
            },
        ],
        footer: 'Alertas de hoy · 5 quiebres · 3 excesos',
    },

    wms: {
        key: 'wms',
        name: 'WMS',
        fullName: 'Almacén central',
        icon: Warehouse,
        headline: 'Cada pallet en su ubicación, cada pedido sin errores',
        blurb: 'Recepción contra orden de compra, almacenamiento por ubicación, picking con escáner y despacho consolidado por tienda.',
        modules: [
            { label: 'Recepción', icon: PackageOpen },
            { label: 'Almacenamiento', icon: Layers },
            { label: 'Picking', icon: ScanBarcode },
            { label: 'Despacho', icon: Truck },
            { label: 'Inventarios', icon: ClipboardCheck },
        ],
        rows: [
            {
                icon: PackageOpen,
                title: 'Cita 08:30 · Andina Foods',
                subtitle: 'Muelle 2 · OC-2026-0156',
                status: 'Descargando',
                tone: 'info',
            },
            {
                icon: ScanBarcode,
                title: 'Ola 12 · 18 pedidos',
                subtitle: 'Luis Ramos · escáner 03',
                status: 'En curso',
                tone: 'info',
            },
            {
                icon: Truck,
                title: 'Consolidado Miraflores',
                subtitle: '9 bultos · 412 kg',
                status: 'Listo',
                tone: 'ok',
            },
        ],
        footer: 'Ocupación del almacén · 74%',
    },

    hcm: {
        key: 'hcm',
        name: 'RR. HH.',
        fullName: 'Gestión de personas',
        icon: Users,
        headline: 'Personas, turnos y planilla en un solo lugar',
        blurb: 'Legajos, asistencia y turnos por tienda, planilla con boletas electrónicas, desempeño y seguridad ocupacional.',
        modules: [
            { label: 'Personal', icon: UserRound },
            { label: 'Asistencia', icon: Clock },
            { label: 'Planilla', icon: Banknote },
            { label: 'Desempeño', icon: Target },
            { label: 'Seguridad', icon: HardHat },
        ],
        rows: [
            {
                icon: UserRound,
                title: 'Rosa Quispe',
                subtitle: 'Cajera · Miraflores · plazo fijo',
                status: 'Vigente',
                tone: 'ok',
            },
            {
                icon: Clock,
                title: 'Turno mañana · Miraflores',
                subtitle: '8 de 8 marcaciones',
                status: 'Completo',
                tone: 'ok',
            },
            {
                icon: Banknote,
                title: 'Planilla septiembre 2026',
                subtitle: '186 colaboradores · S/ 412,300.00',
                status: 'Calculada',
                tone: 'info',
            },
        ],
        footer: 'Asistencia de hoy · 94%',
    },

    crm: {
        key: 'crm',
        name: 'CRM',
        fullName: 'Clientes y fidelización',
        icon: Heart,
        headline: 'Un cliente, todas sus compras',
        blurb: 'Base única de clientes, programa de puntos con niveles, campañas por WhatsApp y SMS, reclamos y encuestas de satisfacción.',
        modules: [
            { label: 'Clientes', icon: Users },
            { label: 'Puntos', icon: Star },
            { label: 'Campañas', icon: Megaphone },
            { label: 'Reclamos', icon: MessageSquareWarning },
            { label: 'Encuestas', icon: Smile },
        ],
        rows: [
            {
                icon: Users,
                title: 'Marisol Paredes',
                subtitle: '38 compras · S/ 2,140.00 acumulados',
                status: 'Frecuente',
                tone: 'ok',
            },
            {
                icon: Star,
                title: 'Canje CJ-0092',
                subtitle: 'Aceite 1 L por 800 puntos',
                status: 'Canjeado',
                tone: 'warn',
            },
            {
                icon: Megaphone,
                title: 'Cupón 15% en lácteos',
                subtitle: 'WhatsApp · 1,240 clientes',
                status: 'Enviada',
                tone: 'ok',
            },
        ],
        footer: 'Clientes registrados · 18,420',
    },
};

/** Orden en que se presentan los sistemas (el del documento de arquitectura). */
export const SYSTEM_LIST: SystemDefinition[] = [
    SYSTEMS.pos,
    SYSTEMS.erp,
    SYSTEMS.scm,
    SYSTEMS.wms,
    SYSTEMS.hcm,
    SYSTEMS.crm,
];

const DEFAULT_SYSTEM: SystemKey = 'pos';

export function isSystemKey(value: unknown): value is SystemKey {
    return typeof value === 'string' && value in SYSTEMS;
}

/**
 * El sistema activo sale de VITE_APP_SYSTEM (una instalación por sistema).
 * El parámetro ?sistema= solo sirve para previsualizar los demás temas.
 */
export function resolveSystem(search = ''): SystemDefinition {
    const fromQuery = new URLSearchParams(search).get('sistema');

    if (isSystemKey(fromQuery)) {
        return SYSTEMS[fromQuery];
    }

    const fromEnv: unknown = import.meta.env.VITE_APP_SYSTEM;

    return SYSTEMS[isSystemKey(fromEnv) ? fromEnv : DEFAULT_SYSTEM];
}
