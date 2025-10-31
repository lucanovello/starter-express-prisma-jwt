export default {
  "*.{ts,js,mjs,cjs}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"],
  "*.prisma": ["prettier --write"],
};
