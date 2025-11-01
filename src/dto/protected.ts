import { z } from "zod";

export const ProtectedUserParamsSchema = z.object({
  userId: z.string().uuid(),
});

export type ProtectedUserParams = z.infer<typeof ProtectedUserParamsSchema>;
