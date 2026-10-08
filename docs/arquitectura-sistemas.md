# Arquitectura de sistemas para la cadena de minimarkets

Catálogo funcional de la suite: qué sistemas hay, qué módulos y submódulos tiene cada uno, **quién es dueño de cada dato** y cómo se hablan entre sí.

## Cómo leer este documento

- Los nombres de **sistemas, módulos y submódulos** de las secciones 4 (POS a BI) y 5 (Configuraciones) son los del menú de la aplicación (`Frontend/src/lib/navigation.ts`) y los del catálogo de permisos (`backend/internal/permission/catalog_*.go`). Lo que se agregue aquí y se construya debe agregarse también en esos dos lugares.
- Cada módulo lleva su estado:
  - **[Hecho]** construido y probado.
  - **[Parcial]** una parte está construida (se indica cuál).
  - **[Pendiente]** está en el menú pero todavía no tiene pantalla.
  - **[Propuesto]** está en este documento pero **no** en el menú: falta decidirlo.
- Las reglas técnicas del backend están en [`arquitectura-backend.md`](arquitectura-backend.md) y las del frontend en [`arquitectura-frontend.md`](arquitectura-frontend.md).

---

## 1. Visión general

Una suite integrada para una cadena de minimarkets: del mostrador a la contabilidad, pasando por el almacén, la reposición, el personal y el cliente.

| Sistema | Para qué sirve | Estado |
|---|---|---|
| **POS** | Vender en tienda, cobrar, manejar la caja y emitir comprobantes | Pendiente |
| **ERP** | Núcleo administrativo: catálogo, inventario, compras, ventas B2B, finanzas, activos | Parcial (Productos) |
| **SCM** | Prever la demanda y reponer: de la tienda al centro de distribución y de este al proveedor | Pendiente |
| **WMS** | Operar el centro de distribución: recepción, ubicación, picking y despacho | Pendiente |
| **HCM / RR. HH.** | Personal, asistencia, turnos, planilla y seguridad laboral | Pendiente |
| **CRM** | Clientes, fidelización, campañas y atención | Pendiente |
| **BI** | Indicadores y reportes para la gerencia | Pendiente |
| **Configuraciones** | Usuarios, roles y permisos, empresa y sucursales, terminales, auditoría, integraciones | Parcial |

Además, dos sistemas **propuestos** (sección 6): **MDM** (datos maestros) y **TMS** (transporte), y uno **para el final**: **E-commerce** (sección 7).

```text
                  ┌──────────────────────────────────┐
                  │       BI · Gerencia y KPIs       │
                  └──────────────────────────────────┘
                                    ▲
                                    │ lee de todos (solo lectura)
┌──────────────────────────────────────────────────────────────────────┐
│                         MDM · Datos maestros                         │
│        productos · precios · tiendas · proveedores · clientes        │
│         (propuesto: hoy lo cumple ERP › Catálogo y maestros)         │
└──────────────────────────────────────────────────────────────────────┘
      │              │              │              │              │
      ▼              ▼              ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│   POS    │   │   ERP    │   │   SCM    │   │   CRM    │   │   HCM    │
│  venta   │──►│  núcleo  │◄─►│reposición│   │ cliente  │   │ personal │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
      │              │
      ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│E-commerce│   │   WMS    │   │   TMS    │
│(al final)│   │    CD    │──►│transporte│ ─► tiendas (reposición)
└──────────┘   └──────────┘   └──────────┘

Propuestos: MDM y TMS · Para el final: E-commerce
HCM: la planilla genera asientos en el ERP · CRM: recibe del POS las compras y los puntos

Transversal a todos: Configuraciones (usuarios, roles y permisos, empresa,
sucursales, almacenes, terminales, auditoría, integraciones)
```

---

## 2. Principios de arquitectura

Lo que decide si la suite crece ordenada o se llena de duplicados. Pesa más que la cantidad de módulos.

1. **Una fuente de verdad por dato.** Cada dato tiene un solo sistema dueño (sección 3); los demás lo consultan, no guardan su propia copia. Si el POS y el ERP guardaran cada uno "su" producto, tarde o temprano dirían precios distintos.
2. **Un solo inventario.** Hay un único libro de existencias por sucursal y almacén (ERP › Inventario, con su kardex). El POS no lleva inventario propio: descuenta del ERP. El WMS agrega la **ubicación física** dentro de un almacén y reporta sus movimientos al mismo libro.
3. **Un solo emisor de comprobantes.** La comunicación con SUNAT (XML, CDR, contingencia) es un servicio único que usan el POS (boletas y facturas del mostrador) y el ERP (ventas B2B, guías de remisión, notas).
4. **Empresa → sucursal → almacén, caja y personal.** Todo lo que se vende, se cuenta o se mueve queda registrado con su sucursal. Una sucursal no es una caja ni un sistema: es un lugar físico (ver sección 5.3). Un centro de distribución es una sucursal que no vende.
5. **Permisos jerárquicos.** Cada acción es `sistema.módulo.submódulo.acción` y se puede dar en cualquier nivel; cada submódulo declara sus propias acciones (aprobar, solicitar, programar…). Un usuario hereda los de sus roles y puede recibir permisos directos o denegaciones. Además, cada usuario trabaja solo en las sucursales que se le asignan.
6. **Integración por contratos, no por copias.** Hoy los sistemas comparten base de datos y API; las dependencias entre submódulos se declaran explícitamente en el código. A futuro, los hechos relevantes (venta cerrada, recepción confirmada) se publicarán como eventos para que SCM, CRM y BI reaccionen sin acoplarse.
7. **Auditoría.** Toda escritura relevante debe poder responder quién, cuándo y qué cambió (Configuraciones › Auditoría).

---

## 3. Fuente de verdad: quién es dueño de cada dato

| Dato | Sistema dueño | Lo consultan | Nota |
|---|---|---|---|
| Producto, código de barras, categoría, unidad, impuestos | **ERP › Catálogo y maestros** (hoy hace de MDM) | POS, SCM, WMS, CRM, BI | Ver sección 6 sobre separarlo como MDM |
| Precio y lista de precios | **ERP › Catálogo y maestros** | POS | El POS aplica promociones y precios por sucursal, pero no los define |
| Venta, comprobante de venta, caja, turno de caja | **POS** | ERP (contabiliza), CRM, BI | |
| Cliente (identidad, contacto, segmento, consentimientos) | **CRM** | POS, ERP (B2B), BI | El ERP guarda al cliente B2B como cuenta comercial enlazada al mismo cliente |
| Proveedor (RUC, condiciones, contratos) | **ERP › Catálogo y maestros** | SCM, WMS | SCM guarda **desempeño** (lead time, cumplimiento), no el maestro |
| Compra (requerimiento, orden, factura del proveedor) | **ERP › Compras** | SCM (sugiere), WMS (recibe) | SCM propone; el ERP formaliza |
| Existencias por sucursal y almacén, kardex, costo | **ERP › Inventario** | POS, SCM, WMS, BI | El libro único |
| Ubicación física, lote y vencimiento dentro de un almacén | **WMS** | ERP | Reporta sus movimientos al libro de existencias |
| Demanda, pronóstico, stock mínimo/máximo, pedido sugerido | **SCM** | ERP, BI | |
| Picking, packing, despacho desde el CD | **WMS** | ERP, SCM | |
| Transferencia entre sucursales | **ERP** crea el documento, **WMS** ejecuta el movimiento físico | SCM, BI | |
| Transporte: ruta, vehículo, conductor, entrega | **TMS** (mientras no exista, SCM › Distribución y transporte) | WMS, SCM, BI | El TMS devuelve a SCM el lead time real |
| Contabilidad, cuentas por cobrar y por pagar, tesorería | **ERP › Finanzas** | BI | |
| Activo fijo | **ERP › Activos fijos** | BI | |
| Colaborador, contrato, asistencia, planilla | **HCM** | ERP (asiento de planilla), BI | |
| Usuario, rol, permiso, sucursal asignada | **Configuraciones** | Todos | |
| Empresa, sucursal, almacén, terminal, serie de comprobantes | **Configuraciones** | Todos | |
| Indicadores y reportes | **BI** | Gerencia | Solo lee; nunca escribe en los demás |

---

## 4. Sistemas

### 4.1 POS — Punto de venta

El mostrador. Vende rápido, cobra, cuadra la caja y emite el comprobante. No define productos ni precios ni lleva inventario propio (principio 1 y 2).

#### 4.1.1 Ventas — [Pendiente]
- **Venta rápida**: código de barras, balanza (venta por peso), búsqueda por nombre, productos combo
- **Venta con cliente**: boleta o factura, identificación por DNI, RUC o celular
- **Venta a crédito**: plazos y cobranza
- **Ventas en espera**: carrito suspendido y recuperación de la venta
- **Cotizaciones** (propuesto): presupuesto al cliente que puede convertirse en venta

#### 4.1.2 Facturación electrónica — [Pendiente]
- Comprobantes: boletas, facturas, notas de crédito y de débito
- Envío a SUNAT (OSE/PSE): XML, CDR, PDF
- Contingencia y reenvío de comprobantes
- Usa el servicio único de emisión (principio 3)

#### 4.1.3 Caja — [Pendiente]
- Apertura y cierre de caja por turno
- Arqueo y diferencias de caja (sobrantes y faltantes)
- Ingresos y retiros de efectivo, fondos de caja
- Cuadre por turno y por cajero

#### 4.1.4 Medios de pago — [Pendiente]
- Efectivo y tarjetas (terminal físico o integrado)
- Yape y Plin, pagos por QR, transferencias
- Pago mixto (varios medios en una venta)
- Conciliación por medio de pago

#### 4.1.5 Promociones y precios — [Pendiente]
- Descuentos por monto o porcentaje; por cantidad (escalas por volumen)
- 2x1, 3x2, combos y paquetes
- Precio especial por horario, por sucursal o por cliente
- Cupones y códigos promocionales

#### 4.1.6 Devoluciones y anulaciones — [Pendiente]
- Devolución con nota de crédito
- Anulación con autorización por rol o permiso
- Motivos y justificación obligatorios

#### 4.1.7 Seguridad y configuración — [Pendiente]
- Usuarios y roles (se administran en Configuraciones; aquí se asignan a cajas)
- Terminales y series de comprobantes
- Modo offline y sincronización al recuperar la conexión

#### 4.1.8 Turnos y operadores — [Propuesto]
- Cajeros y supervisores del turno
- Operaciones que requieren autorización de un supervisor (anular, descuento mayor al tope)
- Historial de operaciones por operador

#### 4.1.9 Operación de tienda — [Propuesto]
- Apertura y cierre de tienda
- Incidencias del día y control de efectivo de la tienda
- Estado de terminales y cajas

---

### 4.2 ERP — Gestión empresarial

El núcleo administrativo y financiero. Es dueño del catálogo, del inventario y de la contabilidad.

#### 4.2.1 Catálogo y maestros — [Parcial]
- **Productos**: SKU, códigos de barras, categorías, marcas, unidad, impuestos, precio, estado — **[Hecho]**
- **Unidades y presentaciones**: unidades de medida y equivalencias (caja, docena, bolsa) — solo la lista de consulta; el mantenimiento y las presentaciones están **[Pendiente]**
- **Proveedores y clientes**: maestro completo, condiciones comerciales, plazos y créditos, contratos — [Pendiente]
- **Sucursales y almacenes**: se administran en Configuraciones › Empresa y sucursales; el ERP las consume (ver sección 8, punto 4)
- **Listas de precios**: por cliente, grupo, sucursal o temporada — [Pendiente]
- Productos por sucursal y por categoría (qué se vende dónde) — [Propuesto]

#### 4.2.2 Inventario — [Pendiente] (siguiente módulo previsto)
- **Stock por sucursal, almacén y lote**: el libro único de existencias
- **Kardex valorizado**: costo y valoración en tiempo real
- **Control de vencimientos (FEFO)**: el primero en vencer es el primero en salir
- **Transferencias entre sucursales**: solicitar, aprobar, enviar, recibir y anular
- **Ajustes y mermas**: pérdidas por causa, con aprobación
- **Inventario cíclico**: conteos programados y conciliación

#### 4.2.3 Compras — [Pendiente]
- **Requerimientos**: solicitud interna de productos
- **Cotizaciones**: comparación de proveedores y aprobaciones
- **Órdenes de compra**: pedido formal; enviar y anular
- **Recepción de mercadería**: contra orden, parcial o total
- **Facturas de proveedores** (propuesto): registro y cruce con la orden y la recepción
- **Devoluciones a proveedor**: garantías y reclamos
- **Costeo**: promedio móvil y costo último

#### 4.2.4 Ventas y distribución — [Pendiente]
- **Ventas mayoristas (B2B)**: pedidos por cuenta corporativa
- **Cotizaciones y pedidos**: presupuestos formales y su aprobación
- **Guías de remisión electrónicas**: documentos de traslado
- **Cuentas por cobrar**: cartera, cobros y estado de cuenta

#### 4.2.5 Finanzas y contabilidad — [Pendiente]
- **Contabilidad general**: plan contable, libro diario y mayor, cierre contable, estados financieros
- **Cuentas por pagar**: deudas con proveedores y programación de pagos
- **Tesorería y bancos**: cuentas bancarias, transferencias, cobros y pagos, caja central, flujo de caja
- **Conciliación bancaria**: movimientos contra extractos
- **Centros de costo**: por sucursal y por área
- **Libros electrónicos (PLE) e impuestos**: IGV y renta

#### 4.2.6 Activos fijos — [Pendiente]
- **Registro de activos** por sucursal; traslados y bajas
- **Depreciación**: por método (lineal, decreciente)
- **Mantenimiento**: historial y programación

#### 4.2.7 Administración del sistema — [Pendiente] (ver sección 8, punto 4)
- **Multiempresa y multisucursal**
- **Roles y auditoría**
- **Integraciones**: SUNAT, bancos, APIs

#### 4.2.8 Presupuesto y control de gestión — [Propuesto]
- Presupuesto anual, por tienda, por área y por centro de costo
- Ejecución presupuestal y variaciones
- Aprobaciones de gasto por nivel

---

### 4.3 SCM — Cadena de suministro y reposición

Decide **qué y cuánto** reponer; el ERP formaliza la compra y el WMS la recibe.

#### 4.3.1 Planeación de la demanda — [Pendiente]
- **Pronóstico por SKU y sucursal**: a partir del historial, con tendencias
- **Estacionalidad y eventos**: campañas, feriados, clima
- **Rotación ABC**: clasificación por movimiento y por margen

#### 4.3.2 Reposición — [Pendiente]
- **Stock mínimo, máximo, punto de pedido y stock de seguridad**
- **Pedido sugerido por tienda**: reposición tienda → centro de distribución
- **Alertas de quiebre y de sobrestock**

#### 4.3.3 Abastecimiento — [Pendiente]
- **Pedido sugerido a proveedores**: reposición centro de distribución → proveedor; consolidación de pedidos y compras por volumen
- **Lead times**: tiempo de entrega real por proveedor
- **Evaluación de proveedores**: cumplimiento (fill rate), calidad, costo y ranking
- Calendario de compras y plan de abastecimiento — [Propuesto]

#### 4.3.4 Distribución y transporte — [Pendiente]
- **Rutas y despachos**: planificación de rutas
- **Flota y transportistas**: vehículos y conductores
- **Seguimiento de entregas**: estado y evidencia de entrega
- **Costos logísticos**
- Con el TMS (sección 6.2) este módulo queda solo con la planificación; el traslado y la entrega pasan al TMS

#### 4.3.5 Control de mermas y calidad — [Pendiente]
- **Mermas por causa**: pérdida, robo, deterioro
- **Productos por vencer**: alertas y acciones
- **Reclamos a proveedores**

#### 4.3.6 Planificación y proyección — [Propuesto]
- Inventario proyectado y quiebres previstos
- Plan maestro de abastecimiento y capacidad del centro de distribución
- (MRP solo si algún día se produce o se arman productos propios)

---

### 4.4 WMS — Almacén central y centros de distribución

Opera el movimiento físico. El stock "oficial" sigue en el ERP; el WMS sabe **dónde está** y lo mueve.

#### 4.4.1 Estructura del almacén — [Pendiente]
- **Zonas, pasillos, racks, niveles y ubicaciones**
- **Capacidades y tipos**: seco, refrigerado, congelado, peligroso

#### 4.4.2 Recepción — [Pendiente]
- **Citas de recepción**: calendario de llegadas de proveedores
- **Verificación contra orden de compra**: parcial o total, cantidades, control de calidad
- **Etiquetado de lote y vencimiento**

#### 4.4.3 Almacenamiento — [Pendiente]
- **Ubicación sugerida (put-away)**
- **Reubicaciones**
- **Stock por ubicación**

#### 4.4.4 Picking — [Pendiente]
- **Por orden, ola, zona o ruta**
- **Con handheld o scanner** (código de barras)
- **Reposición de la zona de picking**

#### 4.4.5 Packing y despacho — [Pendiente]
- **Consolidación por tienda**
- **Guías de remisión**
- **Carga y salida de vehículos**, confirmación de entrega

#### 4.4.6 Inventarios — [Pendiente]
- **Conteos cíclicos** e inventario físico
- **Conciliación y ajustes**: diferencias, lotes y series

#### 4.4.7 Devoluciones (logística inversa) — [Pendiente]
- **Retorno desde tiendas**
- **Clasificación**: reingreso, merma o devolución al proveedor

#### 4.4.8 Transferencias físicas — [Propuesto]
- Ejecución de transferencias CD → tienda, tienda → CD, CD → CD e internas (el documento lo crea el ERP)

---

### 4.5 HCM — Recursos humanos

Una cadena grande tiene muchísimo personal operativo: cajeros, reponedores, supervisores y logística.

#### 4.5.1 Administración de personal — [Pendiente]
- **Legajo y contratos**: datos personales y laborales, documentos
- **Estructura y puestos**: cargos, áreas y tiendas asignadas
- **T-Registro**

#### 4.5.2 Asistencia y turnos — [Pendiente]
- **Marcación**: biométrico, app o reloj
- **Turnos por tienda**: horarios, rotaciones, descansos, cambios de turno y cobertura
- **Horas extra, tardanzas y faltas**
- **Permisos y licencias**

#### 4.5.3 Planilla — [Pendiente]
- **Remuneraciones y descuentos**, bonificaciones, quinta categoría
- **Gratificaciones, CTS y vacaciones**
- **PLAME, AFP/ONP y EsSalud**
- **Boletas de pago electrónicas**
- **Liquidaciones**

#### 4.5.4 Compensaciones y desempeño — [Pendiente]
- **Comisiones y bonos** por meta de tienda
- **Evaluación de desempeño**: objetivos y plan de carrera

#### 4.5.5 Reclutamiento y capacitación — [Pendiente]
- **Vacantes y postulantes**: evaluaciones, entrevistas y contratación
- **Onboarding**
- **Capacitaciones y certificaciones**

#### 4.5.6 Seguridad y salud ocupacional — [Pendiente]
- **Exámenes médicos** y descansos médicos
- **Incidentes y accidentes**
- **Entrega de EPP y uniformes**

---

### 4.6 CRM — Clientes y fidelización

Aquí una cadena puede diferenciarse de las demás. El CRM es dueño del cliente.

#### 4.6.1 Clientes — [Pendiente]
- **Base única de clientes**: registro, perfil, contacto, preferencias y consentimientos
- **Segmentación**
- **Historial de compras**

#### 4.6.2 Programa de puntos — [Pendiente]
- **Acumulación y canje**; recompensas y cashback
- **Niveles y beneficios**
- **Identificación por DNI o celular**

#### 4.6.3 Campañas — [Pendiente]
- **Cupones segmentados**
- **WhatsApp, SMS y email** (y notificaciones push); automatizaciones
- **Promociones por comportamiento**: ofertas personalizadas

#### 4.6.4 Atención al cliente — [Pendiente]
- **Reclamos y libro de reclamaciones**
- **Encuestas de satisfacción** (NPS)
- Consultas, sugerencias y tickets con seguimiento — [Propuesto]

#### 4.6.5 Analítica de clientes — [Propuesto]
- RFM, frecuencia de compra, ticket promedio, productos favoritos
- Clientes nuevos y recurrentes, abandono (churn), segmentos
- Los indicadores se publican hacia BI

---

### 4.7 BI — Inteligencia de negocio

Solo lee de los demás sistemas; nunca escribe en ellos.

#### 4.7.1 Ventas — [Pendiente]
- Por tienda, por hora y categoría, por SKU y cajero

#### 4.7.2 Inventario — [Pendiente]
- Rotación y días de inventario, quiebres, mermas

#### 4.7.3 Rentabilidad — [Pendiente]
- Margen por producto y por sucursal

#### 4.7.4 Operaciones — [Pendiente]
- Productividad por tienda y turno
- Cumplimiento de reposición y despachos

#### 4.7.5 Gerencial — [Pendiente]
- **Dashboards ejecutivos**
- **Alertas y KPIs por sucursal**
- **Presupuesto vs. real**

#### 4.7.6 Vistas por área — [Propuesto]
Compras, finanzas, clientes, RR. HH. y cadena de suministro; comparativo entre tiendas.

**Indicadores previstos**: ventas por tienda y por m², ticket promedio, margen y utilidad, rotación, merma, quiebre y sobrestock, EBITDA, costo logístico, productividad por empleado.

---

## 5. Configuraciones

El sistema transversal: define **quién entra, a qué, y con qué empresa, sucursales y terminales**. Lo usan todos los demás.

### 5.1 Usuarios — [Hecho]
- **Lista de usuarios**: código automático (USR-0001), datos personales (documento, teléfono, cargo), roles, sucursales, estado, último acceso
- Alta, edición, desactivar, eliminar y reiniciar contraseña
- Reglas: siempre queda al menos un administrador activo; nadie se desactiva ni se elimina a sí mismo; un usuario desactivado pierde sus sesiones

### 5.2 Roles y permisos — [Hecho]
- **Roles**: crear, editar y eliminar roles con su árbol de permisos; el rol Administrador (acceso total) no se toca; un rol con usuarios no se elimina
- **Permisos por sistema**: accesos por rol y por persona (permisos directos y denegaciones sobre lo que dan sus roles) y **solicitudes de acceso** (quien se topa con una pantalla cerrada la pide con su motivo; un administrador la aprueba o la rechaza)
- Modelo: ver principio 5; los cambios surten efecto de inmediato

### 5.3 Empresa y sucursales — [Hecho]
- **Datos de la empresa**: razón social, RUC (con dígito verificador), dirección fiscal. Una empresa hoy; el esquema admite varias
- **Sucursales**: tiendas y centros de distribución, con código, establecimiento anexo de SUNAT, dirección y estado; se eliminan solo si no tienen almacenes ni usuarios
- **Almacenes**: varios por sucursal, con código único dentro de la sucursal
- Cada usuario trabaja en las sucursales que se le asignan (una, varias o todas; los administradores, todas). La sucursal activa se elige en el menú de la cuenta
- Jerarquía: empresa → sucursal → almacenes, cajas y personal

### 5.4 Terminales y series — [Pendiente]
- **Terminales POS**: cajas de cada sucursal
- **Series de comprobantes**: numeración por sucursal y tipo de comprobante

### 5.5 Auditoría — [Pendiente]
- **Historial de acciones**: quién, cuándo y qué cambió, con filtros y exportación

### 5.6 Integraciones — [Pendiente] (se construye al final)
- **SUNAT**: emisión y consulta de comprobantes
- **Bancos**: conciliación y pagos
- **APIs y webhooks**: conexiones con terceros

---

## 6. Sistemas propuestos

Están aquí para decidirse; **no** están en el menú ni en el código.

### 6.1 MDM — Datos maestros

Controla los datos de los que dependen todos los demás: productos (SKU, código de barras, marca, categoría, unidad, peso, volumen, impuestos, costo, precio, margen), tiendas (empresa, región, formato, área, horarios, cajas), proveedores y clientes.

**Recomendación:** mantenerlo, por ahora, como el módulo **ERP › Catálogo y maestros**, que ya cumple ese papel. La regla que importa (una sola versión de cada dato maestro) se cumple igual. Separarlo como sistema independiente tiene sentido cuando haya varias empresas con catálogos distintos, flujos de aprobación de altas de producto o integraciones masivas con proveedores.

### 6.2 TMS — Transporte y distribución (necesario para la reposición)

Lleva la mercadería del centro de distribución a las tiendas. Cubre: flota y vehículos, conductores y transportistas externos, planificación de rutas, despachos, seguimiento (GPS si se instala), combustible y mantenimiento, costos por ruta y por entrega, prueba de entrega (firma o foto) e incidencias.

Dentro de la reposición hace la tercera parte: **SCM** decide qué, cuánto y cuándo; **WMS** lo prepara; **TMS** lo traslada y confirma la entrega. Además le devuelve a SCM el **lead time real** de cada tienda, que mejora el cálculo de cuándo pedir.

**Propuesta:** sistema propio, que se construye **después del WMS** (de ahí salen los pedidos empacados). Hasta entonces, el WMS cubre las guías de remisión y la carga del vehículo. SCM conserva solo la planificación (4.3.4 pasa a apuntar al TMS cuando exista).

---

## 7. Para el final: E-commerce / omnicanal

Tienda online, catálogo, carrito, checkout, pagos, delivery propio y de terceros, Click & Collect, devoluciones, promociones y cupones, e inventario online. Más adelante: marketplace y app móvil.

**Va al final**, cuando los demás sistemas ya funcionen, porque no tiene datos propios: vive de lo que ya existe.

| Necesita de | Para |
|---|---|
| ERP › Catálogo y Listas de precios | Mostrar productos y precios |
| ERP › Inventario (y WMS) | Saber qué se puede prometer y de qué sucursal o almacén sale |
| POS | Registrar la venta y el comprobante igual que en tienda |
| CRM | Cliente único, puntos y cupones en ambos canales |
| WMS y TMS | Preparar y entregar los pedidos |

Como se apoya en las fuentes de verdad de la sección 3, no obliga a rehacer nada de lo anterior: es un canal más de venta sobre los mismos datos.

---

## 8. Puntos por decidir

1. **MDM como sistema aparte o módulo del ERP.** Recomendación: módulo del ERP (6.1).
2. **TMS.** Propuesta: sistema propio, después del WMS (6.2). Falta confirmar si el transporte es propio, contratado o mixto, porque define cuánto de GPS y de costos hace falta.
3. **Dueño del inventario de tienda.** El esquema original lo dejaba abierto ("POS/ERP/WMS según arquitectura"). Recomendación: ERP, con el WMS como dueño de la ubicación física (principio 2). Esto se fija al construir ERP › Inventario.
4. **Módulos repetidos entre el menú y Configuraciones.** ERP › Administración del sistema (Multiempresa y multisucursal, Roles y auditoría, Integraciones), ERP › Catálogo › Sucursales y almacenes, y POS › Seguridad y configuración (Usuarios y roles, Terminales y series) hacen lo mismo que Configuraciones. Recomendación: que Configuraciones sea el único lugar donde se administran y que esos módulos pasen a mostrar acceso directo o se quiten del menú.
5. **Dónde vive la facturación electrónica.** Hoy está en el menú del POS. El ERP la usa para ventas B2B y guías. Recomendación: un servicio único (principio 3) con su pantalla de seguimiento en el POS y consulta desde el ERP.
6. **Precios por sucursal.** Hoy hay un solo precio por producto. Los precios por sucursal y horario viven en POS › Promociones y precios; las listas de precios, en ERP › Catálogo. Definir cuál prevalece cuando difieren.
7. **Validación de la sucursal activa en el servidor.** Se construye junto con el primer módulo que dependa de la sucursal (Inventario); la regla de a qué sucursales entra cada usuario ya existe.
8. **Dinero y decimales.** Se decide al primer cálculo (hoy los importes viajan como texto exacto).

---

## 9. Integraciones clave

| Origen | Destino | Dato transferido |
|---|---|---|
| **POS** | **ERP** | Ventas, caja, comprobantes; descuento de existencias |
| **ERP** | **POS** | Productos, precios, listas de precios, promociones |
| **SCM** | **ERP** | Pedidos sugeridos que se convierten en requerimientos u órdenes de compra |
| **ERP** | **WMS** | Órdenes de recepción, transferencias y despachos a ejecutar |
| **WMS** | **ERP** | Recepciones confirmadas, movimientos y ajustes de inventario |
| **ERP** | **SCM** | Existencias, compras en curso y costos |
| **POS** | **SCM** | Demanda real (ventas por SKU y tienda) |
| **HCM** | **ERP** | Asientos de planilla y costo de personal |
| **POS** | **CRM** | Historial de compras y puntos acumulados |
| **CRM** | **POS** | Cliente identificado, nivel, cupones y promociones personalizadas |
| **Configuraciones** | **Todos** | Usuarios, permisos, sucursales, almacenes, terminales y series |
| **Todos** | **BI** | Datos consolidados para reportes (solo lectura) |
| **POS / ERP** | **SUNAT** | Comprobantes electrónicos, por el servicio único de emisión |

### Flujo principal de datos

```text
Proveedor ──► WMS (recepción) ──► ERP (inventario, compra, cuenta por pagar)
                                      │
   SCM (demanda + reposición) ◄───────┤
        │ pedido sugerido             │ precios y promociones
        ▼                             ▼
   ERP (orden de compra)          POS (venta, caja, comprobante)
                                      │
                    ┌─────────────────┼────────────────┐
                    ▼                 ▼                ▼
               ERP (contabiliza)  CRM (puntos)    SCM (demanda real)

   HCM (planilla) ──► ERP (asientos)        Todos ──► BI (reportes)
```

---

## 10. Tecnologías

- **Backend**: Go con Gin; servicios con la lógica de negocio, consultas por *query objects*, errores de negocio con código estable ([detalle](arquitectura-backend.md))
- **Base de datos**: PostgreSQL, migraciones SQL numeradas que se aplican al arrancar
- **Frontend**: React con TypeScript, aplicación de una sola página; Tailwind CSS; React Router; pnpm ([detalle](arquitectura-frontend.md))
- **Acceso**: tokens opacos revocables; permisos jerárquicos por rol y por persona
- **Servidor local**: Laragon (Apache sirve el frontend y reenvía `/api` a la API en Go)
- **Integraciones**: API REST; webhooks y conectores para SUNAT, bancos y mensajería (al final)

---

## 11. Estado de construcción

| Área | Qué está hecho | Qué falta |
|---|---|---|
| Acceso y seguridad | Inicio de sesión, permisos jerárquicos, roles, permisos directos y denegaciones, solicitudes de acceso, sucursales por usuario | Auditoría; validar la sucursal activa en el servidor |
| Configuraciones | Usuarios, Roles y permisos, Empresa y sucursales (datos, sucursales, almacenes) | Terminales y series, Auditoría, Integraciones |
| ERP | Catálogo › Productos; lista de unidades | Resto del catálogo, Inventario, Compras, Ventas y distribución, Finanzas, Activos fijos, Presupuesto |
| POS, SCM, WMS, HCM, CRM, BI | Diseño del menú y de los permisos de cada submódulo | Todo lo demás |

El orden previsto: **ERP › Inventario con kardex** (le da uso real a sucursales y almacenes), luego Compras, el POS, y al final las integraciones.

---

## 12. Siguiente paso: catálogo funcional completo

Para pasar de esta lista a una especificación completa, cada submódulo necesita: **pantallas, roles que lo usan, permisos (sus acciones), tablas, API y reglas de negocio**. La parte de permisos ya existe en forma ejecutable (`backend/internal/permission/catalog_*.go` declara las acciones de cada submódulo); el resto se escribe al construir cada módulo, siguiendo las reglas de `arquitectura-backend.md`.

---
*Documento de arquitectura de sistemas integrados para la cadena de minimarkets.*
