import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/use-page-title';

export default function NotFoundPage() {
    usePageTitle('Página no encontrada');

    return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-alt px-6 text-center font-display">
            <p className="text-6xl font-extrabold tracking-tight text-ink">404</p>
            <p className="text-ink-muted">No encontramos la página que buscas.</p>
            <Link to="/">
                <Button>Volver al inicio</Button>
            </Link>
        </main>
    );
}
