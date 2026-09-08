"use server";

import { revalidatePath } from "next/cache";
import {
  saveWebRecord,
  setTaskCompleted,
  setCustomerStage,
  logActivity,
  removeWebRecord,
  removeExamples,
  completeFirstRun,
} from "./mutations";
import type { ActionResult } from "./types";

async function executeAction(
  operation: () => unknown | Promise<unknown>,
): Promise<ActionResult> {
  try {
    await operation();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("OpenCadence action failed:", error);
    return {
      ok: false,
      error:
        error instanceof Error && !("code" in error)
          ? error.message
          : "Couldn't save your changes. Please try again.",
    };
  }
}
export async function saveItem(data: FormData): Promise<ActionResult> {
  return executeAction(() => saveWebRecord(data));
}
export async function toggleTask(
  id: string,
  done: boolean,
): Promise<ActionResult> {
  return executeAction(() => setTaskCompleted(id, done));
}
export async function changeStage(
  id: string,
  stage: string,
): Promise<ActionResult> {
  return executeAction(() => setCustomerStage(id, stage));
}
export async function addActivity(data: FormData): Promise<ActionResult> {
  return executeAction(() => logActivity(data));
}
export async function deleteItem(
  kind: string,
  id: string,
  revision: number,
): Promise<ActionResult> {
  return executeAction(() => removeWebRecord(kind, id, revision));
}
export async function clearExamples(): Promise<ActionResult> {
  return executeAction(removeExamples);
}
export async function finishFirstRun(choice: string): Promise<ActionResult> {
  return executeAction(() => completeFirstRun(choice));
}
