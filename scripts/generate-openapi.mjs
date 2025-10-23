/**
 * Writes the generated OpenAPI document from dist/ to openapi.json at repo root.
 * Useful for publishing docs artifacts or feeding client generators.
 */
import fs from "node:fs";

import openapi from "../dist/docs/openapi.js";

fs.writeFileSync("openapi.json", JSON.stringify(openapi, null, 2), "utf-8");
console.log("openapi.json written");
