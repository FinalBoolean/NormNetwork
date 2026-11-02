import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import type { SessionUser } from "../src/App.js";
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser | null;
    }
    interface Locals {
      db?: Kysely<Database>;
      currentUser?: SessionUser | null;
      currentPath?: string;
    }
  }
}
