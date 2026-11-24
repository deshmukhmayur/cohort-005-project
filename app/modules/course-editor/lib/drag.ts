export type DragResult = {
  type: string;
  source: { droppableId: string; index: number };
  destination?: { droppableId: string; index: number } | null;
};

export type EditorModules = {
  id: number;
  lessons: { id: number }[];
}[];

export type DragSubmission =
  | { fetcher: "modules"; fields: Record<string, string> }
  | { fetcher: "lessons"; fields: Record<string, string> };

const LESSON_DROPPABLE_PREFIX = "lessons-";

function moduleIdOf(droppableId: string) {
  return parseInt(droppableId.replace(LESSON_DROPPABLE_PREFIX, ""), 10);
}

function moveItem<T>(items: T[], from: number, to: number) {
  const reordered = Array.from(items);
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  return reordered;
}

function lessonSubmission(
  result: DragResult & { destination: NonNullable<DragResult["destination"]> },
  modules: EditorModules
): DragSubmission | null {
  const { source, destination } = result;
  const sourceModuleId = moduleIdOf(source.droppableId);
  const destModuleId = moduleIdOf(destination.droppableId);
  const sourceModule = modules.find((m) => m.id === sourceModuleId);
  if (!sourceModule) return null;

  if (sourceModuleId === destModuleId) {
    const lessonIds = moveItem(
      sourceModule.lessons,
      source.index,
      destination.index
    ).map((l) => l.id);
    return {
      fetcher: "lessons",
      fields: {
        intent: "reorder-lessons",
        moduleId: String(sourceModuleId),
        lessonIds: JSON.stringify(lessonIds),
      },
    };
  }

  const lesson = sourceModule.lessons[source.index];
  if (!lesson) return null;
  return {
    fetcher: "lessons",
    fields: {
      intent: "move-lesson",
      lessonId: String(lesson.id),
      targetModuleId: String(destModuleId),
      // Positions are 1-based.
      targetPosition: String(destination.index + 1),
    },
  };
}

export function dragSubmission(
  result: DragResult,
  modules: EditorModules
): DragSubmission | null {
  const { source, destination } = result;
  if (!destination) return null;
  if (
    source.droppableId === destination.droppableId &&
    source.index === destination.index
  ) {
    return null;
  }

  if (result.type === "module") {
    const moduleIds = moveItem(modules, source.index, destination.index).map(
      (m) => m.id
    );
    return {
      fetcher: "modules",
      fields: {
        intent: "reorder-modules",
        moduleIds: JSON.stringify(moduleIds),
      },
    };
  }

  if (result.type !== "lesson") return null;
  return lessonSubmission({ ...result, destination }, modules);
}
