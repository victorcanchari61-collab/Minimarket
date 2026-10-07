import { Boxes, Package, PackageX, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dropdown } from '@/components/data/dropdown';
import { ListPage } from '@/components/data/list-page';
import type { DataTableColumn, TableQuery } from '@/components/data/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { RowAction } from '@/components/ui/row-action';
import { StatCard } from '@/components/ui/stat-card';
import { useConfirm } from '@/hooks/use-confirm';
import { useCursorList } from '@/hooks/use-cursor-list';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import {
    createProduct,
    deleteProduct,
    fetchCategories,
    fetchProductSummary,
    fetchProductsPage,
    fetchUnits,
    updateProduct,
} from '@/features/erp/catalog/products-api';
import type {
    Category,
    Product,
    ProductPayload,
    ProductStatus,
    ProductSummary,
    Unit,
} from '@/features/erp/catalog/products-api';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
];

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : 'No se pudo completar la acción.';

/** ERP › Catálogo y maestros › Productos, con datos reales de la API. */
export default function ProductsScreen() {
    const [query, setQuery] = useState<TableQuery | null>(null);
    const list = useCursorList<Product, TableQuery>({
        query,
        fetchPage: fetchProductsPage,
    });
    const toast = useToast();
    const { confirm, dialog } = useConfirm();
    const { can } = usePermissions();
    const canCreate = can('erp.catalog.products.create');
    const canEdit = can('erp.catalog.products.edit');
    const canDelete = can('erp.catalog.products.delete');

    const [summary, setSummary] = useState<ProductSummary | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    // undefined = cerrado · null = producto nuevo · Product = editando
    const [editing, setEditing] = useState<Product | null | undefined>(
        undefined,
    );

    const loadSummary = useCallback(() => {
        fetchProductSummary()
            .then(setSummary)
            .catch(() => setSummary(null));
    }, []);

    useEffect(() => {
        loadSummary();
        fetchCategories().then(setCategories).catch(() => undefined);
        fetchUnits().then(setUnits).catch(() => undefined);
    }, [loadSummary]);

    const columns = useMemo<DataTableColumn<Product>[]>(
        () => [
            {
                key: 'sku',
                label: 'SKU',
                sortable: true,
                width: 120,
            },
            {
                key: 'name',
                label: 'Producto',
                sortable: true,
                width: 260,
                render: (product) => (
                    <span className="font-medium text-ink">{product.name}</span>
                ),
            },
            {
                key: 'category',
                label: 'Categoría',
                searchable: false,
                filterType: 'select',
                filterOptions: categories.map((category) => ({
                    value: String(category.id),
                    label: category.name,
                })),
                width: 150,
                render: (product) => product.category ?? '—',
            },
            {
                key: 'unit',
                label: 'Unidad',
                searchable: false,
                filterable: false,
                width: 110,
            },
            {
                key: 'price',
                label: 'Precio',
                align: 'right',
                sortable: true,
                searchable: false,
                filterable: false,
                width: 120,
                render: (product) => formatMoney(product.price),
            },
            {
                key: 'status',
                label: 'Estado',
                sortable: true,
                searchable: false,
                filterType: 'select',
                filterOptions: STATUS_OPTIONS,
                width: 120,
                render: (product) => (
                    <Badge
                        tone={product.status === 'active' ? 'success' : 'neutral'}
                    >
                        {product.status_label}
                    </Badge>
                ),
            },
        ],
        [categories],
    );

    const refresh = () => {
        list.reload();
        loadSummary();
    };

    const askDelete = (product: Product) =>
        confirm({
            title: 'Eliminar producto',
            message: `Se eliminará "${product.name}" del catálogo.`,
            confirmLabel: 'Eliminar',
            tone: 'danger',
            action: async () => {
                try {
                    await deleteProduct(product.id);
                    toast.success('Producto eliminado.');
                    refresh();
                } catch (error) {
                    toast.error(messageOf(error));
                }
            },
        });

    return (
        <ListPage<Product>
            icon={<Package className="size-5" aria-hidden />}
            title="Productos"
            description="Catálogo y maestros"
            actions={
                canCreate ? (
                    <Button onClick={() => setEditing(null)}>
                        <Plus className="size-4" aria-hidden />
                        Nuevo producto
                    </Button>
                ) : undefined
            }
            stats={
                <>
                    <StatCard
                        label="Productos activos"
                        value={summary ? String(summary.active) : '—'}
                        icon={<Package className="size-5" aria-hidden />}
                    />
                    <StatCard
                        label="Inactivos"
                        value={summary ? String(summary.inactive) : '—'}
                        icon={<PackageX className="size-5" aria-hidden />}
                        tone="neutral"
                    />
                    <StatCard
                        label="Categorías en uso"
                        value={summary ? String(summary.categories) : '—'}
                        icon={<Boxes className="size-5" aria-hidden />}
                        tone="info"
                    />
                </>
            }
            columns={columns}
            rows={list.rows}
            loading={list.loading}
            loadingMore={list.loadingMore}
            hasMore={list.hasMore}
            onLoadMore={list.loadMore}
            error={list.error}
            onRetry={list.retry}
            onQuery={setQuery}
            searchPlaceholder="Buscar por nombre o SKU…"
            empty="No hay productos que coincidan."
            cardIcon={Package}
            rowActions={
                canEdit || canDelete
                    ? (product) => (
                          <>
                              {canEdit && (
                                  <RowAction
                                      label="Editar"
                                      tone="edit"
                                      onClick={() => setEditing(product)}
                                  >
                                      <Pencil className="size-4" aria-hidden />
                                  </RowAction>
                              )}
                              {canDelete && (
                                  <RowAction
                                      label="Eliminar"
                                      tone="danger"
                                      onClick={() => askDelete(product)}
                                  >
                                      <Trash2 className="size-4" aria-hidden />
                                  </RowAction>
                              )}
                          </>
                      )
                    : undefined
            }
        >
            {editing !== undefined && (
                <ProductModal
                    product={editing}
                    categories={categories}
                    units={units}
                    onClose={() => setEditing(undefined)}
                    onSaved={(message) => {
                        setEditing(undefined);
                        toast.success(message);
                        refresh();
                    }}
                />
            )}
            {dialog}
        </ListPage>
    );
}

function ProductModal({
    product,
    categories,
    units,
    onClose,
    onSaved,
}: {
    product: Product | null;
    categories: Category[];
    units: Unit[];
    onClose: () => void;
    onSaved: (message: string) => void;
}) {
    const [sku, setSku] = useState(product?.sku ?? '');
    const [name, setName] = useState(product?.name ?? '');
    const [categoryId, setCategoryId] = useState<number | string>(
        product?.category_id ?? '',
    );
    const [unitId, setUnitId] = useState<number | string>(
        product?.unit_id ?? '',
    );
    const [price, setPrice] = useState(product?.price ?? '');
    const [status, setStatus] = useState<ProductStatus>(
        product?.status ?? 'active',
    );
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const toast = useToast();

    const save = async () => {
        const next: Record<string, string> = {};

        if (!sku.trim()) next.sku = 'Escribe el SKU.';
        if (!name.trim()) next.name = 'Escribe el nombre.';
        if (unitId === '') next.unit_id = 'Elige la unidad.';
        if (!/^\d{1,12}(\.\d{1,2})?$/.test(price.trim()))
            next.price = 'Escribe un precio válido (ejemplo: 24.90).';

        setErrors(next);

        if (Object.keys(next).length > 0) {
            return;
        }

        const payload: ProductPayload = {
            sku: sku.trim(),
            name: name.trim(),
            category_id: categoryId === '' ? null : Number(categoryId),
            unit_id: Number(unitId),
            price: price.trim(),
            status,
        };

        setSaving(true);

        try {
            if (product) {
                await updateProduct(product.id, payload);
                onSaved('Producto actualizado.');
            } else {
                await createProduct(payload);
                onSaved('Producto creado.');
            }
        } catch (error) {
            if (error instanceof ApiError && Object.keys(error.errors).length) {
                setErrors(
                    Object.fromEntries(
                        Object.entries(error.errors).map(([field, messages]) => [
                            field,
                            messages[0],
                        ]),
                    ),
                );
            } else {
                toast.error(messageOf(error));
            }

            setSaving(false);
        }
    };

    return (
        <Modal
            open
            title={product ? 'Editar producto' : 'Nuevo producto'}
            description="Catálogo y maestros"
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button size="sm" loading={saving} onClick={() => void save()}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Input
                    label="Nombre"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    error={errors.name}
                    className="sm:col-span-2"
                    autoFocus
                />
                <Input
                    label="SKU"
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                    error={errors.sku}
                />
                <Dropdown
                    label="Unidad"
                    value={unitId}
                    onChange={setUnitId}
                    placeholder="Elegir unidad"
                    error={errors.unit_id}
                    options={units.map((unit) => ({
                        value: unit.id,
                        label: unit.name,
                    }))}
                />
                <Dropdown
                    label="Categoría"
                    value={categoryId}
                    onChange={setCategoryId}
                    placeholder="Sin categoría"
                    optional
                    error={errors.category_id}
                    options={[
                        { value: '', label: 'Sin categoría' },
                        ...categories.map((category) => ({
                            value: category.id,
                            label: category.name,
                        })),
                    ]}
                />
                <Input
                    label="Precio de venta"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    error={errors.price}
                    inputMode="decimal"
                    placeholder="0.00"
                />
                <Dropdown
                    label="Estado"
                    value={status}
                    onChange={(value) => setStatus(value as ProductStatus)}
                    options={STATUS_OPTIONS}
                />
            </div>
        </Modal>
    );
}
