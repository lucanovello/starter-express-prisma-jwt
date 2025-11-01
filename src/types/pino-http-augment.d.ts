import "express-serve-static-core";
import type { Role } from "@prisma/client";
import type { ReqId } from "pino-http";

declare module "express-serve-static-core" {
  interface Request {
    id: ReqId;
    user?: {
      id: string;
      role: Role;
      sessionId: string | null;
    };
  }
}
