/**
 * Server entrypoint. Keep process boot isolated from tests.
 */
import "dotenv/config"; // ensure .env is loaded before any module reads env
import app from "./app.js";

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
