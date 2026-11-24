import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useFetcherToast, useOnActionSuccess } from "./use-fetcher-toast";
import { isEnter, useInlineEdit } from "./use-inline-edit";

type InlineTitleProps = {
  value: string;
  intent: string;
  idField: "moduleId" | "lessonId";
  id: number;
  inputClass: string;
  triggerClass: string;
  pencilClass: string;
  children: React.ReactNode;
};

function InlineEditableTitleField({
  value,
  intent,
  idField,
  id,
  inputClass,
  triggerClass,
  pencilClass,
  children,
}: InlineTitleProps) {
  const fetcher = useFetcher();
  const edit = useInlineEdit<HTMLInputElement>({
    value,
    isSaveKey: isEnter,
    onSave: (title) =>
      fetcher.submit(
        { intent, [idField]: String(id), title },
        { method: "post" }
      ),
  });

  if (edit.isEditing) {
    return (
      <input
        ref={edit.ref}
        type="text"
        value={edit.editValue}
        onChange={(event) => edit.setEditValue(event.target.value)}
        onBlur={edit.save}
        onKeyDown={edit.handleKeyDown}
        className={`w-full rounded-md border border-input bg-background outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring ${inputClass}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={edit.startEditing}
      className={`group flex items-center rounded-md text-left hover:bg-muted ${triggerClass}`}
    >
      {children}
      <Pencil
        className={`shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 ${pencilClass}`}
      />
    </button>
  );
}

export function InlineEditableModuleTitle({
  value,
  moduleId,
}: {
  value: string;
  moduleId: number;
}) {
  return (
    <InlineEditableTitleField
      value={value}
      intent="rename-module"
      idField="moduleId"
      id={moduleId}
      inputClass="px-2 py-1 text-base font-semibold"
      triggerClass="gap-2 px-2 py-1"
      pencilClass="size-3.5"
    >
      <h3 className="font-semibold">{value}</h3>
    </InlineEditableTitleField>
  );
}

export function InlineEditableLessonTitle({
  value,
  lessonId,
}: {
  value: string;
  lessonId: number;
}) {
  return (
    <InlineEditableTitleField
      value={value}
      intent="rename-lesson"
      idField="lessonId"
      id={lessonId}
      inputClass="px-2 py-1 text-sm"
      triggerClass="gap-1.5 px-1 py-0.5 text-sm"
      pencilClass="size-3"
    >
      <span className="flex-1">{value}</span>
    </InlineEditableTitleField>
  );
}

function ConfirmButtons({
  prompt,
  buttonClass,
  onConfirm,
  onCancel,
}: {
  prompt: string;
  buttonClass: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-destructive">{prompt}</span>
      <Button
        variant="destructive"
        size="sm"
        className={`${buttonClass} text-xs`}
        onClick={onConfirm}
      >
        Confirm
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`${buttonClass} text-xs`}
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}

function ConfirmDelete({
  prompt,
  buttonClass,
  triggerClass,
  iconClass,
  onConfirm,
}: {
  prompt: string;
  buttonClass: string;
  triggerClass: string;
  iconClass: string;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <ConfirmButtons
        prompt={prompt}
        buttonClass={buttonClass}
        onConfirm={() => {
          onConfirm();
          setConfirming(false);
        }}
        onCancel={() => setConfirming(false)}
      />
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`p-0 text-muted-foreground hover:text-destructive ${triggerClass}`}
      onClick={() => setConfirming(true)}
    >
      <Trash2 className={iconClass} />
    </Button>
  );
}

export function DeleteModuleButton({
  moduleId,
  moduleTitle,
}: {
  moduleId: number;
  moduleTitle: string;
}) {
  const fetcher = useFetcher();
  useFetcherToast(fetcher, "Module deleted.");
  return (
    <ConfirmDelete
      prompt={`Delete "${moduleTitle}"?`}
      buttonClass="h-7"
      triggerClass="h-7 w-7"
      iconClass="size-4"
      onConfirm={() =>
        fetcher.submit(
          { intent: "delete-module", moduleId: String(moduleId) },
          { method: "post" }
        )
      }
    />
  );
}

export function DeleteLessonButton({ lessonId }: { lessonId: number }) {
  const fetcher = useFetcher();
  useFetcherToast(fetcher, "Lesson deleted.");
  return (
    <ConfirmDelete
      prompt="Delete?"
      buttonClass="h-6"
      triggerClass="h-6 w-6"
      iconClass="size-3.5"
      onConfirm={() =>
        fetcher.submit(
          { intent: "delete-lesson", lessonId: String(lessonId) },
          { method: "post" }
        )
      }
    />
  );
}

function useAddTitle(fields: Record<string, string>, successMessage: string) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();
  useFetcherToast(fetcher, successMessage);
  useOnActionSuccess(fetcher, close);

  useEffect(() => {
    if (isAdding) inputRef.current?.focus();
  }, [isAdding]);

  function close() {
    setTitle("");
    setIsAdding(false);
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    fetcher.submit({ ...fields, title: trimmed }, { method: "post" });
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      close();
    }
  }

  return {
    isAdding,
    open: () => setIsAdding(true),
    close,
    title,
    setTitle,
    inputRef,
    submit,
    handleKeyDown,
  };
}

function AddTitleForm({
  fields,
  successMessage,
  placeholder,
  openButton,
  layout,
}: {
  fields: Record<string, string>;
  successMessage: string;
  placeholder: string;
  openButton: {
    variant: "outline" | "ghost";
    className: string;
    label: React.ReactNode;
  };
  layout: { wrapper: string; input: string; button: string };
}) {
  const add = useAddTitle(fields, successMessage);

  if (!add.isAdding) {
    return (
      <Button
        variant={openButton.variant}
        size="sm"
        className={openButton.className}
        onClick={add.open}
      >
        {openButton.label}
      </Button>
    );
  }

  return <AddTitleInputs add={add} placeholder={placeholder} layout={layout} />;
}

function AddTitleInputs({
  add,
  placeholder,
  layout,
}: {
  add: ReturnType<typeof useAddTitle>;
  placeholder: string;
  layout: { wrapper: string; input: string; button: string };
}) {
  return (
    <div className={`flex items-center gap-2 ${layout.wrapper}`}>
      <Input
        ref={add.inputRef}
        type="text"
        placeholder={placeholder}
        value={add.title}
        onChange={(event) => add.setTitle(event.target.value)}
        onKeyDown={add.handleKeyDown}
        className={`max-w-xs ${layout.input}`}
      />
      <Button
        size="sm"
        className={layout.button}
        onClick={add.submit}
        disabled={!add.title.trim()}
      >
        Add
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={layout.button}
        onClick={add.close}
      >
        Cancel
      </Button>
    </div>
  );
}

export function AddModuleForm() {
  return (
    <AddTitleForm
      fields={{ intent: "add-module" }}
      successMessage="Module added."
      placeholder="Module title..."
      layout={{ wrapper: "mt-4", input: "", button: "" }}
      openButton={{
        variant: "outline",
        className: "mt-4",
        label: (
          <>
            <Plus className="mr-1.5 size-4" />
            Add Module
          </>
        ),
      }}
    />
  );
}

export function AddLessonForm({ moduleId }: { moduleId: number }) {
  return (
    <AddTitleForm
      fields={{ intent: "add-lesson", moduleId: String(moduleId) }}
      successMessage="Lesson added."
      placeholder="Lesson title..."
      layout={{ wrapper: "mt-2", input: "text-sm", button: "h-8" }}
      openButton={{
        variant: "ghost",
        className: "mt-2 text-muted-foreground",
        label: (
          <>
            <Plus className="mr-1 size-3.5" />
            Add Lesson
          </>
        ),
      }}
    />
  );
}
