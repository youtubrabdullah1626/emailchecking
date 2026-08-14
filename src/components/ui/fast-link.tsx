"use client";

import React, { useCallback } from "react";
import Link, { LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { prewarmRouteData } from "@/lib/speed/preloader";
import { cn } from "@/lib/utils";

export interface FastLinkProps extends LinkProps {
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onTouchStart?: (e: React.TouchEvent<HTMLAnchorElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLAnchorElement>) => void;
}

/**
 * FastLink: Zero-latency, predictive navigation link component.
 * Preloads the Next.js page bundle AND primes the SWR API cache on hover/touch/focus.
 */
export const FastLink = React.forwardRef<HTMLAnchorElement, FastLinkProps>(
  (
    {
      href,
      className,
      children,
      onClick,
      onMouseEnter,
      onTouchStart,
      onFocus,
      prefetch = true,
      ...props
    },
    ref
  ) => {
    const router = useRouter();

    const handlePrewarm = useCallback(() => {
      const targetHref = typeof href === "string" ? href : href.pathname || "";
      if (targetHref && !targetHref.startsWith("http") && !targetHref.startsWith("#")) {
        try {
          router.prefetch(targetHref);
          prewarmRouteData(targetHref);
        } catch {
          // Ignore prefetch failures
        }
      }
    }, [href, router]);

    return (
      <Link
        ref={ref}
        href={href}
        prefetch={prefetch}
        onMouseEnter={(e) => {
          handlePrewarm();
          onMouseEnter?.(e);
        }}
        onTouchStart={(e) => {
          handlePrewarm();
          onTouchStart?.(e);
        }}
        onFocus={(e) => {
          handlePrewarm();
          onFocus?.(e);
        }}
        onClick={onClick}
        className={cn(
          "transition-all duration-150 ease-out active:scale-[0.98] select-none cursor-pointer touch-manipulation",
          className
        )}
        {...props}
      >
        {children}
      </Link>
    );
  }
);

FastLink.displayName = "FastLink";
