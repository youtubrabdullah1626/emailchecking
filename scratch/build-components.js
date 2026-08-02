const fs = require('fs');
const path = require('path');

const UI_DIR = path.join(__dirname, '../src/components/ui');
if (!fs.existsSync(UI_DIR)) {
  fs.mkdirSync(UI_DIR, { recursive: true });
}

const components = {
  'Button.tsx': `import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseClasses = 'btn';
    const variantClasses = variant !== 'primary' ? \`btn-\${variant}\` : 'btn-primary';
    const sizeClasses = size !== 'md' ? \`btn-\${size}\` : '';
    const loadingClasses = isLoading ? 'opacity-70 cursor-not-allowed' : '';
    const finalClasses = [baseClasses, variantClasses, sizeClasses, loadingClasses, className].filter(Boolean).join(' ');

    return (
      <button ref={ref} className={finalClasses} disabled={disabled || isLoading} {...props}>
        {isLoading && <span className="spinner mr-2" style={{ width: '1em', height: '1em', borderWidth: '2px' }} />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
`,

  'IconButton.tsx': `import React from 'react';
import { Button, ButtonProps } from './Button';

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: React.ReactNode;
  'aria-label': string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className = '', ...props }, ref) => {
    return (
      <Button ref={ref} className={\`p-2 \${className}\`} style={{ padding: 'var(--space-2)' }} {...props}>
        {icon}
      </Button>
    );
  }
);
IconButton.displayName = 'IconButton';
`,

  'Badge.tsx': `import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'neutral', children, ...props }, ref) => {
    const finalClasses = \`badge badge-\${variant} \${className}\`.trim();
    return (
      <span ref={ref} className={finalClasses} {...props}>
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';
`,

  'Card.tsx': `import React from 'react';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={\`card \${className}\`.trim()} {...props} />
  )
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={\`flex justify-between items-center mb-4 \${className}\`.trim()} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', ...props }, ref) => (
    <h3 ref={ref} className={\`text-lg font-semibold m-0 \${className}\`.trim()} style={{ fontSize: 'var(--text-lg)', margin: 0 }} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={className} {...props} />
  )
);
CardContent.displayName = 'CardContent';
`,

  'Input.tsx': `import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, hint, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\\s+/g, '-') : undefined);
    return (
      <div className="flex flex-col gap-1 w-full" style={{ marginBottom: 'var(--space-4)' }}>
        {label && <label htmlFor={inputId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>{label}</label>}
        <input
          id={inputId}
          ref={ref}
          className={className}
          aria-invalid={!!error}
          {...props}
        />
        {error && <span style={{ color: 'var(--color-danger-text)', fontSize: 'var(--text-xs)' }}>{error}</span>}
        {hint && !error && <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{hint}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
`,

  'Textarea.tsx': `import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, error, hint, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\\s+/g, '-') : undefined);
    return (
      <div className="flex flex-col gap-1 w-full" style={{ marginBottom: 'var(--space-4)' }}>
        {label && <label htmlFor={inputId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>{label}</label>}
        <textarea
          id={inputId}
          ref={ref}
          className={className}
          aria-invalid={!!error}
          {...props}
        />
        {error && <span style={{ color: 'var(--color-danger-text)', fontSize: 'var(--text-xs)' }}>{error}</span>}
        {hint && !error && <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{hint}</span>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
`,

  'Select.tsx': `import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { label: string; value: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, options, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\\s+/g, '-') : undefined);
    return (
      <div className="flex flex-col gap-1 w-full" style={{ marginBottom: 'var(--space-4)' }}>
        {label && <label htmlFor={selectId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>{label}</label>}
        <select id={selectId} ref={ref} className={className} aria-invalid={!!error} {...props}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <span style={{ color: 'var(--color-danger-text)', fontSize: 'var(--text-xs)' }}>{error}</span>}
      </div>
    );
  }
);
Select.displayName = 'Select';
`,

  'Checkbox.tsx': `import React from 'react';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', label, id, ...props }, ref) => {
    const checkboxId = id || label.toLowerCase().replace(/\\s+/g, '-');
    return (
      <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
        <input
          type="checkbox"
          id={checkboxId}
          ref={ref}
          className={className}
          style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
          {...props}
        />
        <label htmlFor={checkboxId} style={{ fontSize: 'var(--text-sm)', cursor: 'pointer', margin: 0 }}>{label}</label>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';
`,

  'Switch.tsx': `import React from 'react';

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className = '', label, id, ...props }, ref) => {
    const switchId = id || (label ? label.toLowerCase().replace(/\\s+/g, '-') : undefined);
    return (
      <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
        <div style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
          <input
            type="checkbox"
            id={switchId}
            ref={ref}
            className={\`\${className}\`}
            style={{ 
              opacity: 0, width: 0, height: 0, position: 'absolute'
            }}
            {...props}
          />
          <span style={{
            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: props.checked ? 'var(--color-primary-base)' : 'var(--color-bg-surface-3)',
            transition: 'var(--duration-fast)', borderRadius: '34px'
          }}>
            <span style={{
              position: 'absolute', content: '""', height: '14px', width: '14px', left: '3px', bottom: '3px',
              backgroundColor: 'white', transition: 'var(--duration-fast)', borderRadius: '50%',
              transform: props.checked ? 'translateX(16px)' : 'translateX(0)'
            }} />
          </span>
        </div>
        {label && <label htmlFor={switchId} style={{ fontSize: 'var(--text-sm)', cursor: 'pointer', margin: 0 }}>{label}</label>}
      </div>
    );
  }
);
Switch.displayName = 'Switch';
`,

  'Table.tsx': `import React from 'react';

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className = '', ...props }, ref) => (
    <div className="table-responsive">
      <table ref={ref} className={\`data-table \${className}\`.trim()} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <thead ref={ref} className={className} {...props} />
  )
);
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <tbody ref={ref} className={className} {...props} />
  )
);
TableBody.displayName = 'TableBody';

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className = '', ...props }, ref) => (
    <tr ref={ref} className={className} {...props} />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <th ref={ref} className={className} {...props} />
  )
);
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <td ref={ref} className={className} {...props} />
  )
);
TableCell.displayName = 'TableCell';
`,

  'Modal.tsx': `import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      zIndex: 'var(--z-modal)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-4)'
    }} onClick={onClose} aria-modal="true" role="dialog">
      <div 
        className="card animate-slide-up"
        style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--color-bg-base)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'var(--text-xl)' }}>&times;</button>
        </div>
        <div>{children}</div>
        {footer && <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>{footer}</div>}
      </div>
    </div>
  );
};
`,

  'Drawer.tsx': `import React, { useEffect } from 'react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  position?: 'left' | 'right';
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, position = 'right' }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
      zIndex: 'var(--z-overlay)', display: 'flex',
      justifyContent: position === 'right' ? 'flex-end' : 'flex-start'
    }} onClick={onClose} aria-modal="true" role="dialog">
      <div 
        style={{
          width: '100%', maxWidth: '400px', height: '100%',
          backgroundColor: 'var(--color-bg-surface)',
          borderLeft: position === 'right' ? '1px solid var(--color-border-base)' : 'none',
          borderRight: position === 'left' ? '1px solid var(--color-border-base)' : 'none',
          padding: 'var(--space-6)', overflowY: 'auto',
          animation: 'fadeIn var(--duration-fast) var(--ease-out-snappy) forwards'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'var(--text-xl)' }}>&times;</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};
`,

  'Tooltip.tsx': `import React, { useState } from 'react';

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div 
          className="animate-fade-in"
          style={{
            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
            marginBottom: 'var(--space-2)', padding: 'var(--space-1) var(--space-2)',
            backgroundColor: 'var(--color-bg-surface-3)', color: 'var(--color-text-primary)',
            fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-sm)',
            whiteSpace: 'nowrap', zIndex: 'var(--z-overlay)', pointerEvents: 'none',
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-base)'
          }}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};
`,

  'Toast.tsx': `import React from 'react';

export interface ToastProps {
  type?: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ type = 'info', message, onClose }) => {
  const bgColors = {
    success: 'var(--color-success-bg)',
    error: 'var(--color-danger-bg)',
    info: 'var(--color-info-bg)'
  };
  const borderColors = {
    success: 'var(--color-success-text)',
    error: 'var(--color-danger-text)',
    info: 'var(--color-info-text)'
  };
  const textColors = {
    success: 'var(--color-success-text)',
    error: 'var(--color-danger-text)',
    info: 'var(--color-info-text)'
  };

  return (
    <div 
      className="animate-slide-up"
      style={{
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: bgColors[type],
        border: \`1px solid \${borderColors[type]}\`,
        color: textColors[type],
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--space-4)',
        boxShadow: 'var(--shadow-md)',
        minWidth: '300px'
      }}
      role="alert"
    >
      <span style={{ fontSize: 'var(--text-sm)' }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.8 }}>&times;</button>
    </div>
  );
};
`,

  'Spinner.tsx': `import React from 'react';

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeMap = { sm: '16px', md: '24px', lg: '32px' };
  return (
    <div 
      className="spinner" 
      style={{ 
        width: sizeMap[size], height: sizeMap[size], 
        borderWidth: size === 'sm' ? '2px' : '3px' 
      }} 
      role="status" 
      aria-label="Loading" 
    />
  );
};
`,

  'Skeleton.tsx': `import React from 'react';

export const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div 
    className={\`animate-pulse \${className}\`.trim()} 
    style={{ 
      backgroundColor: 'var(--color-bg-surface-2)', 
      borderRadius: 'var(--radius-md)', 
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      ...style 
    }} 
    aria-hidden="true"
  />
);
`,

  'EmptyState.tsx': `import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="empty-state">
    {icon && <div className="empty-state-icon">{icon}</div>}
    <h3 className="empty-state-title">{title}</h3>
    <p className="empty-state-body">{description}</p>
    {actionLabel && onAction && (
      <Button onClick={onAction} style={{ marginTop: 'var(--space-2)' }}>{actionLabel}</Button>
    )}
  </div>
);
`,

  'LoadingState.tsx': `import React from 'react';
import { Spinner } from './Spinner';

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-12)', gap: 'var(--space-4)' }}>
    <Spinner size="lg" />
    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>{message}</p>
  </div>
);
`,

  'ErrorState.tsx': `import React from 'react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title = 'Something went wrong', message, onRetry }) => (
  <div className="empty-state" style={{ borderColor: 'var(--color-danger-text)' }}>
    <div style={{ fontSize: 'var(--text-3xl)', color: 'var(--color-danger-text)', marginBottom: 'var(--space-2)' }}>⚠️</div>
    <h3 className="empty-state-title" style={{ color: 'var(--color-danger-text)' }}>{title}</h3>
    <p className="empty-state-body">{message}</p>
    {onRetry && <Button variant="outline" onClick={onRetry} style={{ marginTop: 'var(--space-4)' }}>Try Again</Button>}
  </div>
);
`,

  'PageHeader.tsx': `import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <div className="page-header">
    <div>
      <h1 className="page-title">{title}</h1>
      {description && <p className="page-subtitle">{description}</p>}
    </div>
    {actions && <div className="header-actions">{actions}</div>}
  </div>
);
`,

  'Layouts.tsx': `import React from 'react';

export const Container: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={\`\${className}\`} style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 var(--space-8)' }} {...props} />
);

export const Grid: React.FC<React.HTMLAttributes<HTMLDivElement> & { columns?: number; gap?: string }> = ({ className = '', columns = 1, gap = 'var(--space-6)', style, ...props }) => (
  <div className={className} style={{ display: 'grid', gridTemplateColumns: \`repeat(\${columns}, minmax(0, 1fr))\`, gap, ...style }} {...props} />
);

export const Flex: React.FC<React.HTMLAttributes<HTMLDivElement> & { direction?: 'row' | 'column'; align?: string; justify?: string; gap?: string }> = ({ className = '', direction = 'row', align = 'flex-start', justify = 'flex-start', gap = '0', style, ...props }) => (
  <div className={className} style={{ display: 'flex', flexDirection: direction, alignItems: align, justifyContent: justify, gap, ...style }} {...props} />
);

export const Stack: React.FC<React.HTMLAttributes<HTMLDivElement> & { gap?: string }> = ({ className = '', gap = 'var(--space-4)', style, ...props }) => (
  <div className={className} style={{ display: 'flex', flexDirection: 'column', gap, ...style }} {...props} />
);
`,

  'index.ts': `export * from './Button';
export * from './IconButton';
export * from './Badge';
export * from './Card';
export * from './Input';
export * from './Textarea';
export * from './Select';
export * from './Checkbox';
export * from './Switch';
export * from './Table';
export * from './Modal';
export * from './Drawer';
export * from './Tooltip';
export * from './Toast';
export * from './Spinner';
export * from './Skeleton';
export * from './EmptyState';
export * from './LoadingState';
export * from './ErrorState';
export * from './PageHeader';
export * from './Layouts';
`
};

for (const [filename, content] of Object.entries(components)) {
  fs.writeFileSync(path.join(UI_DIR, filename), content, 'utf8');
}
console.log('Successfully created all 24 UI components in src/components/ui');
