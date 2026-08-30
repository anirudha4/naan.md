import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cn } from "../lib/cn";
import { Button } from "./Button";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children?: React.ReactNode;
  /** Called when the confirm action is activated. The dialog closes right after. */
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action (e.g. delete confirmation). */
  danger?: boolean;
}

/**
 * Thin, styled wrapper over Base UI `Dialog`, controlled via `open` /
 * `onOpenChange`. No internal `Trigger` — callers open it externally (e.g.
 * from a delete icon button), which fits the delete-confirmation use case.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
}: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop
          className={cn(
            "fixed inset-0 z-40 bg-ink/35 backdrop-blur-[1.5px]",
            "transition-opacity duration-200 ease-[var(--ease-out)]",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <BaseDialog.Popup
            className={cn(
              "w-full max-w-sm rounded-xl border border-line bg-raised p-5 text-ink outline-none",
              "shadow-[0_28px_80px_-24px_rgba(20,14,6,0.55)]",
              "transition-[opacity,transform] duration-200 ease-[var(--ease-out)]",
              "data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0",
            )}
          >
            <p className="eyebrow mb-2">{danger ? "Confirm" : "Dialog"}</p>
            <BaseDialog.Title className="text-[15px] font-semibold tracking-tight text-ink">
              {title}
            </BaseDialog.Title>
            {children && (
              <BaseDialog.Description className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                {children}
              </BaseDialog.Description>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <BaseDialog.Close render={<Button variant="ghost">{cancelLabel}</Button>} />
              <Button
                variant={danger ? "danger" : "default"}
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
