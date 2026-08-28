"use client";

import { useEffect } from "react";

type AlertDialogProps = {
  message: string | null;
  onClose: () => void;
};

export function AlertDialog({ message, onClose }: AlertDialogProps) {
  useEffect(() => {
    if (!message) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose} autoFocus>
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
}
