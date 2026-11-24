import { z } from "zod";
import { CourseStatus } from "~/db/schema";

function idList(missing: string) {
  return z
    .string()
    .min(1, missing)
    .transform((raw, refinement) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        refinement.addIssue({
          // Stryker disable next-line StringLiteral: only `message` is read; zod accepts any code string here.
          code: "custom",
          message: "IDs must be valid JSON.",
        });
        return z.NEVER;
      }
    })
    .pipe(
      z.array(z.number().int(), { message: "IDs must be a list of numbers." })
    );
}

export const courseEditorActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("update-title"),
    title: z.string().trim().min(1, "Title cannot be empty."),
  }),
  z.object({
    intent: z.literal("update-description"),
    description: z.string().trim().min(1, "Description cannot be empty."),
  }),
  z.object({
    intent: z.literal("update-status"),
    status: z.nativeEnum(CourseStatus),
  }),
  z.object({ intent: z.literal("update-price"), price: z.string() }),
  z.object({
    intent: z.literal("update-ppp-enabled"),
    pppEnabled: z.enum(["true", "false"]),
  }),
  z.object({
    intent: z.literal("add-module"),
    title: z.string().trim().min(1, "Module title cannot be empty."),
  }),
  z.object({
    intent: z.literal("rename-module"),
    moduleId: z.coerce.number().int(),
    title: z.string().trim().min(1, "Module title cannot be empty."),
  }),
  z.object({
    intent: z.literal("delete-module"),
    moduleId: z.coerce.number().int(),
  }),
  z.object({
    intent: z.literal("add-lesson"),
    moduleId: z.coerce.number().int(),
    title: z.string().trim().min(1, "Lesson title cannot be empty."),
  }),
  z.object({
    intent: z.literal("rename-lesson"),
    lessonId: z.coerce.number().int(),
    title: z.string().trim().min(1, "Lesson title cannot be empty."),
  }),
  z.object({
    intent: z.literal("reorder-modules"),
    moduleIds: idList("Missing module IDs."),
  }),
  z.object({
    intent: z.literal("reorder-lessons"),
    moduleId: z.coerce.number().int(),
    lessonIds: idList("Missing lesson IDs."),
  }),
  z.object({
    intent: z.literal("move-lesson"),
    lessonId: z.coerce.number().int(),
    targetModuleId: z.coerce.number().int(),
    targetPosition: z.coerce.number().int(),
  }),
  z.object({
    intent: z.literal("delete-lesson"),
    lessonId: z.coerce.number().int(),
  }),
  z.object({
    intent: z.literal("update-sales-copy"),
    salesCopy: z.string().trim().min(1, "Sales copy cannot be empty."),
  }),
]);
