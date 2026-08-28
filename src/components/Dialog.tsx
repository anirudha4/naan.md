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
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
        <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <BaseDialog.Popup
            className={cn(
              "w-full max-w-sm rounded-lg bg-white p-5 shadow-xl outline-none",
              "dark:bg-gray-900",
            )}
          >
            <BaseDialog.Title className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </BaseDialog.Title>
            {children && (
              <BaseDialog.Description className="mt-2 text-sm text-gray-600 dark:text-gray-400">
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
