import * as React from "react";
import { cn } from "../lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * From-scratch input primitive. Native `<input>`, styled with Tailwind via
 * `cn()`. No Base UI needed — accessibility comes for free from the native
 * element.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900",
          "placeholder:text-gray-400",
          "outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30",
          "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400",
          "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
