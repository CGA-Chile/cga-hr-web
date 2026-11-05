import { afterAll } from "vitest";
import { service } from "./support";

/**
 * Files share one database, and close_period refuses a plan that leaves out anything owed up to
 * the period's end, so an assignment one file leaves behind can fail another file's close.
 */
afterAll(async () => {
  const { error } = await service.from("assignments").update({ deleted_at: new Date().toISOString() }).is("deleted_at", null);
  if (error) throw error;
});
