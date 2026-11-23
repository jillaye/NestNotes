import type { User, SyncColumns } from "@/types";

/**
 * Check whether a user is allowed to delete a record.
 *
 * v1 rule (already the v2 rule): admin can delete anything;
 * birder can only delete records they created.
 *
 * With the v1 local user ({ id: 'local', role: 'admin' }) this always
 * returns true. v2 swaps the local user for a real one and RBAC is
 * already wired here — no other code changes needed.
 */
export function canDelete(
  user: User,
  record: Pick<SyncColumns, "created_by">,
): boolean {
  return user.role === "admin" || record.created_by === user.id;
}

export const LOCAL_USER_ID = "local";

export const LOCAL_USER: User = { id: LOCAL_USER_ID, role: "admin" };