import express from "express";
import dotenv from "dotenv";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { AppError } from "./lib/errors.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (req, res, next) => {
  res.status(200).json({ status: "ok" });
});

app.get("/test/app-error", (req, res, next) => {
  next(new AppError("This is a test AppError"));
});

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port http://localhost:${port}`);
});
