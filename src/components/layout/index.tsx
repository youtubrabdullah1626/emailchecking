import React from 'react';
import { cn } from '@/lib/utils';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mx-auto w-full max-w-[1200px] px-8', className)}
      {...props}
    />
  )
);
Container.displayName = 'Container';

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: number;
  gap?: string;
}

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ className, columns = 1, gap = 'var(--space-6)', style, ...props }, ref) => (
    <div
      ref={ref}
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap,
        ...style,
      }}
      {...props}
    />
  )
);
Grid.displayName = 'Grid';

export interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column';
  align?: string;
  justify?: string;
  gap?: string;
}

export const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
  (
    {
      className,
      direction = 'row',
      align = 'flex-start',
      justify = 'flex-start',
      gap = '0',
      style,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction,
        alignItems: align,
        justifyContent: justify,
        gap,
        ...style,
      }}
      {...props}
    />
  )
);
Flex.displayName = 'Flex';

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: string;
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, gap = 'var(--space-4)', style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col', className)}
      style={{ gap, ...style }}
      {...props}
    />
  )
);
Stack.displayName = 'Stack';
