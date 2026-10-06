import { Navigate, Route, Routes } from 'react-router-dom';
import AuthShowcaseLayout from '@/layouts/auth/auth-showcase-layout';
import { getToken } from '@/lib/api';
import LoginPage from '@/pages/login';
import NotFoundPage from '@/pages/not-found';
import SistemaPage from '@/pages/sistema';
import SistemasPage from '@/pages/sistemas';

/** La raíz manda al panel si hay sesión y al login si no. */
function Home() {
    return <Navigate to={getToken() ? '/sistemas' : '/login'} replace />;
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route
                path="/login"
                element={
                    <AuthShowcaseLayout
                        title="Bienvenido de nuevo"
                        description="Ingresa a tu cuenta para continuar."
                    >
                        <LoginPage />
                    </AuthShowcaseLayout>
                }
            />
            <Route path="/sistemas" element={<SistemasPage />} />
            <Route
                path="/sistemas/:system/:module?/:item?"
                element={<SistemaPage />}
            />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}
