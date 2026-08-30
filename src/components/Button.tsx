import * as React from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "default" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-ink text-paper hover:bg-ink/90",
  ghost: "bg-transparent text-ink-muted hover:bg-ink/[0.055] hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-9 px-4 text-[13px]",
};

/**
 * From-scratch button primitive. Native `<button>`, styled with Tailwind
 * via `cn()`. No Base UI needed here — accessibility comes for free from
 * the native element.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex select-none items-center justify-center gap-2 rounded-md font-medium tracking-[-0.01em]",
          "transition-[transform,background-color,color] duration-150 ease-[var(--ease-out)] active:scale-[0.97]",
          "outline-none focus-visible:ring-2 focus-visible:ring-gold/55",
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

Button.displayName = "Button";
