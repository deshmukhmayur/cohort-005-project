import { useEffect } from "react";
import { Link, useFetcher, type FetcherWithComponents } from "react-router";
import { toast } from "sonner";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DraggableProvidedDragHandleProps,
  type DropResult,
} from "@hello-pangea/dnd";
import { BookOpen, Clock, Eye, FileEdit, GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { formatDuration } from "~/lib/utils";
import { courseEditorDrag } from "~/modules/course-editor";
import {
  AddLessonForm,
  AddModuleForm,
  DeleteLessonButton,
  DeleteModuleButton,
  InlineEditableLessonTitle,
  InlineEditableModuleTitle,
} from "./module-editors";

type Lesson = {
  id: number;
  title: string;
  durationMinutes: number | null;
};

type Module = { id: number; title: string; lessons: Lesson[] };

type Course = { id: number; slug: string; modules: Module[] };

const revealOnHover =
  "md:opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100";

function useReorderToast(
  fetcher: FetcherWithComponents<{ success?: boolean; error?: string }>,
  successMessage: string
) {
  useEffect(() => {
    if (fetcher.state !== "idle") return;
    if (fetcher.data?.success) toast.success(successMessage);
    if (fetcher.data?.error) toast.error(fetcher.data.error);
  }, [fetcher.state, fetcher.data, successMessage]);
}

export function ContentTab({ course }: { course: Course }) {
  const reorderFetcher = useFetcher();
  const lessonReorderFetcher = useFetcher();
  useReorderToast(reorderFetcher, "Modules reordered.");
  useReorderToast(lessonReorderFetcher, "Lessons reordered.");

  function handleDragEnd(result: DropResult) {
    const submission = courseEditorDrag(result, course.modules);
    if (!submission) return;
    const fetcher =
      submission.fetcher === "modules" ? reorderFetcher : lessonReorderFetcher;
    fetcher.submit(submission.fields, { method: "post" });
  }

  return (
    <>
      {course.modules.length === 0 ? (
        <EmptyContent />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <ModuleList course={course} />
        </DragDropContext>
      )}
      <AddModuleForm />
    </>
  );
}

function EmptyContent() {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/50" />
        <p className="text-muted-foreground">
          No modules yet. Add your first module to start building content.
        </p>
      </CardContent>
    </Card>
  );
}

function ModuleList({ course }: { course: Course }) {
  return (
    <Droppable droppableId="modules" type="module">
      {(provided) => (
        <div
          className="space-y-3"
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          {course.modules.map((mod, index) => (
            <Draggable key={mod.id} draggableId={String(mod.id)} index={index}>
              {(dragProvided, snapshot) => (
                <div
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                >
                  <ModuleCard
                    course={course}
                    mod={mod}
                    isDragging={snapshot.isDragging}
                    handleProps={dragProvided.dragHandleProps}
                  />
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

type HandleProps = DraggableProvidedDragHandleProps | null | undefined;

function ModuleCard({
  course,
  mod,
  isDragging,
  handleProps,
}: {
  course: Course;
  mod: Module;
  isDragging: boolean;
  handleProps: HandleProps;
}) {
  const ring = isDragging ? "shadow-lg ring-2 ring-primary/50" : "";
  return (
    <Card className={`group gap-2 py-4 shadow-none ${ring}`}>
      <CardHeader className="px-4">
        <ModuleHeader mod={mod} handleProps={handleProps} />
      </CardHeader>
      <CardContent className="px-4">
        <LessonList course={course} mod={mod} />
        <AddLessonForm moduleId={mod.id} />
      </CardContent>
    </Card>
  );
}

function ModuleHeader({
  mod,
  handleProps,
}: {
  mod: Module;
  handleProps: HandleProps;
}) {
  const count = mod.lessons.length;
  return (
    <div className="flex items-center gap-2">
      <div
        {...handleProps}
        className={`cursor-grab rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing ${revealOnHover}`}
      >
        <GripVertical className="size-5" />
      </div>
      <div className="flex flex-1 items-baseline gap-2">
        <InlineEditableModuleTitle value={mod.title} moduleId={mod.id} />
        <span className="text-xs text-muted-foreground">
          {count} {count === 1 ? "lesson" : "lessons"}
        </span>
      </div>
      <div className={revealOnHover}>
        <DeleteModuleButton moduleId={mod.id} moduleTitle={mod.title} />
      </div>
    </div>
  );
}

function LessonList({ course, mod }: { course: Course; mod: Module }) {
  if (mod.lessons.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-muted-foreground">No lessons yet.</p>
    );
  }
  return (
    <Droppable droppableId={`lessons-${mod.id}`} type="lesson">
      {(provided) => (
        <ul
          className="divide-y divide-border/50"
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          {mod.lessons.map((lesson, index) => (
            <Draggable
              key={lesson.id}
              draggableId={`lesson-${lesson.id}`}
              index={index}
            >
              {(dragProvided, snapshot) => (
                <li
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                >
                  <LessonRow
                    course={course}
                    lesson={lesson}
                    isDragging={snapshot.isDragging}
                    handleProps={dragProvided.dragHandleProps}
                  />
                </li>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </ul>
      )}
    </Droppable>
  );
}

function LessonRow({
  course,
  lesson,
  isDragging,
  handleProps,
}: {
  course: Course;
  lesson: Lesson;
  isDragging: boolean;
  handleProps: HandleProps;
}) {
  const dragging = isDragging
    ? "bg-muted shadow-md ring-1 ring-primary/30"
    : "";
  return (
    <div
      className={`group flex items-center gap-2 rounded-md px-2 py-1 text-sm ${dragging}`}
    >
      <div
        {...handleProps}
        className={`cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing ${revealOnHover}`}
      >
        <GripVertical className="size-4" />
      </div>
      <div className="flex-1">
        <InlineEditableLessonTitle value={lesson.title} lessonId={lesson.id} />
      </div>
      <LessonDuration minutes={lesson.durationMinutes} />
      <div className={`flex items-center gap-1 ${revealOnHover}`}>
        <LessonLink
          to={`/courses/${course.slug}/lessons/${lesson.id}`}
          title="View lesson"
        >
          <Eye className="size-3.5" />
        </LessonLink>
        <LessonLink
          to={`/instructor/${course.id}/lessons/${lesson.id}`}
          title="Edit lesson"
        >
          <FileEdit className="size-3.5" />
        </LessonLink>
        <DeleteLessonButton lessonId={lesson.id} lessonTitle={lesson.title} />
      </div>
    </div>
  );
}

function LessonDuration({ minutes }: { minutes: number | null }) {
  if (!minutes) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="size-3" />
      {formatDuration(minutes, true, false, false)}
    </span>
  );
}

function LessonLink({
  to,
  title,
  children,
}: {
  to: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} title={title} aria-label={title}>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
      >
        {children}
      </Button>
    </Link>
  );
}
