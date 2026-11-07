import { z } from "zod";
export const candidateSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  modality: z.string(),
  smiles: z.string().optional(),
  sequence: z.string().optional(),
  notes: z.string().default(""),
  source: z.string(),
  sourceUrl: z
    .string()
    .url()
    .refine(
      (value) => new URL(value).protocol === "https:",
      "Source links must use HTTPS",
    )
    .optional(),
  retrievedAt: z.string(),
  identifiers: z.record(z.string()).default({}),
});
export type Candidate = z.infer<typeof candidateSchema>;
export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  modality: z.string(),
  customModality: z.string().default(""),
  disease: z.string(),
  target: z.string(),
  question: z.string(),
  area: z.string(),
  hypothesis: z.string(),
  studyDesign: z.string(),
  dataset: z.string(),
  methods: z.string(),
  validation: z.string(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
  versions: z
    .array(z.object({ at: z.string(), snapshot: z.record(z.string()) }))
    .default([]),
});
export type Project = z.infer<typeof projectSchema>;
export const analysisSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  candidateId: z.string(),
  name: z.string(),
  input: z.string(),
  canonical: z.string(),
  descriptors: z.record(z.number()),
  svg: z.string(),
  fingerprint: z.string(),
  software: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  status: z.literal("Completed"),
  method: z.literal("RDKit descriptors"),
  warnings: z.array(z.string()),
  stale: z.boolean(),
});
export type Analysis = z.infer<typeof analysisSchema>;
export const stateSchema = z.object({
  schemaVersion: z.literal(1),
  projects: z.array(projectSchema),
  candidates: z.array(candidateSchema),
  analyses: z.array(analysisSchema),
  theme: z.enum(["dark", "light"]),
  savedSearches: z.array(z.string()).default([]),
});
export type AppState = z.infer<typeof stateSchema>;
