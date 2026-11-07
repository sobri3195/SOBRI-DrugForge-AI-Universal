interface Mol {
  get_smiles(): string;
  get_descriptors(): string;
  get_svg(): string;
  get_morgan_fp(): string;
  delete(): void;
  is_valid(): boolean;
}
interface RDKit {
  get_mol: (input: string) => Mol | null;
  version: () => string;
}
declare global {
  interface Window {
    initRDKitModule?: (options: {
      locateFile: (file: string) => string;
    }) => Promise<RDKit>;
  }
}
let ready: Promise<RDKit> | undefined;
export function rdkit(): Promise<RDKit> {
  return (ready ??= new Promise<void>((resolve, reject) => {
    if (window.initRDKitModule) return resolve();
    const script = document.createElement("script");
    script.src = "/rdkit/RDKit_minimal.js";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(Error("RDKit assets could not load. Run npm run assets."));
    document.head.append(script);
  })
    .then(() =>
      window.initRDKitModule!({ locateFile: (file) => `/rdkit/${file}` }),
    )
    .catch((error) => {
      ready = undefined;
      throw error;
    }));
}
export const descriptorLabels: Record<string, string> = {
  amw: "Molecular weight",
  CrippenClogP: "cLogP",
  tpsa: "TPSA",
  NumHBD: "H-bond donors",
  NumHBA: "H-bond acceptors",
  NumRotatableBonds: "Rotatable bonds",
  NumRings: "Ring count",
  NumHeavyAtoms: "Heavy atoms",
};
export async function analyze(input: string) {
  if (!input.trim()) throw Error("Enter a molecular structure.");
  const kit = await rdkit();
  let mol: Mol | null = null;
  try {
    mol = kit.get_mol(input);
    if (!mol || !mol.is_valid()) throw Error("Invalid molecular structure.");
    const all = JSON.parse(mol.get_descriptors()) as Record<string, number>;
    const descriptors = Object.fromEntries(
      Object.keys(descriptorLabels)
        .filter((k) => Number.isFinite(all[k]))
        .map((k) => [k, all[k]]),
    );
    return {
      canonical: mol.get_smiles(),
      descriptors,
      svg: mol.get_svg(),
      fingerprint: mol.get_morgan_fp(),
      software: `RDKit ${kit.version()}`,
    };
  } finally {
    mol?.delete();
  }
}
export function tanimoto(a: string, b: string) {
  if (!/^[01]+$/.test(a) || a.length !== b.length || !/^[01]+$/.test(b))
    throw Error("Incompatible fingerprints.");
  let intersection = 0,
    union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "1" && b[i] === "1") intersection++;
    if (a[i] === "1" || b[i] === "1") union++;
  }
  return union ? intersection / union : 1;
}
export function ruleOfFive(d: Record<string, number>) {
  const rules: [string, string, number][] = [
    ["amw", "Molecular weight", 500],
    ["CrippenClogP", "cLogP", 5],
    ["NumHBD", "H-bond donors", 5],
    ["NumHBA", "H-bond acceptors", 10],
  ];
  return rules.map(([key, label, limit]) => ({
    label,
    limit,
    value: d[key],
    status:
      d[key] === undefined
        ? "Unavailable"
        : d[key] <= limit
          ? "Pass"
          : "Violation",
  }));
}
