import { useEffect, useRef, useState } from "react";

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

export function useInlineEdit<T extends EditableElement>({
  value,
  onSave,
  isSaveKey,
}: {
  value: string;
  onSave: (trimmed: string) => void;
  isSaveKey: (event: React.KeyboardEvent) => boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [isEditing]);

  // The server's saved value wins over a stale local draft.
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  function save() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setIsEditing(false);
  }

  function cancel() {
    setEditValue(value);
    setIsEditing(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (isSaveKey(event)) {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      cancel();
    }
  }

  return {
    ref,
    isEditing,
    startEditing: () => setIsEditing(true),
    editValue,
    setEditValue,
    save,
    handleKeyDown,
  };
}

export const isEnter = (event: React.KeyboardEvent) => event.key === "Enter";
export const isModEnter = (event: React.KeyboardEvent) =>
  event.key === "Enter" && (event.metaKey || event.ctrlKey);
