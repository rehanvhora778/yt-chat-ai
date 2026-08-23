/**
 * components/CollectionFormModal.jsx
 * ----------------------------------
 * Create or rename a collection. Collections group processed videos so a
 * course or playlist can be reviewed together (see pages/Collections.jsx).
 */

import { useEffect, useState } from "react";
import { FolderPlus } from "lucide-react";

import Modal from "./ui/Modal";
import { COLLECTION_COLORS, useLibrary } from "../context/LibraryContext";

const CollectionFormModal = ({ open, onClose, collection, onSaved }) => {
  const { createCollection, updateCollection } = useLibrary();
  const editing = !!collection;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("red");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(collection?.name || "");
    setDescription(collection?.description || "");
    setColor(collection?.color || "red");
    setError("");
  }, [open, collection]);

  const submit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give your collection a name.");
      return;
    }
    if (editing) {
      updateCollection(collection.id, { name: trimmed, description, color });
      onSaved?.(collection.id);
    } else {
      const created = createCollection({ name: trimmed, description, color });
      onSaved?.(created.id);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit collection" : "New collection"}
      description={
        editing
          ? "Update the name, colour or description."
          : "Group related videos so you can review them together."
      }
      icon={FolderPlus}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" form="collection-form" className="btn-primary">
            {editing ? "Save changes" : "Create collection"}
          </button>
        </>
      }
    >
      <form id="collection-form" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="collection-name" className="mb-1.5 block text-xs font-semibold text-muted">
            Name
          </label>
          <input
            id="collection-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="e.g. Machine Learning course"
            className="input-field"
            maxLength={60}
          />
          {error && <p className="mt-1.5 text-xs font-medium text-accent">{error}</p>}
        </div>

        <div>
          <label
            htmlFor="collection-description"
            className="mb-1.5 block text-xs font-semibold text-muted"
          >
            Description <span className="font-normal text-faint">(optional)</span>
          </label>
          <textarea
            id="collection-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What is this collection for?"
            className="input-field resize-none"
            maxLength={160}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted">Colour</p>
          <div className="flex flex-wrap gap-2">
            {COLLECTION_COLORS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setColor(option.id)}
                aria-label={option.label}
                aria-pressed={color === option.id}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${
                  color === option.id ? "scale-110 border-ink" : "border-transparent"
                }`}
                style={{ backgroundColor: `rgb(${option.value})` }}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CollectionFormModal;
