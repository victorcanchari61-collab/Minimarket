import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

type AccessDeniedProps = {
    /** Dónde llevar al usuario para que siga trabajando. */
    backTo: string;
    backLabel: string;
};

/** Lo que se ve al abrir una pantalla para la que el usuario no tiene permiso. */
export default function AccessDenied({ backTo, backLabel }: AccessDeniedProps) {
    return (
        <div className="mx-auto mt-10 flex max-w-md flex-col items-center text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--grad-end)_14%,white)] text-(--sys-600)">
                <Lock className="size-7" aria-hidden />
            </span>
            <h1 className="mt-5 text-2xl font-bold tracking-[-0.02em]">
                No tienes acceso a esta pantalla
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
                Si la necesitas para tu trabajo, pide a un administrador que te
                asigne el permiso.
            </p>
            <Link
                to={backTo}
                className="mt-6 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-semibold outline-none hover:bg-black/[0.03] focus-visible:ring-[3px] focus-visible:ring-(--sys-400)"
            >
                {backLabel}
            </Link>
        </div>
    );
}
