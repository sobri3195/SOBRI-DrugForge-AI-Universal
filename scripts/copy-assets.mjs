import { mkdir, copyFile, cp, access } from "node:fs/promises";
await mkdir("public/rdkit", { recursive: true });
for (const file of ["RDKit_minimal.js", "RDKit_minimal.wasm"])
  await copyFile(
    `node_modules/@rdkit/rdkit/dist/${file}`,
    `public/rdkit/${file}`,
  );
// Ketcher uses fonts/templates bundled in its distribution, when present.
try {
  await access("node_modules/ketcher-react/dist/static");
  await cp("node_modules/ketcher-react/dist/static", "public/ketcher/static", {
    recursive: true,
  });
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
