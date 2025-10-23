import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.test" });
process.env.ROLLUP_SKIP_NODEJS_NATIVE = "true";
