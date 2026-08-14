import React from 'react';
import { Button } from './button';
import { Badge } from './badge';
import { Input } from './input';
import { Textarea } from './textarea';
import { Label } from './label';
import { Spinner } from './spinner';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from './empty';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

// --- LegacyButton ---
export interface LegacyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  asChild?: boolean;
}

export const LegacyButton = React.forwardRef<HTMLButtonElement, LegacyButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, asChild, ...props }, ref) => {
    // Map legacy variants to new Radix/CVA variants
    const variantMap: Record<string, "default" | "secondary" | "outline" | "destructive" | "ghost" | "link"> = {
      primary: 'default',
      secondary: 'secondary',
      outline: 'outline',
      danger: 'destructive',
      ghost: 'ghost',
    };
    
    const sizeMap: Record<string, "default" | "sm" | "lg" | "icon"> = {
      sm: 'sm',
      md: 'default',
      lg: 'lg',
    };

    return (
      <Button
        ref={ref}
        variant={variantMap[variant] || 'default'}
        size={sizeMap[size] || 'default'}
        disabled={disabled || isLoading}
        className={className}
        asChild={asChild}
        {...props}
      >
        {asChild ? children : (
          <>
            {isLoading && <Spinner className="mr-2" />}
            {children}
          </>
        )}
      </Button>
    );
  }
);
LegacyButton.displayName = 'LegacyButton';

// --- LegacyBadge ---
export interface LegacyBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const LegacyBadge = React.forwardRef<HTMLSpanElement, LegacyBadgeProps>(
  ({ className, variant = 'neutral', children, ...props }, ref) => {
    // The new system might not have all these semantic colors by default, 
    // so we handle them with custom tailwind classes if needed, or map them.
    const getBadgeStyle = () => {
      switch (variant) {
        case 'success': return 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-transparent';
        case 'warning': return 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-transparent';
        case 'danger': return 'bg-destructive/15 text-destructive hover:bg-destructive/25 border-transparent';
        case 'info': return 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-transparent';
        case 'neutral': 
        default: return 'bg-muted text-muted-foreground hover:bg-muted/80 border-transparent';
      }
    };

    return (
      <span ref={ref} className={cn("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold", getBadgeStyle(), className)} {...props}>
        {children}
      </span>
    );
  }
);
LegacyBadge.displayName = 'LegacyBadge';

// --- LegacyInput ---
export interface LegacyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const LegacyInput = React.forwardRef<HTMLInputElement, LegacyInputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="flex w-full flex-col gap-1.5 mb-4">
        {label && <Label htmlFor={inputId}>{label}</Label>}
        <Input
          id={inputId}
          ref={ref}
          className={cn(error && "border-destructive focus-visible:ring-destructive", className)}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        {hint && !error && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    );
  }
);
LegacyInput.displayName = 'LegacyInput';

// --- LegacyTextarea ---
export interface LegacyTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const LegacyTextarea = React.forwardRef<HTMLTextAreaElement, LegacyTextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="flex w-full flex-col gap-1.5 mb-4">
        {label && <Label htmlFor={inputId}>{label}</Label>}
        <Textarea
          id={inputId}
          ref={ref}
          className={cn(error && "border-destructive focus-visible:ring-destructive", className)}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        {hint && !error && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    );
  }
);
LegacyTextarea.displayName = 'LegacyTextarea';

// --- LegacyPageHeader ---
export interface LegacyPageHeaderProps {
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
}

export const LegacyPageHeader: React.FC<LegacyPageHeaderProps> = ({ title, description, actions }) => (
  <div suppressHydrationWarning className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
    <div suppressHydrationWarning className="flex flex-col gap-1">
      <h1 suppressHydrationWarning className="text-3xl font-bold tracking-tight">{title}</h1>
      {description && <p suppressHydrationWarning className="text-muted-foreground">{description}</p>}
    </div>
    {actions && <div suppressHydrationWarning className="flex items-center gap-2">{actions}</div>}
  </div>
);

// --- LegacyEmptyState ---
export interface LegacyEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode;
}

export const LegacyEmptyState: React.FC<LegacyEmptyStateProps> = ({ icon, title, description, actionLabel, onAction, action }) => (
  <Empty>
    {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
    <EmptyContent>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
      {action ? (
        <div className="mt-4">{action}</div>
      ) : actionLabel && onAction ? (
        <Button onClick={onAction} className="mt-4">{actionLabel}</Button>
      ) : null}
    </EmptyContent>
  </Empty>
);

// --- LegacyErrorState ---
export interface LegacyErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const LegacyErrorState: React.FC<LegacyErrorStateProps> = ({ title = 'Something went wrong', message, onRetry }) => (
  <Empty className="border-destructive/20 bg-destructive/5">
    <EmptyMedia className="bg-destructive/10 text-destructive"><AlertCircle className="h-6 w-6" /></EmptyMedia>
    <EmptyContent>
      <EmptyTitle className="text-destructive">{title}</EmptyTitle>
      <EmptyDescription className="text-destructive/80">{message}</EmptyDescription>
      {onRetry && <Button variant="outline" onClick={onRetry} className="mt-4">Try Again</Button>}
    </EmptyContent>
  </Empty>
);

// --- LegacyLoadingState ---
export const LegacyLoadingState: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <Empty className="border-none">
    <EmptyContent>
      <Spinner className="size-8 mb-2" />
      <EmptyDescription>{message}</EmptyDescription>
    </EmptyContent>
  </Empty>
);
