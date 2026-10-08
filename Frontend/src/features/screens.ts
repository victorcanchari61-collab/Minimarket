import type { ComponentType } from 'react';
import RolesScreen from '@/features/config/roles/roles-screen';
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
};
