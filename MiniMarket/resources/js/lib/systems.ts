import {
    BarChart3,
    Banknote,
    Bike,
    Boxes,
    Building2,
    ClipboardCheck,
    ClipboardList,
    Clock,
    CreditCard,
    FileText,
    Gauge,
    Handshake,
    HardHat,
    Heart,
    LayoutDashboard,
    Landmark,
    Layers,
    Megaphone,
    MessageSquareWarning,
    Package,
    PackageCheck,
    PackageOpen,
    Percent,
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

export type SystemKey =
    | 'pos'
    | 'erp'
    | 'scm'
    | 'wms'
    | 'hcm'
    | 'crm'
    | 'ecommerce'
    | 'bi';

export type StatusTone = 'ok' | 'warn' | 'info' | 'bad';

export type ShowcaseRow = {
    title: string;
    subtitle: string;
    status: string;
    tone: StatusTone;
};

export type SystemModule = {
    label: string;
    icon: LucideIcon;
    headline: string;
    blurb: string;
    rows: [ShowcaseRow, ShowcaseRow, ShowcaseRow];
    footer: string;
};

export type SystemDefinition = {
    key: SystemKey;
    name: string;
    fullName: string;
    icon: LucideIcon;
    modules: SystemModule[];
};

export const SYSTEMS: Record<SystemKey, SystemDefinition> = {
    pos: {
        key: 'pos',
        name: 'POS',
        fullName: 'Punto de venta',
        icon: ShoppingCart,
        modules: [
            {
                label: 'Ventas',
                icon: Receipt,
                headline: 'Cada venta queda registrada una sola vez',
                blurb: 'Venta rápida con código de barras o balanza, cobro en caja y comprobante emitido desde el mismo registro.',
                rows: [
                    {
                        title: 'Boleta B001-0412',
                        subtitle: 'Cliente varios · S/ 38.50',
                        status: 'Emitida',
                        tone: 'ok',
                    },
                    {
                        title: 'Factura F001-0087',
                        subtitle: 'Andina Foods SAC · S/ 1,240.00',
                        status: 'Aceptada',
                        tone: 'ok',
                    },
                    {
                        title: 'Venta en espera #3',
                        subtitle: 'Caja 02 · 6 productos · S/ 54.20',
                        status: 'En espera',
                        tone: 'warn',
                    },
                ],
                footer: 'Ventas de hoy · 148 comprobantes · S/ 9,840.60',
            },
            {
                label: 'Facturación',
                icon: FileText,
                headline: 'Comprobantes electrónicos sin salir del mostrador',
                blurb: 'Boletas, facturas y notas de crédito se envían a SUNAT al instante, con reenvío automático si falla la conexión.',
                rows: [
                    {
                        title: 'F001-0087 · Factura',
                        subtitle: 'Andina Foods SAC · S/ 1,240.00',
                        status: 'Aceptada',
                        tone: 'ok',
                    },
                    {
                        title: 'B001-0412 · Boleta',
                        subtitle: 'Cliente varios · S/ 38.50',
                        status: 'Aceptada',
                        tone: 'ok',
                    },
                    {
                        title: 'BC01-0009 · Nota de crédito',
                        subtitle: 'Devolución de F001-0079 · S/ 86.00',
                        status: 'Pendiente',
                        tone: 'warn',
                    },
                ],
                footer: 'Envíos a SUNAT hoy · 148 aceptados · 1 pendiente',
            },
            {
                label: 'Caja',
                icon: Wallet,
                headline: 'Cierra el turno con la caja cuadrada',
                blurb: 'Apertura, arqueo y cierre por cajero, con retiros y depósitos de efectivo registrados.',
                rows: [
                    {
                        title: 'Caja 01 · Turno mañana',
                        subtitle: 'Rosa Quispe · Apertura S/ 200.00',
                        status: 'Abierta',
                        tone: 'ok',
                    },
                    {
                        title: 'Retiro de efectivo',
                        subtitle: 'Caja 02 · S/ 500.00 · Depósito a banco',
                        status: 'Autorizado',
                        tone: 'info',
                    },
                    {
                        title: 'Arqueo Caja 03',
                        subtitle: 'Diferencia de S/ 2.50 por revisar',
                        status: 'Revisar',
                        tone: 'warn',
                    },
                ],
                footer: 'Efectivo en cajas · S/ 3,218.00',
            },
            {
                label: 'Pagos',
                icon: CreditCard,
                headline: 'Cobra como prefiera cada cliente',
                blurb: 'Efectivo, tarjeta, Yape, Plin o pago mixto, conciliados por medio de pago.',
                rows: [
                    {
                        title: 'Yape',
                        subtitle: '42 operaciones · S/ 1,860.50',
                        status: 'Conciliado',
                        tone: 'ok',
                    },
                    {
                        title: 'Tarjeta',
                        subtitle: '37 operaciones · S/ 3,412.90',
                        status: 'Conciliado',
                        tone: 'ok',
                    },
                    {
                        title: 'Efectivo',
                        subtitle: '69 operaciones · S/ 4,567.20',
                        status: 'Por cuadrar',
                        tone: 'warn',
                    },
                ],
                footer: 'Pago mixto hoy · 11 ventas',
            },
            {
                label: 'Promociones',
                icon: Tag,
                headline: 'Precios y ofertas que se aplican solos',
                blurb: 'Descuentos, 2x1 y combos por sucursal y horario, aplicados en el momento de la venta.',
                rows: [
                    {
                        title: '2x1 en gaseosas 500 ml',
                        subtitle: 'Todas las sucursales · hasta el domingo',
                        status: 'Activa',
                        tone: 'ok',
                    },
                    {
                        title: 'Combo desayuno',
                        subtitle: 'Pan + leche + café · S/ 9.90',
                        status: 'Activa',
                        tone: 'ok',
                    },
                    {
                        title: 'Cupón BIENVENIDO10',
                        subtitle: '10% en la primera compra',
                        status: 'Programada',
                        tone: 'info',
                    },
                ],
                footer: 'Promociones activas · 7',
            },
        ],
    },

    erp: {
        key: 'erp',
        name: 'ERP',
        fullName: 'Gestión empresarial',
        icon: Building2,
        modules: [
            {
                label: 'Catálogo',
                icon: Boxes,
                headline: 'Un solo catálogo para todas las tiendas',
                blurb: 'Productos, códigos de barras, unidades y listas de precios compartidos por todas las sucursales.',
                rows: [
                    {
                        title: 'Arroz extra 5 kg',
                        subtitle: 'SKU 100234 · Abarrotes · Unidad: saco',
                        status: 'Activo',
                        tone: 'ok',
                    },
                    {
                        title: 'Aceite vegetal 1 L',
                        subtitle: 'SKU 100871 · 3 códigos de barras',
                        status: 'Activo',
                        tone: 'ok',
                    },
                    {
                        title: 'Lista mayorista · Verano',
                        subtitle: 'Vigente desde el 01/12',
                        status: 'Borrador',
                        tone: 'warn',
                    },
                ],
                footer: 'Catálogo · 4,820 productos activos',
            },
            {
                label: 'Inventario',
                icon: Package,
                headline: 'El stock real de cada sucursal y cada lote',
                blurb: 'Kardex valorizado, control de vencimientos FEFO y transferencias entre tiendas.',
                rows: [
                    {
                        title: 'Yogur natural 1 L',
                        subtitle: 'Lote L2410 · vence en 6 días',
                        status: 'Por vencer',
                        tone: 'warn',
                    },
                    {
                        title: 'Transferencia TR-0211',
                        subtitle: 'Almacén central → Miraflores · 24 ítems',
                        status: 'En tránsito',
                        tone: 'info',
                    },
                    {
                        title: 'Conteo cíclico · Pasillo 3',
                        subtitle: 'Sin diferencias',
                        status: 'Conciliado',
                        tone: 'ok',
                    },
                ],
                footer: 'Valor de inventario · S/ 482,310.00',
            },
            {
                label: 'Compras',
                icon: ShoppingBag,
                headline: 'De la orden de compra al stock recibido',
                blurb: 'Requerimientos, cotizaciones y órdenes de compra con recepción validada contra lo pedido.',
                rows: [
                    {
                        title: 'OC-2026-0156',
                        subtitle: 'Alicorp S.A.A. · S/ 18,420.00',
                        status: 'Aprobada',
                        tone: 'ok',
                    },
                    {
                        title: 'Cotización COT-0098',
                        subtitle: '3 proveedores comparados',
                        status: 'En revisión',
                        tone: 'info',
                    },
                    {
                        title: 'Recepción REC-0342',
                        subtitle: '12 de 12 ítems conformes',
                        status: 'Recibida',
                        tone: 'ok',
                    },
                ],
                footer: 'Órdenes abiertas · 9',
            },
            {
                label: 'Finanzas',
                icon: Landmark,
                headline: 'Contabilidad al día con cada venta',
                blurb: 'Cuentas por pagar y cobrar, tesorería, conciliación bancaria y libros electrónicos PLE.',
                rows: [
                    {
                        title: 'Factura proveedor F412-0066',
                        subtitle: 'Vence en 3 días · S/ 7,350.00',
                        status: 'Por pagar',
                        tone: 'warn',
                    },
                    {
                        title: 'Conciliación · Cuenta en soles',
                        subtitle: '148 de 150 movimientos',
                        status: 'Casi lista',
                        tone: 'info',
                    },
                    {
                        title: 'Libro de ventas PLE',
                        subtitle: 'Periodo 09-2026',
                        status: 'Generado',
                        tone: 'ok',
                    },
                ],
                footer: 'Cuentas por cobrar · S/ 64,200.00',
            },
            {
                label: 'Sucursales',
                icon: Store,
                headline: 'Multiempresa y multisucursal sobre un solo núcleo',
                blurb: 'Cada sucursal con su almacén, su centro de costo y sus permisos, sobre los mismos datos.',
                rows: [
                    {
                        title: 'Sucursal Miraflores',
                        subtitle: '2 almacenes · 6 cajas',
                        status: 'En línea',
                        tone: 'ok',
                    },
                    {
                        title: 'Sucursal San Borja',
                        subtitle: '1 almacén · 4 cajas',
                        status: 'En línea',
                        tone: 'ok',
                    },
                    {
                        title: 'Sucursal Surco',
                        subtitle: 'Actualizando precios y promociones',
                        status: 'Sincronizando',
                        tone: 'warn',
                    },
                ],
                footer: 'Sucursales activas · 12',
            },
        ],
    },

    scm: {
        key: 'scm',
        name: 'SCM',
        fullName: 'Suministro y reposición',
        icon: Truck,
        modules: [
            {
                label: 'Demanda',
                icon: TrendingUp,
                headline: 'Anticipa lo que se vende, tienda por tienda',
                blurb: 'Pronóstico por SKU y sucursal con estacionalidad, eventos y clasificación ABC.',
                rows: [
                    {
                        title: 'Arroz extra 5 kg · Surco',
                        subtitle: 'Pronóstico semana 41 · 320 unidades',
                        status: '+12%',
                        tone: 'ok',
                    },
                    {
                        title: 'Gaseosa 2.5 L · Todas',
                        subtitle: 'Alta rotación',
                        status: 'Clase A',
                        tone: 'info',
                    },
                    {
                        title: 'Panetón · Navidad',
                        subtitle: 'Pico esperado desde noviembre',
                        status: 'Evento',
                        tone: 'warn',
                    },
                ],
                footer: 'SKU analizados · 4,820',
            },
            {
                label: 'Reposición',
                icon: RefreshCw,
                headline: 'Pide lo justo antes de que se acabe',
                blurb: 'Stock mínimo, máximo y punto de pedido, con pedidos sugeridos por tienda y alertas de quiebre.',
                rows: [
                    {
                        title: 'Leche evaporada 400 g',
                        subtitle: 'Miraflores · quedan 18 · mínimo 40',
                        status: 'Quiebre',
                        tone: 'bad',
                    },
                    {
                        title: 'Pedido sugerido PS-0412',
                        subtitle: 'San Borja · 36 ítems',
                        status: 'Por aprobar',
                        tone: 'warn',
                    },
                    {
                        title: 'Detergente 900 g',
                        subtitle: 'Surco · sobrestock de 210 unidades',
                        status: 'Exceso',
                        tone: 'info',
                    },
                ],
                footer: 'Alertas de hoy · 5 quiebres · 3 excesos',
            },
            {
                label: 'Abastecimiento',
                icon: Handshake,
                headline: 'Compras al proveedor correcto, a tiempo',
                blurb: 'Pedidos sugeridos a proveedores, lead times y evaluación de cumplimiento, calidad y costo.',
                rows: [
                    {
                        title: 'Alicorp S.A.A.',
                        subtitle: 'Lead time 3 días · cumplimiento 96%',
                        status: 'Excelente',
                        tone: 'ok',
                    },
                    {
                        title: 'Distribuidora Norte',
                        subtitle: 'Lead time 7 días · cumplimiento 78%',
                        status: 'Observado',
                        tone: 'warn',
                    },
                    {
                        title: 'OC sugerida OCS-0087',
                        subtitle: '14 ítems · S/ 22,610.00',
                        status: 'Por enviar',
                        tone: 'info',
                    },
                ],
                footer: 'Proveedores evaluados · 38',
            },
            {
                label: 'Distribución',
                icon: Route,
                headline: 'Cada despacho en su ruta, cada entrega a la vista',
                blurb: 'Rutas, flota y transportistas con seguimiento de entregas y costos logísticos.',
                rows: [
                    {
                        title: 'Ruta Sur · 6 tiendas',
                        subtitle: 'Unidad ABC-123 · 4 de 6 entregas',
                        status: 'En ruta',
                        tone: 'info',
                    },
                    {
                        title: 'Ruta Norte · 4 tiendas',
                        subtitle: 'Salida 06:30 · 4 de 4 entregas',
                        status: 'Completada',
                        tone: 'ok',
                    },
                    {
                        title: 'Ruta Este · 5 tiendas',
                        subtitle: 'Salida programada 14:00',
                        status: 'Programada',
                        tone: 'warn',
                    },
                ],
                footer: 'Entregas de hoy · 23 de 28 completadas',
            },
            {
                label: 'Mermas',
                icon: TriangleAlert,
                headline: 'Las pérdidas, con causa y con responsable',
                blurb: 'Mermas por pérdida, robo o deterioro, productos por vencer y reclamos a proveedores.',
                rows: [
                    {
                        title: 'Lechuga hidropónica',
                        subtitle: 'Deterioro · 14 unidades · Surco',
                        status: 'Merma',
                        tone: 'bad',
                    },
                    {
                        title: 'Yogur natural 1 L',
                        subtitle: 'Vence en 4 días · 36 unidades',
                        status: 'Por vencer',
                        tone: 'warn',
                    },
                    {
                        title: 'Reclamo RC-0033',
                        subtitle: 'Lote con empaque dañado · Alicorp',
                        status: 'Abierto',
                        tone: 'info',
                    },
                ],
                footer: 'Mermas del mes · S/ 3,120.00',
            },
        ],
    },

    wms: {
        key: 'wms',
        name: 'WMS',
        fullName: 'Almacén central',
        icon: Warehouse,
        modules: [
            {
                label: 'Recepción',
                icon: PackageOpen,
                headline: 'Cada pallet verificado antes de entrar',
                blurb: 'Citas de recepción, validación contra la orden de compra y etiquetado de lote y vencimiento.',
                rows: [
                    {
                        title: 'Cita 08:30 · Andina Foods',
                        subtitle: 'Muelle 2 · OC-2026-0156',
                        status: 'Descargando',
                        tone: 'info',
                    },
                    {
                        title: 'Pallet P-10482',
                        subtitle: 'Lote L2410 · vence 12/2026',
                        status: 'Etiquetado',
                        tone: 'ok',
                    },
                    {
                        title: 'OC-2026-0149',
                        subtitle: 'Faltan 2 cajas de 40',
                        status: 'Diferencia',
                        tone: 'warn',
                    },
                ],
                footer: 'Recepciones de hoy · 7 citas',
            },
            {
                label: 'Almacenamiento',
                icon: Layers,
                headline: 'Cada producto en su ubicación, siempre',
                blurb: 'Ubicación sugerida al ingresar, reubicaciones y stock por pasillo, nivel y posición.',
                rows: [
                    {
                        title: 'Ingreso P-10482',
                        subtitle: 'Ubicación sugerida A-03-02 · Seco',
                        status: 'Sugerida',
                        tone: 'info',
                    },
                    {
                        title: 'Lácteos · Cámara fría',
                        subtitle: 'Zona refrigerada · 82% ocupada',
                        status: 'Casi llena',
                        tone: 'warn',
                    },
                    {
                        title: 'Reubicación R-0071',
                        subtitle: 'B-01-04 → A-02-01',
                        status: 'Completada',
                        tone: 'ok',
                    },
                ],
                footer: 'Ocupación del almacén · 74%',
            },
            {
                label: 'Picking',
                icon: ScanBarcode,
                headline: 'Pedidos armados rápido y sin errores',
                blurb: 'Picking por orden, por ola o por ruta, con el escáner en la mano.',
                rows: [
                    {
                        title: 'Ola 12 · 18 pedidos',
                        subtitle: 'Luis Ramos · escáner 03',
                        status: 'En curso',
                        tone: 'info',
                    },
                    {
                        title: 'Pedido T-0455 · Miraflores',
                        subtitle: '24 de 24 líneas',
                        status: 'Listo',
                        tone: 'ok',
                    },
                    {
                        title: 'Pedido T-0458 · Surco',
                        subtitle: 'Producto no encontrado en A-02-07',
                        status: 'Incidencia',
                        tone: 'bad',
                    },
                ],
                footer: 'Líneas pickeadas hoy · 2,140',
            },
            {
                label: 'Despacho',
                icon: Truck,
                headline: 'Consolidado por tienda, listo para salir',
                blurb: 'Packing por destino, guías de remisión y programación de carga de vehículos.',
                rows: [
                    {
                        title: 'Consolidado Miraflores',
                        subtitle: '9 bultos · 412 kg',
                        status: 'Listo',
                        tone: 'ok',
                    },
                    {
                        title: 'Guía T001-0230',
                        subtitle: 'Transportes Rápido SAC',
                        status: 'Emitida',
                        tone: 'ok',
                    },
                    {
                        title: 'Unidad ABC-123',
                        subtitle: 'Carga al 70% · salida 14:00',
                        status: 'Cargando',
                        tone: 'info',
                    },
                ],
                footer: 'Despachos de hoy · 11 salidas',
            },
            {
                label: 'Inventarios',
                icon: ClipboardCheck,
                headline: 'El conteo físico cuadra con el sistema',
                blurb: 'Conteos cíclicos por zona, conciliación y ajustes con aprobación.',
                rows: [
                    {
                        title: 'Conteo zona A',
                        subtitle: '420 de 420 ubicaciones',
                        status: 'Cuadrado',
                        tone: 'ok',
                    },
                    {
                        title: 'Conteo zona C',
                        subtitle: 'Diferencia en 3 ubicaciones',
                        status: 'Por conciliar',
                        tone: 'warn',
                    },
                    {
                        title: 'Ajuste AJ-0041',
                        subtitle: 'Merma por rotura · 6 unidades',
                        status: 'Por aprobar',
                        tone: 'info',
                    },
                ],
                footer: 'Exactitud de inventario · 99.2%',
            },
        ],
    },

    hcm: {
        key: 'hcm',
        name: 'RR. HH.',
        fullName: 'Gestión de personas',
        icon: Users,
        modules: [
            {
                label: 'Personal',
                icon: UserRound,
                headline: 'Cada colaborador con su legajo al día',
                blurb: 'Contratos, puestos y estructura organizacional de todas las tiendas, en un solo lugar.',
                rows: [
                    {
                        title: 'Rosa Quispe',
                        subtitle: 'Cajera · Miraflores · plazo fijo',
                        status: 'Vigente',
                        tone: 'ok',
                    },
                    {
                        title: 'Luis Ramos',
                        subtitle: 'Operario de almacén · CD Lurín',
                        status: 'Vigente',
                        tone: 'ok',
                    },
                    {
                        title: 'Mario Salas',
                        subtitle: 'Reponedor · Surco · contrato vence en 12 días',
                        status: 'Por renovar',
                        tone: 'warn',
                    },
                ],
                footer: 'Colaboradores activos · 186',
            },
            {
                label: 'Asistencia',
                icon: Clock,
                headline: 'Turnos cubiertos y marcaciones al día',
                blurb: 'Marcación biométrica o por app, turnos por tienda, tardanzas, horas extra y permisos.',
                rows: [
                    {
                        title: 'Turno mañana · Miraflores',
                        subtitle: '8 de 8 marcaciones',
                        status: 'Completo',
                        tone: 'ok',
                    },
                    {
                        title: 'Carlos Vega',
                        subtitle: 'Ingreso 06:12 · 12 minutos de tardanza',
                        status: 'Tardanza',
                        tone: 'warn',
                    },
                    {
                        title: 'Permiso P-0231',
                        subtitle: 'Ana Torres · 2 días',
                        status: 'Por aprobar',
                        tone: 'info',
                    },
                ],
                footer: 'Asistencia de hoy · 94%',
            },
            {
                label: 'Planilla',
                icon: Banknote,
                headline: 'La boleta de pago correcta, a tiempo',
                blurb: 'Remuneraciones, gratificaciones, CTS y vacaciones, con envío de boletas electrónicas.',
                rows: [
                    {
                        title: 'Planilla septiembre 2026',
                        subtitle: '186 colaboradores · S/ 412,300.00',
                        status: 'Calculada',
                        tone: 'ok',
                    },
                    {
                        title: 'PLAME 09-2026',
                        subtitle: 'Listo para declarar',
                        status: 'Listo',
                        tone: 'info',
                    },
                    {
                        title: 'Boletas de pago',
                        subtitle: '180 de 186 enviadas',
                        status: 'Enviando',
                        tone: 'warn',
                    },
                ],
                footer: 'Próximo pago · 30 de octubre',
            },
            {
                label: 'Desempeño',
                icon: Target,
                headline: 'Metas de tienda que se vuelven bonos',
                blurb: 'Comisiones, bonos por meta de tienda y evaluaciones periódicas de desempeño.',
                rows: [
                    {
                        title: 'Meta Miraflores · Septiembre',
                        subtitle: '112% de la meta de ventas',
                        status: 'Superada',
                        tone: 'ok',
                    },
                    {
                        title: 'Evaluación semestral',
                        subtitle: 'Surco · 14 de 22 completadas',
                        status: 'En curso',
                        tone: 'info',
                    },
                    {
                        title: 'Bono por meta · San Borja',
                        subtitle: '96% de avance',
                        status: 'Casi',
                        tone: 'warn',
                    },
                ],
                footer: 'Bonos del mes · S/ 8,450.00',
            },
            {
                label: 'Seguridad',
                icon: HardHat,
                headline: 'Seguridad y salud en cada turno',
                blurb: 'Exámenes médicos, incidentes y entrega de EPP y uniformes, con seguimiento.',
                rows: [
                    {
                        title: 'Examen médico periódico',
                        subtitle: 'Rosa Quispe · vence en 15 días',
                        status: 'Por vencer',
                        tone: 'warn',
                    },
                    {
                        title: 'Incidente INC-0017',
                        subtitle: 'Resbalón en almacén · sin lesiones',
                        status: 'Cerrado',
                        tone: 'ok',
                    },
                    {
                        title: 'Entrega de EPP',
                        subtitle: 'Luis Ramos · guantes y faja lumbar',
                        status: 'Entregado',
                        tone: 'ok',
                    },
                ],
                footer: 'Incidentes del mes · 1',
            },
        ],
    },

    crm: {
        key: 'crm',
        name: 'CRM',
        fullName: 'Clientes y fidelización',
        icon: Heart,
        modules: [
            {
                label: 'Clientes',
                icon: Users,
                headline: 'Un cliente, todas sus compras',
                blurb: 'Base única de clientes con historial de compras y segmentación por comportamiento.',
                rows: [
                    {
                        title: 'Marisol Paredes',
                        subtitle: '38 compras · S/ 2,140.00 acumulados',
                        status: 'Frecuente',
                        tone: 'ok',
                    },
                    {
                        title: 'Jorge Salinas',
                        subtitle: 'Última compra hace 45 días',
                        status: 'En riesgo',
                        tone: 'warn',
                    },
                    {
                        title: 'Segmento · Campeones',
                        subtitle: '212 clientes',
                        status: 'Segmento',
                        tone: 'info',
                    },
                ],
                footer: 'Clientes registrados · 18,420',
            },
            {
                label: 'Puntos',
                icon: Star,
                headline: 'Cada compra suma, cada punto cuenta',
                blurb: 'Acumulación y canje de puntos con niveles Bronce, Plata y Oro, por DNI o celular.',
                rows: [
                    {
                        title: 'Marisol Paredes',
                        subtitle: '1,240 puntos acumulados',
                        status: 'Nivel Oro',
                        tone: 'warn',
                    },
                    {
                        title: 'Canje CJ-0092',
                        subtitle: 'Aceite 1 L por 800 puntos',
                        status: 'Canjeado',
                        tone: 'ok',
                    },
                    {
                        title: 'Jorge Salinas',
                        subtitle: '180 puntos acumulados',
                        status: 'Nivel Bronce',
                        tone: 'info',
                    },
                ],
                footer: 'Puntos canjeados este mes · 96,400',
            },
            {
                label: 'Campañas',
                icon: Megaphone,
                headline: 'Mensajes que llegan al cliente correcto',
                blurb: 'Cupones segmentados por WhatsApp, SMS y correo según el comportamiento de compra.',
                rows: [
                    {
                        title: 'Cupón 15% en lácteos',
                        subtitle: 'WhatsApp · 1,240 clientes',
                        status: 'Enviada',
                        tone: 'ok',
                    },
                    {
                        title: 'Te extrañamos',
                        subtitle: 'SMS · clientes inactivos hace 30 días',
                        status: 'Programada',
                        tone: 'info',
                    },
                    {
                        title: 'Promo de fin de mes',
                        subtitle: 'Correo · sin enviar',
                        status: 'Borrador',
                        tone: 'warn',
                    },
                ],
                footer: 'Cupones canjeados · 18% de los enviados',
            },
            {
                label: 'Reclamos',
                icon: MessageSquareWarning,
                headline: 'Cada reclamo atendido y a la vista',
                blurb: 'Libro de reclamaciones digital con seguimiento hasta la respuesta al cliente.',
                rows: [
                    {
                        title: 'Reclamo LR-0058',
                        subtitle: 'Producto vencido · Surco',
                        status: 'Abierto',
                        tone: 'bad',
                    },
                    {
                        title: 'Reclamo LR-0057',
                        subtitle: 'Demora en caja · Miraflores',
                        status: 'En atención',
                        tone: 'warn',
                    },
                    {
                        title: 'Reclamo LR-0054',
                        subtitle: 'Cobro duplicado · respondido al cliente',
                        status: 'Resuelto',
                        tone: 'ok',
                    },
                ],
                footer: 'Tiempo medio de respuesta · 2 días',
            },
            {
                label: 'Encuestas',
                icon: Smile,
                headline: 'Escucha lo que dicen tus clientes',
                blurb: 'Encuestas de satisfacción y NPS después de cada compra.',
                rows: [
                    {
                        title: 'NPS Miraflores',
                        subtitle: 'Septiembre · 214 respuestas',
                        status: 'Excelente',
                        tone: 'ok',
                    },
                    {
                        title: 'NPS Surco',
                        subtitle: 'Septiembre · 160 respuestas',
                        status: 'Regular',
                        tone: 'warn',
                    },
                    {
                        title: 'Comentario reciente',
                        subtitle: 'Caja rápida y buena atención',
                        status: 'Positivo',
                        tone: 'ok',
                    },
                ],
                footer: 'Satisfacción promedio · 4.6 de 5',
            },
        ],
    },

    ecommerce: {
        key: 'ecommerce',
        name: 'E-commerce',
        fullName: 'Tienda virtual y delivery',
        icon: ShoppingBag,
        modules: [
            {
                label: 'Tienda',
                icon: Store,
                headline: 'Tu catálogo online, siempre con stock real',
                blurb: 'Productos sincronizados con el inventario, con carrito y checkout en la tienda virtual.',
                rows: [
                    {
                        title: 'Arroz extra 5 kg',
                        subtitle: 'Stock sincronizado: 120 u · S/ 24.90',
                        status: 'Visible',
                        tone: 'ok',
                    },
                    {
                        title: 'Gaseosa 2.5 L',
                        subtitle: 'Stock sincronizado: 0 u',
                        status: 'Agotado',
                        tone: 'bad',
                    },
                    {
                        title: 'Combo desayuno',
                        subtitle: 'Publicado hoy · S/ 9.90',
                        status: 'Nuevo',
                        tone: 'info',
                    },
                ],
                footer: 'Productos publicados · 3,960',
            },
            {
                label: 'Pedidos',
                icon: ClipboardList,
                headline: 'Todos los pedidos, en un solo lugar',
                blurb: 'Web, WhatsApp y plataformas como Rappi y PedidosYa entran a la misma cola.',
                rows: [
                    {
                        title: 'Pedido W-1042',
                        subtitle: 'Tienda virtual · S/ 86.40',
                        status: 'Nuevo',
                        tone: 'info',
                    },
                    {
                        title: 'Pedido WA-0318',
                        subtitle: 'WhatsApp · S/ 54.00',
                        status: 'Confirmado',
                        tone: 'ok',
                    },
                    {
                        title: 'Pedido RP-7731',
                        subtitle: 'Rappi · S/ 41.90',
                        status: 'Por aceptar',
                        tone: 'warn',
                    },
                ],
                footer: 'Pedidos de hoy · 64',
            },
            {
                label: 'Preparación',
                icon: PackageCheck,
                headline: 'Pedidos listos antes de que lleguen por ellos',
                blurb: 'Cola de preparación en tienda para delivery y recojo.',
                rows: [
                    {
                        title: 'Pedido W-1039',
                        subtitle: 'Preparando · 8 de 12 productos',
                        status: 'En proceso',
                        tone: 'info',
                    },
                    {
                        title: 'Pedido W-1037',
                        subtitle: 'Recojo en tienda · 15:40',
                        status: 'Listo',
                        tone: 'ok',
                    },
                    {
                        title: 'Pedido W-1035',
                        subtitle: 'Falta 1 producto: yogur 1 L',
                        status: 'Sin stock',
                        tone: 'warn',
                    },
                ],
                footer: 'Tiempo de preparación · 11 min',
            },
            {
                label: 'Delivery',
                icon: Bike,
                headline: 'Repartidores asignados por zona',
                blurb: 'Zonas, tarifas y asignación de repartidores, con seguimiento en tiempo real.',
                rows: [
                    {
                        title: 'Zona Miraflores',
                        subtitle: 'Tarifa S/ 5.00 · 3 repartidores activos',
                        status: 'Activa',
                        tone: 'ok',
                    },
                    {
                        title: 'Pedido W-1031',
                        subtitle: 'Diego · llega en 8 minutos',
                        status: 'En camino',
                        tone: 'info',
                    },
                    {
                        title: 'Pedido W-1029',
                        subtitle: 'Entregado a las 14:52',
                        status: 'Entregado',
                        tone: 'ok',
                    },
                ],
                footer: 'Entregas de hoy · 41',
            },
            {
                label: 'Pagos',
                icon: CreditCard,
                headline: 'Cobros online conciliados con cada pedido',
                blurb: 'Pasarela de pagos integrada, con confirmación automática del pedido.',
                rows: [
                    {
                        title: 'Pago #8841',
                        subtitle: 'Tarjeta · S/ 86.40',
                        status: 'Aprobado',
                        tone: 'ok',
                    },
                    {
                        title: 'Pago #8840',
                        subtitle: 'Yape · S/ 54.00',
                        status: 'Aprobado',
                        tone: 'ok',
                    },
                    {
                        title: 'Pago #8838',
                        subtitle: 'Tarjeta · S/ 120.00',
                        status: 'Rechazado',
                        tone: 'bad',
                    },
                ],
                footer: 'Cobrado hoy · S/ 3,540.20',
            },
        ],
    },

    bi: {
        key: 'bi',
        name: 'BI',
        fullName: 'Analítica del negocio',
        icon: BarChart3,
        modules: [
            {
                label: 'Ventas',
                icon: TrendingUp,
                headline: 'Qué se vende, dónde y a qué hora',
                blurb: 'Ventas por tienda, hora del día, categoría de producto y cajero.',
                rows: [
                    {
                        title: 'Hora pico',
                        subtitle: 'Miraflores · 6:00 – 7:00 p. m.',
                        status: 'Hora pico',
                        tone: 'info',
                    },
                    {
                        title: 'Categoría líder',
                        subtitle: 'Abarrotes · 38% de las ventas',
                        status: 'Abarrotes',
                        tone: 'ok',
                    },
                    {
                        title: 'Mejor cajera',
                        subtitle: 'Rosa Quispe · 212 ventas hoy',
                        status: 'Top',
                        tone: 'ok',
                    },
                ],
                footer: 'Ventas del mes · S/ 284,900.00',
            },
            {
                label: 'Inventario',
                icon: Boxes,
                headline: 'Rotación a la vista y quiebres a tiempo',
                blurb: 'Rotación de stock, días de inventario, quiebres y control de mermas.',
                rows: [
                    {
                        title: 'Rotación en abarrotes',
                        subtitle: '18 días de inventario',
                        status: 'Sana',
                        tone: 'ok',
                    },
                    {
                        title: 'Quiebres de la semana',
                        subtitle: '14 SKU sin stock · 3 tiendas',
                        status: 'Atención',
                        tone: 'warn',
                    },
                    {
                        title: 'Mermas en lácteos',
                        subtitle: '2.1% de lo comprado',
                        status: 'Alta',
                        tone: 'bad',
                    },
                ],
                footer: 'Días de inventario · 24',
            },
            {
                label: 'Rentabilidad',
                icon: Percent,
                headline: 'Margen real por producto y por sucursal',
                blurb: 'Costo contra precio por producto, categoría y sucursal.',
                rows: [
                    {
                        title: 'Margen en bebidas',
                        subtitle: '31.4% · +1.2 puntos vs. agosto',
                        status: 'Sube',
                        tone: 'ok',
                    },
                    {
                        title: 'Margen en abarrotes',
                        subtitle: '14.8% · −0.6 puntos vs. agosto',
                        status: 'Baja',
                        tone: 'warn',
                    },
                    {
                        title: 'Sucursal Surco',
                        subtitle: 'Margen bruto 22.1%',
                        status: 'Estable',
                        tone: 'info',
                    },
                ],
                footer: 'Margen bruto del mes · 21.3%',
            },
            {
                label: 'Operaciones',
                icon: Gauge,
                headline: 'Productividad por tienda y por turno',
                blurb: 'Cumplimiento de reposición y despachos en cada operación.',
                rows: [
                    {
                        title: 'Turno mañana',
                        subtitle: 'Miraflores · 38 ventas por hora',
                        status: 'Meta cumplida',
                        tone: 'ok',
                    },
                    {
                        title: 'Reposición a tiempo',
                        subtitle: 'Surco · 82% de los pedidos',
                        status: 'Bajo la meta',
                        tone: 'warn',
                    },
                    {
                        title: 'Despachos del almacén central',
                        subtitle: '96% entregados a tiempo',
                        status: 'Bien',
                        tone: 'ok',
                    },
                ],
                footer: 'Cumplimiento general · 91%',
            },
            {
                label: 'Gerencial',
                icon: LayoutDashboard,
                headline: 'Presupuesto contra real, sin esperar al cierre',
                blurb: 'Dashboards ejecutivos, alertas y KPIs por sucursal.',
                rows: [
                    {
                        title: 'Ventas vs. presupuesto',
                        subtitle: 'Septiembre · 103% del objetivo',
                        status: 'Sobre meta',
                        tone: 'ok',
                    },
                    {
                        title: 'Gastos operativos',
                        subtitle: 'Septiembre · 108% del presupuesto',
                        status: 'Excedido',
                        tone: 'bad',
                    },
                    {
                        title: 'Alerta de sucursal',
                        subtitle: 'San Borja · ventas −9% en la semana',
                        status: 'Alerta',
                        tone: 'warn',
                    },
                ],
                footer: 'Sucursales sobre la meta · 8 de 12',
            },
        ],
    },
};

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
