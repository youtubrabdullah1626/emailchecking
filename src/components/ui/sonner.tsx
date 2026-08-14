'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast !bg-background/95 !backdrop-blur-md !text-foreground !border !border-border/80 !shadow-xl !rounded-2xl !p-4 !font-sans flex items-center gap-3.5 transition-all duration-200',
          title: '!font-semibold !text-sm !text-foreground !tracking-tight',
          description: '!text-xs !text-muted-foreground !leading-relaxed !mt-0.5',
          actionButton:
            '!bg-primary !text-primary-foreground hover:!bg-primary/90 !rounded-xl !text-xs !font-semibold !px-3.5 !py-1.5 !shadow-sm !transition-all active:!scale-[0.96] !ml-auto',
          cancelButton:
            '!bg-muted !text-muted-foreground hover:!bg-muted/80 !rounded-xl !text-xs !font-medium !px-3 !py-1.5 !transition-all active:!scale-[0.96]',
          closeButton:
            '!bg-background !border !border-border !text-muted-foreground hover:!text-foreground !rounded-lg !transition-colors',
          success: '!border-emerald-500/25 dark:!border-emerald-500/20',
          error: '!border-red-500/25 dark:!border-red-500/20',
          info: '!border-indigo-500/25 dark:!border-indigo-500/20',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
