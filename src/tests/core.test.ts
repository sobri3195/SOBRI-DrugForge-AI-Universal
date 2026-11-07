import { describe, it, expect, vi, beforeAll } from "vitest";
import { modalities, modality } from "../core/modality-registry";
import { analyzeSequence } from "../core/sequence";
import { ruleOfFive, tanimoto } from "../core/chemistry";
import { stateSchema, candidateSchema } from "../types";
import { createAdapter } from "../integrations";
import { upstream } from "../../api/search";
const candidate = candidateSchema.parse({
  id: "x",
  name: "Record",
  modality: "vaccine",
  source: "User input",
  retrievedAt: "2026-01-01",
});
describe("modality capabilities", () => {
  it("has 23 distinct modalities and rejects incompatible molecular analysis", async () => {
    expect(new Set(modalities.map((m) => m.id)).size).toBe(23);
    for (const id of ["vaccine", "antibody", "mrna", "cell", "gene"]) {
      expect(modality(id).getAvailableCapabilities().descriptors).toBe(
        "Not Applicable",
      );
      await expect(
        modality(id).executeSupportedAnalysis("descriptors", {
          ...candidate,
          modality: id,
        }),
      ).rejects.toThrow("Not Applicable");
    }
  });
  it("reports external engines and datasets honestly", () => {
    const c = modality("small-molecule").getAvailableCapabilities();
    expect(c.docking).toBe("Requires External Engine");
    expect(c.prediction).toBe("Requires Dataset");
  });
  it("requires structures for compatible modalities", () => {
    expect(
      modality("small-molecule").validateInput({
        ...candidate,
        modality: "small-molecule",
      }),
    ).toContain("SMILES is required for molecular analysis.");
  });
});
describe("sequence validation", () => {
  it("normalizes FASTA and counts composition from the input", () => {
    const result = analyzeSequence(">peptide\nACDACA");
    expect(result.length).toBe(6);
    expect(result.composition).toEqual({ A: 3, C: 2, D: 1 });
  });
  it("validates nucleotides and rejects unsupported alphabets", () => {
    expect(analyzeSequence("ACGU", true).length).toBe(4);
    expect(() => analyzeSequence("A$C")).toThrow();
    expect(() => analyzeSequence("Z", true)).toThrow();
  });
});
describe("calculation helpers", () => {
  it("calculates Tanimoto and rejects mismatched fingerprints", () => {
    expect(tanimoto("1100", "1010")).toBeCloseTo(1 / 3);
    expect(tanimoto("1100", "1100")).toBe(1);
    expect(() => tanimoto("1", "11")).toThrow();
  });
  it("keeps missing descriptors unavailable", () => {
    expect(ruleOfFive({ amw: 501 })[0].status).toBe("Violation");
    expect(ruleOfFive({})[0].status).toBe("Unavailable");
  });
});
describe("API normalization and proxy boundary", () => {
  it("rejects executable links in imported candidate metadata", () => {
    expect(() =>
      candidateSchema.parse({ ...candidate, sourceUrl: "javascript:alert(1)" }),
    ).toThrow();
  });
  it("validates a PubChem record and preserves provenance", () => {
    const adapter = createAdapter("pubchem");
    const [c] = adapter.normalize({
      PropertyTable: {
        Properties: [
          {
            CID: 2244,
            Title: "Aspirin",
            ConnectivitySMILES: "CC(=O)OC1=CC=CC=C1C(=O)O",
          },
        ],
      },
    });
    expect(c.identifiers.CID).toBe("2244");
    expect(c.source).toBe("PubChem");
    expect(c.smiles).toContain("C(=O)O");
    expect(() =>
      adapter.normalize({ message: "HTTP 200 but no record" }),
    ).toThrow();
  });
  it("does not map unknown ChEMBL modalities to small molecules", () => {
    const [c] = createAdapter("chembl").normalize({
      molecules: [
        {
          molecule_chembl_id: "CHEMBL1",
          pref_name: "Unknown",
          molecule_type: "Unknown",
        },
      ],
      page_meta: { next: null },
    });
    expect(c.modality).toBe("custom");
  });
  it("rejects arbitrary hosts, excessive pages and empty input", () => {
    expect(() =>
      upstream("https://evil.example", "aspirin", 0, false),
    ).toThrow();
    expect(() => upstream("pubchem", "", 0, false)).toThrow();
    expect(() => upstream("chembl", "aspirin", 101, false)).toThrow();
    const url = new URL(upstream("pubchem", "https://evil.example", 0, false));
    expect(url.hostname).toBe("pubchem.ncbi.nlm.nih.gov");
  });
});
describe("persistence and exports", () => {
  beforeAll(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    });
    vi.stubGlobal("window", { addEventListener: () => {} });
  });
  it("roundtrips projects and rejects incompatible schema versions", async () => {
    const { emptyState, parseBackup, update, STORAGE_KEY } =
      await import("../storage");
    const s = emptyState();
    s.candidates.push(candidate);
    update(() => s);
    expect(parseBackup(localStorage.getItem(STORAGE_KEY)!)).toEqual(s);
    expect(() => parseBackup('{"schemaVersion":999}')).toThrow();
    expect(stateSchema.safeParse({}).success).toBe(false);
  });
  it("quotes CSV and neutralizes spreadsheet formulas", async () => {
    const { csv } = await import("../storage");
    const result = csv([{ name: '=HYPERLINK("x")', notes: "a,b\nc" }]);
    expect(result).toContain("'=HYPERLINK");
    expect(result).toContain('"a,b\nc"');
  });
});
