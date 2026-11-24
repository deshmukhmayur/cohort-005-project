import { dragSubmission } from "./lib/drag";

export type { DragResult, DragSubmission, EditorModules } from "./lib/drag";

/**
 * What to post when the instructor drops a module or lesson in the Content
 * tab: a module reorder, a lesson reorder inside one module, or a move of a
 * lesson to another module. Returns null when the drop changes nothing.
 */
export const courseEditorDrag = dragSubmission;
