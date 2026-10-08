import type { ComponentType } from 'react';
import HistoryScreen from '@/features/config/audit/history-screen';
import BranchesScreen from '@/features/config/company/branches-screen';
import CompanyScreen from '@/features/config/company/company-screen';
import WarehousesScreen from '@/features/config/company/warehouses-screen';
import PermissionsScreen from '@/features/config/permissions/permissions-screen';
import RolesScreen from '@/features/config/roles/roles-screen';
import SeriesScreen from '@/features/config/terminals/series-screen';
import TerminalsScreen from '@/features/config/terminals/terminals-screen';
import UsersScreen from '@/features/config/users/users-screen';
import ProductsScreen from '@/features/erp/catalog/products-screen';

/**
 * Pantallas ya construidas, por ruta `sistema/módulo/submódulo` (los mismos
 * nombres de la URL). Lo que no esté aquí muestra el aviso "en construcción".
 */
export const SCREENS: Record<string, ComponentType> = {
    'erp/catalogo-y-maestros/productos': ProductsScreen,
    'config/usuarios/lista-de-usuarios': UsersScreen,
    'config/roles-y-permisos/roles': RolesScreen,
    'config/roles-y-permisos/permisos-por-sistema': PermissionsScreen,
    'config/empresa-y-sucursales/datos-de-la-empresa': CompanyScreen,
    'config/empresa-y-sucursales/sucursales': BranchesScreen,
    'config/empresa-y-sucursales/almacenes': WarehousesScreen,
    'config/terminales-y-series/terminales-pos': TerminalsScreen,
    'config/terminales-y-series/series-de-comprobantes': SeriesScreen,
    'config/auditoria/historial-de-acciones': HistoryScreen,
};
