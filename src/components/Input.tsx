import * as React from "react";
import { cn } from "../lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * From-scratch input primitive. Native `<input>`, editorial styling via the
 * design tokens. Accessibility comes for free from the native element.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-md border border-line bg-paper px-3 text-[13px] text-ink",
          "placeholder:text-ink-faint",
          "transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out)]",
          "outline-none focus-visible:border-gold/55 focus-visible:ring-2 focus-visible:ring-gold/20",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
