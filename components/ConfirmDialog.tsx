"use client";

import { useEffect } from "react";

type ConfirmDialogProps = {
  message: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
};

export function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = "ยืนยัน" }: ConfirmDialogProps) {
  useEffect(() => {
    if (!message) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [message, onCancel]);

  if (!message) return null;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            ยกเลิก
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
