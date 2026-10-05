import { Eye, EyeOff, Lock } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function PasswordInput({
    className,
    ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative">
            <Lock
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground"
            />
            <Input
                type={visible ? 'text' : 'password'}
                className={cn('pr-11 pl-11', className)}
                {...props}
            />
            <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
                {visible ? (
                    <EyeOff className="size-[18px]" />
                ) : (
                    <Eye className="size-[18px]" />
                )}
            </button>
        </div>
    );
}
