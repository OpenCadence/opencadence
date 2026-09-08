import { z } from "zod";
import { isCalendarDate } from "../lib/validation";
import {
  activityKinds,
  relationshipStatuses,
  stages,
  taskStates,
} from "../lib/types";

export const id = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe(
    "Exact record ID returned by a list, search, get, or create tool. Never guess an ID.",
  );
export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate, "Use a real calendar date in YYYY-MM-DD format.");
const optionalDate = z
  .union([calendarDate, z.literal("")])
  .describe(
    "Local calendar date YYYY-MM-DD. Empty string clears the date; omission preserves it on update.",
  );
const link = id
  .nullable()
  .describe(
    "Exact linked record ID; null removes the link. Omit to leave it unchanged on update.",
  );
export const taskFields = {
  title: z.string().trim().min(1).max(200),
  project_id: link.optional(),
  customer_id: link.optional(),
  priority: z.enum(["Normal", "High"]).optional(),
  due: optionalDate.optional(),
  state: z
    .enum(taskStates)
    .optional()
    .describe(
      "Who owns the next move. Set actionable to clear a waiting state.",
    ),
};
export const projectFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional(),
  customer_id: link.optional(),
  status: z.enum(["Active", "Paused", "Completed"]).optional(),
  due: optionalDate.optional(),
  color: z.enum(["green", "purple", "orange", "blue"]).optional(),
};
export const customerFields = {
  name: z.string().trim().min(1).max(200),
  contact: z.string().max(200).optional(),
  email: z.union([z.email().max(254), z.literal("")]).optional(),
  stage: z.enum(stages).optional(),
  relationship_status: z.enum(relationshipStatuses).optional(),
  follow_up: optionalDate.optional(),
  details: z.string().max(6000).optional(),
};
export const noteFields = {
  title: z.string().trim().min(1).max(200),
  body: z
    .string()
    .max(50000)
    .optional()
    .describe(
      "Plain text. An update replaces the full body; read the existing note first to append safely.",
    ),
  project_id: link.optional(),
  customer_id: link.optional(),
};
export const paging = {
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).max(1000000).default(0),
};
export const commonList = {
  ...paging,
  query: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Literal, case-insensitive substring search, not SQL wildcards."),
  include_examples: z
    .boolean()
    .default(true)
    .describe("Set false to omit example records."),
};
export const taskList = {
  ...commonList,
  status: z.enum(["open", "completed", "all"]).default("open"),
  project_id: link.optional(),
  customer_id: link.optional(),
  priority: z.enum(["Normal", "High"]).optional(),
  state: z.enum(taskStates).optional(),
  due_on: calendarDate.optional(),
  due_before: calendarDate
    .optional()
    .describe(
      "Inclusive: tasks dated on or before this day. Undated tasks are excluded.",
    ),
  due_after: calendarDate
    .optional()
    .describe("Inclusive: tasks dated on or after this day."),
};
export const projectList = {
  ...commonList,
  status: z.enum(["Active", "Paused", "Completed", "all"]).default("all"),
  customer_id: link.optional(),
};
export const customerList = {
  ...commonList,
  stage: z.enum(stages).optional(),
  relationship_status: z.enum(relationshipStatuses).optional(),
};
export const noteList = {
  ...commonList,
  project_id: link.optional(),
  customer_id: link.optional(),
};
export const activityFields = {
  customer_id: id,
  body: z.string().trim().min(1).max(10000),
  kind: z.enum(activityKinds).default("Note"),
};
