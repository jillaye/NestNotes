import { describe, it } from "node:test";
import assert from "node:assert";
import { canDelete, LOCAL_USER } from "./permissions.ts";
import type { User } from "@/types";

function makeUser(overrides: Partial<User> = {}): User {
  return { id: "user-id", role: "birder", ...overrides };
}

describe("canDelete", () => {
  it("allows admin to delete any record", () => {
    const admin = makeUser({ role: "admin" });
    const record = { created_by: "someone-else" };
    assert.strictEqual(canDelete(admin, record), true);
  });

  it("allows birder to delete their own record", () => {
    const birder = makeUser({ id: "birder-1", role: "birder" });
    const record = { created_by: "birder-1" };
    assert.strictEqual(canDelete(birder, record), true);
  });

  it("prevents birder from deleting another user's record", () => {
    const birder = makeUser({ id: "birder-1", role: "birder" });
    const record = { created_by: "birder-2" };
    assert.strictEqual(canDelete(birder, record), false);
  });

  it("v1 local admin always passes", () => {
    const record = { created_by: "anyone" };
    assert.strictEqual(canDelete(LOCAL_USER, record), true);
  });
});