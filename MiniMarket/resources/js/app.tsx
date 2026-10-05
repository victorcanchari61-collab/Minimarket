import { createInertiaApp } from '@inertiajs/react';
import { ToastProvider } from '@/components/ui/toast';
import AuthShowcaseLayout from '@/layouts/auth/auth-showcase-layout';

const appName = import.meta.env.VITE_APP_NAME || 'MiniMarket';

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => (name.startsWith('auth/') ? AuthShowcaseLayout : null),
    withApp(app) {
        return <ToastProvider>{app}</ToastProvider>;
    },
    progress: {
        color: '#4B5563',
    },
});
