/**
 * components/PdfNameModal.jsx
 * ---------------------------
 * Asks what to call the PDF, then hands the name to `startPrint(name)`
 * (see lib/printExport.js), which builds the file and downloads it straight
 * away — no browser print dialog.
 */

import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";

import Modal from "./ui/Modal";

const PdfNameModal = ({ open, onClose, defaultName = "", onConfirm }) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const submit = (event) => {
    event.preventDefault();
    // An empty box just means "use the suggestion".
    onConfirm?.(name.trim() || defaultName);
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Name your PDF"
      description="It will download straight to your Downloads folder."
      icon={FileDown}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" form="pdf-name-form" className="btn-primary">
            <FileDown size={15} /> Download PDF
          </button>
        </>
      }
    >
      <form id="pdf-name-form" onSubmit={submit}>
        <label htmlFor="pdf-name" className="mb-1.5 block text-xs font-semibold text-muted">
          File name
        </label>
        <div className="flex items-center gap-2">
          <input
            id="pdf-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={defaultName}
            className="input-field"
            autoComplete="off"
          />
          <span className="shrink-0 text-sm font-medium text-faint">.pdf</span>
        </div>
      </form>
    </Modal>
  );
};

export default PdfNameModal;
