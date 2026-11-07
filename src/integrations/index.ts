import { z } from "zod";
import { candidateSchema, type Candidate } from "../types";
export type Source = "pubchem" | "chembl";
export interface Provenance {
  source: string;
  retrievedAt: string;
  sourceUrl: string;
  cached: boolean;
}
export interface SearchResult {
  records: Candidate[];
  provenance: Provenance;
  hasMore: boolean;
}
export class SourceError extends Error {
  constructor(
    message: string,
    public status: "Unavailable" | "Rate Limited" | "Offline",
  ) {
    super(message);
  }
}
export const sources = {
  pubchem: { name: "PubChem", url: "https://pubchem.ncbi.nlm.nih.gov" },
  chembl: { name: "ChEMBL", url: "https://www.ebi.ac.uk/chembl/" },
};
const pubchem = z.object({
  PropertyTable: z.object({
    Properties: z.array(
      z.object({
        CID: z.number(),
        Title: z.string().optional(),
        ConnectivitySMILES: z.string().optional(),
        SMILES: z.string().optional(),
        CanonicalSMILES: z.string().optional(),
        InChIKey: z.string().optional(),
      }),
    ),
  }),
});
const chembl = z.object({
  molecules: z.array(
    z.object({
      molecule_chembl_id: z.string(),
      pref_name: z.string().nullable(),
      molecule_type: z.string().optional(),
      molecule_structures: z
        .object({ canonical_smiles: z.string().nullable() })
        .nullable()
        .optional(),
    }),
  ),
  page_meta: z.object({ next: z.string().nullable() }),
});
export interface DataAdapter {
  search(q: string, page?: number): Promise<SearchResult>;
  fetchById(id: string): Promise<SearchResult>;
  normalize(raw: unknown): Candidate[];
  getProvenance(): Provenance;
  handleErrors(error: unknown): SourceError;
}
function handleErrors(error: unknown) {
  return error instanceof SourceError
    ? error
    : new SourceError(
        error instanceof Error ? error.message : "Source request failed",
        "Unavailable",
      );
}
export function createAdapter(source: Source): DataAdapter {
  let provenance: Provenance = {
    source,
    sourceUrl: sources[source].url,
    retrievedAt: "",
    cached: false,
  };
  const normalize = (raw: unknown): Candidate[] => {
    const at = provenance.retrievedAt || new Date().toISOString();
    if (source === "pubchem")
      return pubchem.parse(raw).PropertyTable.Properties.map((r) =>
        candidateSchema.parse({
          id: crypto.randomUUID(),
          name: r.Title ?? `PubChem ${r.CID}`,
          modality: "small-molecule",
          smiles: r.SMILES ?? r.ConnectivitySMILES ?? r.CanonicalSMILES,
          source: "PubChem",
          sourceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${r.CID}`,
          retrievedAt: at,
          identifiers: {
            CID: String(r.CID),
            ...(r.InChIKey ? { InChIKey: r.InChIKey } : {}),
          },
        }),
      );
    return chembl.parse(raw).molecules.map((r) =>
      candidateSchema.parse({
        id: crypto.randomUUID(),
        name: r.pref_name ?? r.molecule_chembl_id,
        modality:
          (
            {
              Protein: "protein",
              Antibody: "antibody",
              Oligosaccharide: "custom",
              Cell: "cell",
              Oligonucleotide: "oligonucleotide",
            } as Record<string, string>
          )[r.molecule_type ?? ""] ??
          (r.molecule_type === "Small molecule" ? "small-molecule" : "custom"),
        smiles: r.molecule_structures?.canonical_smiles ?? undefined,
        source: "ChEMBL",
        sourceUrl: `https://www.ebi.ac.uk/chembl/explore/compound/${r.molecule_chembl_id}`,
        retrievedAt: at,
        identifiers: { ChEMBL: r.molecule_chembl_id },
      }),
    );
  };
  async function request(
    q: string,
    page = 0,
    id = false,
  ): Promise<SearchResult> {
    if (!q.trim() || q.length > 500)
      throw Error("Enter a query between 1 and 500 characters.");
    const key = `drugforge-cache:${source}:${id}:${q}:${page}`;
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(key);
    } catch {
      /* cache is optional */
    }
    try {
      let raw: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch(
          `/api/search?source=${source}&q=${encodeURIComponent(q.trim())}&page=${page}&id=${id}`,
          { signal: AbortSignal.timeout(20000) },
        );
        if (response.status === 429) {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          throw new SourceError(
            "Source rate limited. Try again later.",
            "Rate Limited",
          );
        }
        if (!response.ok)
          throw new SourceError(
            response.status === 404
              ? "No matching records."
              : `Source unavailable (HTTP ${response.status}).`,
            "Unavailable",
          );
        raw = await response.json();
        break;
      }
      provenance = {
        source,
        sourceUrl: sources[source].url,
        retrievedAt: new Date().toISOString(),
        cached: false,
      };
      const records = normalize(raw);
      const hasMore =
        source === "chembl" && chembl.parse(raw).page_meta.next !== null;
      const result = { records, provenance, hasMore };
      try {
        localStorage.setItem(key, JSON.stringify(result));
      } catch {
        /* optional cache */
      }
      return result;
    } catch (error) {
      if (cached) {
        const parsed = JSON.parse(cached);
        const records = z.array(candidateSchema).parse(parsed.records);
        const meta = z
          .object({
            source: z.string(),
            sourceUrl: z.string().url(),
            retrievedAt: z.string(),
            cached: z.boolean(),
          })
          .parse(parsed.provenance);
        return {
          records,
          provenance: { ...meta, cached: true },
          hasMore: false,
        };
      }
      throw handleErrors(error);
    }
  }
  return {
    search: (q, page) => request(q, page),
    fetchById: (id) => request(id, 0, true),
    normalize,
    getProvenance: () => provenance,
    handleErrors,
  };
}
export const referenceSources = [
  { name: "UniProt", url: "https://www.uniprot.org/" },
  { name: "RCSB PDB", url: "https://www.rcsb.org/" },
  { name: "Open Targets", url: "https://platform.opentargets.org/" },
  { name: "ClinicalTrials.gov", url: "https://clinicaltrials.gov/" },
];
