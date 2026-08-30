import * as React from "react";
import { cn } from "../lib/cn";

export type IconButtonVariant = "default" | "ghost" | "danger";
export type IconButtonSize = "sm" | "md";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const variantClasses: Record<IconButtonVariant, string> = {
  default: "bg-ink text-paper hover:bg-ink/90",
  ghost: "bg-transparent text-ink-faint hover:bg-ink/[0.06] hover:text-ink",
  danger:
    "bg-transparent text-ink-faint hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400",
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
};

/**
 * Square, icon-only button. Accessible only if the caller passes `aria-label`.
 * Press feedback + gold focus ring follow the app's motion language.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "ghost", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-md",
          "transition-[transform,background-color,color] duration-150 ease-[var(--ease-out)] active:scale-[0.94]",
          "outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

IconButton.displayName = "IconButton";
