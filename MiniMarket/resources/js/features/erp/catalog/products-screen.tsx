import {
    Boxes,
    Eye,
    Package,
    Pencil,
    Plus,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Dropdown } from '@/components/data/dropdown';
import { ListPage } from '@/components/data/list-page';
import type { DataTableColumn, TableQuery } from '@/components/data/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { RowAction } from '@/components/ui/row-action';
import { StatCard } from '@/components/ui/stat-card';
import { useToast } from '@/components/ui/toast';
import { useCursorList } from '@/hooks/use-cursor-list';
import { formatMoney } from '@/lib/format';
import {
    PRODUCT_CATEGORIES,
    fetchProductsPage,
    productStats,
} from '@/features/erp/catalog/products-demo';
import type { Product } from '@/features/erp/catalog/products-demo';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
];

const COLUMNS: DataTableColumn<Product>[] = [
    { key: 'sku', label: 'SKU', sortable: true, searchable: true, width: 120 },
    {
        key: 'name',
        label: 'Producto',
        sortable: true,
        searchable: true,
        width: 240,
        render: (product) => (
            <span className="font-medium text-ink">{product.name}</span>
        ),
    },
    {
        key: 'category',
        label: 'Categoría',
        sortable: true,
        filterType: 'select',
        filterOptions: PRODUCT_CATEGORIES.map((category) => ({
            value: category,
            label: category,
        })),
        width: 130,
    },
    { key: 'unit', label: 'Unidad', width: 100 },
    {
        key: 'stock',
        label: 'Stock',
        align: 'right',
        sortable: true,
        width: 90,
        render: (product) => (
            <span
                className={
                    product.stock < 20 ? 'font-semibold text-danger' : undefined
                }
            >
                {product.stock}
            </span>
        ),
    },
    {
        key: 'price',
        label: 'Precio',
        align: 'right',
        sortable: true,
        width: 110,
        render: (product) => formatMoney(product.price),
    },
    {
        key: 'status',
        label: 'Estado',
        sortable: true,
        filterType: 'select',
        filterOptions: STATUS_OPTIONS,
        width: 110,
        render: (product) => (
            <Badge tone={product.status === 'active' ? 'success' : 'neutral'}>
                {product.status === 'active' ? 'Activo' : 'Inactivo'}
            </Badge>
        ),
    },
];

/**
 * Pantalla de Productos con DATOS DE EJEMPLO: sirve para ver cómo se arman los
 * componentes reutilizables (listado, indicadores, modal, confirmación, avisos).
 * Al llegar la API solo cambia `fetchProductsPage`.
 */
export default function ProductsScreen() {
    const [query, setQuery] = useState<TableQuery | null>(null);
    const list = useCursorList<Product, TableQuery>({
        query,
        fetchPage: fetchProductsPage,
    });
    const stats = useMemo(productStats, []);
    const toast = useToast();
    const { confirm, dialog } = useConfirm();
    const [creating, setCreating] = useState(false);

    return (
        <ListPage<Product>
            icon={<Package className="size-5" aria-hidden />}
            title="Productos"
            description="Catálogo y maestros"
            actions={
                <Button onClick={() => setCreating(true)}>
                    <Plus className="size-4" aria-hidden />
                    Nuevo producto
                </Button>
            }
            stats={
                <>
                    <StatCard
                        label="Productos activos"
                        value={String(stats.active)}
                        icon={<Package className="size-5" aria-hidden />}
                        hint={`${stats.total} en el catálogo`}
                    />
                    <StatCard
                        label="Stock bajo"
                        value={String(stats.lowStock)}
                        icon={<TriangleAlert className="size-5" aria-hidden />}
                        tone="warning"
                        hint="Menos de 20 unidades"
                    />
                    <StatCard
                        label="Categorías"
                        value={String(stats.categories)}
                        icon={<Boxes className="size-5" aria-hidden />}
                        tone="info"
                    />
                </>
            }
            columns={COLUMNS}
            rows={list.rows}
            loading={list.loading}
            loadingMore={list.loadingMore}
            hasMore={list.hasMore}
            onLoadMore={list.loadMore}
            error={list.error}
            onRetry={list.retry}
            onQuery={setQuery}
            searchPlaceholder="Buscar por nombre, SKU o categoría…"
            empty="No hay productos que coincidan."
            cardIcon={Package}
            rowActions={(product) => (
                <>
                    <RowAction label="Ver detalle" tone="view">
                        <Eye className="size-4" aria-hidden />
                    </RowAction>
                    <RowAction label="Editar" tone="edit">
                        <Pencil className="size-4" aria-hidden />
                    </RowAction>
                    <RowAction
                        label="Eliminar"
                        tone="danger"
                        onClick={() =>
                            confirm({
                                title: 'Eliminar producto',
                                message: `Se eliminará "${product.name}" del catálogo.`,
                                confirmLabel: 'Eliminar',
                                tone: 'danger',
                                action: () =>
                                    toast.success(
                                        'Producto eliminado (ejemplo, no se guardó nada).',
                                    ),
                            })
                        }
                    >
                        <Trash2 className="size-4" aria-hidden />
                    </RowAction>
                </>
            )}
            note="Datos de ejemplo: 160 productos generados en el navegador, entregados de 20 en 20."
        >
            <NewProductModal
                open={creating}
                onClose={() => setCreating(false)}
                onSaved={() => {
                    setCreating(false);
                    toast.success(
                        'Producto guardado (ejemplo, no se guardó nada).',
                    );
                }}
                onInvalid={() => toast.error('Completa el nombre y el SKU.')}
            />
            {dialog}
        </ListPage>
    );
}

function NewProductModal({
    open,
    onClose,
    onSaved,
    onInvalid,
}: {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    onInvalid: () => void;
}) {
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [category, setCategory] = useState<number | string>('');
    const [price, setPrice] = useState('');
    const [touched, setTouched] = useState(false);

    const save = () => {
        setTouched(true);

        if (!name.trim() || !sku.trim()) {
            onInvalid();

            return;
        }

        onSaved();
        setName('');
        setSku('');
        setCategory('');
        setPrice('');
        setTouched(false);
    };

    return (
        <Modal
            open={open}
            title="Nuevo producto"
            description="Catálogo y maestros"
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button size="sm" onClick={save}>
                        Guardar
                    </Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Input
                    label="Nombre"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    error={
                        touched && !name.trim()
                            ? 'Escribe el nombre.'
                            : undefined
                    }
                    className="sm:col-span-2"
                    autoFocus
                />
                <Input
                    label="SKU"
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                    error={
                        touched && !sku.trim() ? 'Escribe el SKU.' : undefined
                    }
                />
                <Dropdown
                    label="Categoría"
                    value={category}
                    onChange={setCategory}
                    placeholder="Elegir categoría"
                    optional
                    options={PRODUCT_CATEGORIES.map((item) => ({
                        value: item,
                        label: item,
                    }))}
                />
                <Input
                    label="Precio de venta"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    optional
                />
            </div>
        </Modal>
    );
}
