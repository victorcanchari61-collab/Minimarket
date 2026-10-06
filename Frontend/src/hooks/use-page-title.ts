import { useEffect } from 'react'
import { BRAND_NAME } from '@/lib/systems'

/** Título de la pestaña del navegador: "Productos - MiniMarket". */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} - ${BRAND_NAME}` : BRAND_NAME
  }, [title])
}
