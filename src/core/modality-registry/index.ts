import type { Candidate } from "../../types";
export type CapabilityStatus =
  | "Available"
  | "Requires Dataset"
  | "Requires External Engine"
  | "Experimental"
  | "Not Applicable";
export type AnalysisKind =
  | "descriptors"
  | "similarity"
  | "sequence"
  | "prediction"
  | "docking"
  | "evidence";
export interface ModalityAdapter {
  id: string;
  displayName: string;
  supportedInputs: string[];
  supportedAnalyses: AnalysisKind[];
  validateInput: (candidate: Candidate) => string[];
  getAvailableCapabilities: () => Record<AnalysisKind, CapabilityStatus>;
  normalizeCandidate: (candidate: Candidate) => Candidate;
  executeSupportedAnalysis: (
    kind: AnalysisKind,
    candidate: Candidate,
  ) => Promise<unknown>;
}
const entries = [
  ["small-molecule", "Small Molecule Drugs", "molecule"],
  ["generic", "Generic Drugs", "molecule"],
  ["branded", "Branded Drugs", "molecule"],
  ["investigational", "Investigational Compounds", "molecule"],
  ["repurposing", "Drug Repurposing Candidates", "molecule"],
  ["natural-product", "Natural Products", "molecule"],
  ["herbal", "Herbal Medicines", "metadata"],
  ["peptide", "Peptide Therapeutics", "protein"],
  ["protein", "Protein Therapeutics", "protein"],
  ["antibody", "Monoclonal Antibodies", "protein"],
  ["biosimilar", "Biosimilars", "protein"],
  ["oligonucleotide", "Oligonucleotide Therapeutics", "nucleotide"],
  ["sirna", "siRNA / Antisense Therapeutics", "nucleotide"],
  ["mrna", "mRNA Therapeutics", "nucleotide"],
  ["vaccine", "Vaccines", "metadata"],
  ["cell", "Cell Therapies", "metadata"],
  ["gene", "Gene Therapies", "metadata"],
  ["radiopharmaceutical", "Radiopharmaceuticals", "metadata"],
  ["combination", "Drug Combinations", "metadata"],
  ["nanomedicine", "Nanomedicine", "metadata"],
  ["delivery", "Advanced Drug Delivery Systems", "metadata"],
  ["gas", "Medical Gases and Special Modalities", "metadata"],
  ["custom", "Custom / Research-Defined Modality", "metadata"],
] as const;
export const modalities: ModalityAdapter[] = entries.map(
  ([id, displayName, type]) => {
    const molecule = type === "molecule",
      sequence = type === "protein" || type === "nucleotide";
    const capabilities: Record<AnalysisKind, CapabilityStatus> = {
      descriptors: molecule ? "Available" : "Not Applicable",
      similarity: molecule ? "Available" : "Not Applicable",
      sequence: sequence ? "Available" : "Not Applicable",
      prediction: molecule ? "Requires Dataset" : "Not Applicable",
      docking: molecule ? "Requires External Engine" : "Not Applicable",
      evidence: "Available",
    };
    return {
      id,
      displayName,
      supportedInputs: molecule
        ? ["SMILES", "metadata"]
        : sequence
          ? ["sequence", "metadata"]
          : ["metadata"],
      supportedAnalyses: (Object.keys(capabilities) as AnalysisKind[]).filter(
        (k) => capabilities[k] === "Available",
      ),
      getAvailableCapabilities: () => capabilities,
      validateInput: (c) => {
        const errors = [];
        if (!c.name.trim()) errors.push("A candidate name is required.");
        if (molecule && !c.smiles?.trim())
          errors.push("SMILES is required for molecular analysis.");
        if (sequence && !c.sequence?.trim())
          errors.push("A sequence is required.");
        return errors;
      },
      normalizeCandidate: (c) => ({
        ...c,
        name: c.name.trim(),
        sequence: c.sequence?.replace(/\s/g, "").toUpperCase(),
      }),
      async executeSupportedAnalysis(kind, c) {
        if (capabilities[kind] !== "Available")
          throw Error(`${kind}: ${capabilities[kind]}`);
        if (kind === "descriptors") {
          const { analyze } = await import("../chemistry");
          return analyze(c.smiles || "");
        }
        if (kind === "sequence") {
          const { analyzeSequence } = await import("../sequence");
          return analyzeSequence(c.sequence || "", type === "nucleotide");
        }
        throw Error(
          "Use the comparison or evidence workspace for this operation.",
        );
      },
    };
  },
);
export function modality(id: string) {
  return (
    modalities.find((m) => m.id === id) ?? modalities[modalities.length - 1]
  );
}
export function canAnalyze(c: Candidate) {
  return (
    modality(c.modality).getAvailableCapabilities().descriptors ===
      "Available" && !!c.smiles
  );
}
