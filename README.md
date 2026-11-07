# SOBRI UNIVERSAL DRUGFORGE AI

Universal AI-Powered Drug Discovery & Development Research Platform.
Founder / Researcher: **Muhammad Sobri Maulana**.

This first implementation focuses on the Phase 1–2 computational research workflow. It is not the completed five-phase platform. No activity, docking, toxicity, clinical benefit, or patient-safety scores are invented.

## Run locally

Requires Node.js **24.14.1 or newer in the 24.x series**, npm, and a browser with WebAssembly support.

```sh
npm ci
npm run dev
```

Open the address Vite prints. `npm ci` copies the pinned RDKit JavaScript and WASM files into `public/rdkit`. Run `npm run assets` to refresh those files. Ketcher Standalone includes Indigo; no chemistry server is required. Its editor loads in a separate same-origin page so the large editor bundle and CSS do not load on other screens.

No environment variables, login, API secrets or server database are required. Vite serves the fixed-source API handler in development. `npm run preview` serves production static files only; scientific search needs Vercel Functions or `vercel dev` in production-like local use.

## Implemented workflows

- Responsive desktop/sidebar and mobile/bottom navigation, keyboard focus, dark/light preferences, proper client routing and error boundary.
- 23 modality adapters with distinct compatible input types and analysis capability gates. Custom indications, targets and modality annotations are unrestricted.
- Local project creation, autosave on edits, rename, duplicate, archive, version snapshots, changed-field comparison, restore, JSON import/export and CSV export.
- PubChem name/CID lookup and ChEMBL search/identifier adapters, validated source responses, provenance, bounded rate-limit retry, pagination for ChEMBL, local search cache and labelled offline fallback. Live connectivity is **unverified in the current managed environment** because destination policy denies those hosts. Fixtures validate the application contract, not current remote API compatibility.
- Custom candidate records across all modalities, JSON candidate import/export, CSV export. Raw source metadata and user records are labelled distinctly.
- Ketcher Standalone interactive 2D editing. Load a candidate into the editor, draw/edit, then click **Use edited structure**, followed by **Validate & calculate**.
- Actual RDKit WebAssembly validation, canonical SMILES, SVG drawing, supported descriptors, Morgan fingerprints and Tanimoto, rule-of-five heuristic, structure history and descriptor recalculation. Previous structure calculations are marked superseded; edited inputs are identified as stale until explicitly recalculated.
- Calculation records with input snapshots, project associations, timestamps, method and RDKit version. Calculations can be exported, deleted and opened for a rerun in the designer.
- Candidate/version comparison tables and property bar charts, CSV export.
- Basic protein/peptide/nucleotide validation, single-record FASTA import, length and residue composition. These are descriptive sequence properties, not activity evidence.
- Project reports containing recorded findings, source links, limitations, JSON/CSV export and print-to-PDF using the browser.
- Versioned, validated localStorage backups/restores, corrupt-data recovery warning, raw backup export, cache clearing, quota inspection and reset confirmation. Schema version 1 is the only supported schema; unknown versions are rejected without changing current state.

## Scientific and implementation limits

- ChEMBL and PubChem do not cover all modalities or every search field in the full specification. Other modalities can be entered/imported as research records. Generic/branded/investigational/repurposing candidates require a small-molecule structure to use their molecular adapter; use the underlying biologic modality for biologic products.
- UniProt, RCSB, Open Targets and ClinicalTrials.gov are reference links, **not integrated API adapters**. Live API documentation could not be accessed under the environment's network policy; verify current schemas and licenses before claiming remote compatibility.
- Later modules have explicit pending routes: model training, assay CSV import, scaffold split, screening, Pareto optimization, structured evidence tracking, formulation-specific schemas and dedicated natural-product/repurposing tools. No compatible trained model is included. There is no docking engine or ADMET prediction.
- IndexedDB, PWA/offline app installation, structural alerts, sequence mass, arbitrary MOL/SDF file ingestion, model uncertainty and PDF rendering beyond browser printing remain pending.
- Ketcher/Indigo is a large dependency (the editor bundle is approximately 29 MB before gzip); initial editor load can be slow on mobile. The main workspace loads independently.
- Storage is browser/origin-specific and not encrypted. Export backups. Do not store secrets or sensitive patient data. Imported datasets/models are not supported yet; localStorage is intended for modest research metadata.
- Calculated descriptors are not a biological activity assay. The rule of five is a heuristic. Computational findings require independent experimental validation.

The original requested scope is preserved in [docs/REQUIREMENTS.id.txt](docs/REQUIREMENTS.id.txt).

## Tests

```sh
npm test
npm run build
# Chromium on this environment is /usr/bin/chromium:
npm run test:e2e
# Validate the built static application with fixture API boundaries:
TEST_PRODUCTION=1 npm run test:e2e
# On another machine install Chromium, then set its executable path:
npx playwright install chromium
CHROMIUM_PATH=/path/to/chrome npm run test:e2e
```

Unit tests cover capabilities, invalid inputs, sequence validation, API fixtures, CSV escaping, persistence schemas and the proxy boundary. Browser tests cover project persistence/history, a fixture-based aspirin lookup followed by real RDKit and Ketcher calculations, compatible/incompatible modalities, exports, API errors/offline fallback and mobile theme/navigation. Mock fixtures are used only at the external API boundary; chemistry is computed by the actual WASM engine. Live source tests are a separate manual check, not counted as passing fixture tests.

## Vercel deployment

1. Import this repository into Vercel. Select the Vite framework preset and Node.js 24.x.
2. Install: `npm ci`; build: `npm run build`; output: `dist`.
3. Keep `api/search.ts` enabled as a Vercel Function. No environment variables are needed.
4. `vercel.json` routes SPA deep links to `index.html` while preserving API routes, `editor.html`, assets and WASM paths.
5. Validate `/projects`, `/molecules`, `/editor.html` and `/rdkit/RDKit_minimal.wasm` after deployment. Search aspirin in PubChem and verify the returned CID/structure against its source record. Test ChEMBL pagination and rate-limit/error handling.

The proxy accepts only two named providers and fixed search paths, limits query length/page count, rejects redirects and uses request timeouts. It never forwards a client URL or authorization headers. Public deployment should add hosting-level rate limiting for abuse control. Do not use Vercel Functions for docking or heavy simulations. No deployment has been published or tested on Vercel by this task.

## Reproducibility and licenses

Dependencies are locked in `package-lock.json`. Descriptor records include the actual runtime RDKit version; Ketcher and Indigo versions are pinned through the dependency lock. Review upstream RDKit (BSD), Ketcher/Indigo (Apache 2.0), and scientific-source data licenses before redistribution. No global drug database or model training data is bundled.
