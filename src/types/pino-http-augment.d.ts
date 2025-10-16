import "express-serve-static-core";
import type { ReqId } from "pino-http";

declare module "express-serve-static-core" {
  interface Request {
    id?: ReqId;
  }
}
