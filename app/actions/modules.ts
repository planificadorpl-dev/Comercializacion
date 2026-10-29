"use server";

import { revalidatePath } from "next/cache";
import {
  SystemModule,
  fetchAllModules,
  persistModuleStatus,
} from "@/lib/modules-service";

export type { SystemModule };

export async function getSystemModules() {
  return fetchAllModules();
}

export async function updateModuleStatus(
  moduleId: string,
  enabledForUsers: boolean,
  updatedBy?: string
) {
  const result = await persistModuleStatus(moduleId, enabledForUsers, updatedBy);

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/planificacion");
  revalidatePath("/competencia");

  return result;
}
