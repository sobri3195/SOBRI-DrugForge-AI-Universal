import { useState } from "react";
import { useStore, update, download, csv } from "../storage";
import { Panel, Feedback, useTask, Field } from "../components/shared";
import { descriptorLabels, tanimoto } from "../core/chemistry";
import { analyzeSequence } from "../core/sequence";
import { modality } from "../core/modality-registry";
import type { Analysis } from "../types";
export function Experiments() {
  const s = useStore();
  const task = useTask();
  return (
    <>
      <h1>Experiment workbench</h1>
      <p>
        Immutable input snapshots for completed RDKit calculations. Return to
        the designer to rerun a saved structure.
      </p>
      <Feedback {...task} />
      <Panel title={`${s.analyses.length} calculated analyses`}>
        {s.analyses.map((a) => (
          <article className="record" key={a.id}>
            <h3>{a.name}</h3>
            <p>
              {a.method} · {a.status} ·{" "}
              {a.stale ? "Superseded structure" : "Current structure"}
            </p>
            <small>
              {a.startedAt} → {a.endedAt} · {a.software}
            </small>
            <details>
              <summary>Reproducibility metadata</summary>
              <pre>{JSON.stringify(a, null, 2)}</pre>
            </details>
            <div className="actions">
              <button
                onClick={() =>
                  download(`${a.id}.json`, JSON.stringify(a, null, 2))
                }
              >
                Export
              </button>
              <a
                className="button"
                href={`/molecules?candidate=${a.candidateId}`}
              >
                Rerun in designer
              </a>
              <button
                onClick={() =>
                  void task.run(() =>
                    update((state) => ({
                      ...state,
                      analyses: state.analyses.filter((x) => x.id !== a.id),
                    })),
                  )
                }
              >
                Delete
              </button>
            </div>
          </article>
        ))}
        {!s.analyses.length && (
          <p className="empty">
            No calculations yet. Analyze a candidate in the Molecular Designer.
          </p>
        )}
      </Panel>
    </>
  );
}
export function Comparison() {
  const { analyses } = useStore();
  const [ids, setIds] = useState<string[]>([]);
  const selected = analyses.filter((a) => ids.includes(a.id));
  const [property, setProperty] = useState("amw");
  return (
    <>
      <h1>Results comparison</h1>
      <p>
        Compare actual calculations. No activity scores or predictions are
        generated.
      </p>
      <Panel title="Select calculation versions">
        {analyses.map((a, i) => (
          <label className="check-row" key={a.id}>
            <input
              type="checkbox"
              checked={ids.includes(a.id)}
              onChange={(e) =>
                setIds(
                  e.target.checked
                    ? [...ids, a.id]
                    : ids.filter((id) => id !== a.id),
                )
              }
            />
            {a.name} · #{i + 1} · {a.endedAt}
          </label>
        ))}
        {!analyses.length && <p>Run RDKit calculations first.</p>}
      </Panel>
      {selected.length > 0 && (
        <Panel title="Descriptor comparison">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Property</th>
                  {selected.map((a) => (
                    <th key={a.id}>
                      {a.name}
                      <small>{a.endedAt}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(descriptorLabels).map(([key, label]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    {selected.map((a) => (
                      <td key={a.id}>
                        {a.descriptors[key]?.toFixed(3) ?? "Unavailable"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="field">
            Graph property
            <select
              value={property}
              onChange={(e) => setProperty(e.target.value)}
            >
              {Object.entries(descriptorLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <svg
            role="img"
            aria-label={`${descriptorLabels[property]} comparison`}
            viewBox={`0 0 650 ${selected.length * 50 + 20}`}
            className="comparison-chart"
          >
            {selected.map((a, i) => {
              const value = a.descriptors[property];
              const max = Math.max(
                1,
                ...selected.map((x) => Math.abs(x.descriptors[property] ?? 0)),
              );
              return (
                <g key={a.id} transform={`translate(0,${i * 50})`}>
                  <text x="0" y="25" fill="currentColor">
                    {a.name.slice(0, 18)}
                  </text>
                  <rect
                    x="180"
                    y="10"
                    height="24"
                    width={(Math.abs(value ?? 0) / max) * 350}
                    fill="#38cdb1"
                  />
                  <text x="540" y="26" fill="currentColor">
                    {value?.toFixed(2) ?? "N/A"}
                  </text>
                </g>
              );
            })}
          </svg>
          {selected.length === 2 && (
            <p>
              Fingerprint Tanimoto:{" "}
              {tanimoto(
                selected[0].fingerprint,
                selected[1].fingerprint,
              ).toFixed(4)}
            </p>
          )}
          <button
            onClick={() =>
              download(
                "comparison.csv",
                csv(
                  selected.map((a) => ({
                    candidate: a.name,
                    structure: a.canonical,
                    ...a.descriptors,
                  })),
                ),
                "text/csv",
              )
            }
          >
            Export comparison CSV
          </button>
        </Panel>
      )}
    </>
  );
}
export function Biologics() {
  const s = useStore();
  const [id, setId] = useState("");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ReturnType<typeof analyzeSequence>>();
  const task = useTask();
  const candidate = s.candidates.find((c) => c.id === id);
  return (
    <>
      <h1>Biologics & sequence lab</h1>
      <p>
        Basic sequence validation and composition. No biological activity
        prediction.
      </p>
      <Feedback {...task} />
      <Panel title="Sequence research">
        <label className="field">
          Candidate
          <select
            aria-label="Candidate"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setInput(
                s.candidates.find((c) => c.id === e.target.value)?.sequence ??
                  "",
              );
              setResult(undefined);
            }}
          >
            <option value="">Select sequence candidate</option>
            {s.candidates
              .filter((c) =>
                modality(c.modality).supportedInputs.includes("sequence"),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="file-button">
          Import FASTA
          <input
            type="file"
            accept=".fasta,.fa,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void task.run(async () => {
                  const text = await file.text();
                  if ((text.match(/^>/gm) ?? []).length > 1)
                    throw Error("Import one sequence at a time.");
                  setInput(text);
                  setResult(undefined);
                });
            }}
          />
        </label>
        <Field
          label="Sequence / FASTA"
          multiline
          value={input}
          onChange={(v) => {
            setInput(v);
            setResult(undefined);
          }}
        />
        <button
          disabled={!candidate}
          onClick={() =>
            void task.run(() => {
              if (!candidate) throw Error("Choose a candidate.");
              const r = analyzeSequence(
                input,
                ["oligonucleotide", "sirna", "mrna"].includes(
                  candidate.modality,
                ),
              );
              setResult(r);
              update((state) => ({
                ...state,
                candidates: state.candidates.map((c) =>
                  c.id === id ? { ...c, sequence: r.sequence } : c,
                ),
              }));
            })
          }
        >
          Validate & save sequence
        </button>
        {result && (
          <>
            <p>Length: {result.length}</p>
            <pre>{JSON.stringify(result.composition, null, 2)}</pre>
            <p>{result.note}</p>
          </>
        )}
      </Panel>
    </>
  );
}
export function Reports() {
  const s = useStore();
  const [id, setId] = useState("");
  const project = s.projects.find((p) => p.id === id);
  const rows = s.analyses.filter((a) => a.projectId === id);
  return (
    <>
      <h1>Research reports</h1>
      <label className="field">
        Project
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Choose a project</option>
          {s.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {project && (
        <Panel title={project.name}>
          <div className="report">
            <h2>Research question</h2>
            <p>{project.question || "Not recorded"}</p>
            <h2>Background & hypothesis · user input</h2>
            <p>{project.hypothesis || "Not recorded"}</p>
            <p>
              Indication: {project.disease} · Target: {project.target} ·
              Modality: {modality(project.modality).displayName}
            </p>
            <h2>Methods & dataset</h2>
            <p>
              {project.methods || "Not recorded"} ·{" "}
              {project.dataset || "No dataset recorded"}
            </p>
            <h2>Results</h2>
            <p>
              {rows.length} recorded calculations. Physicochemical calculations
              do not demonstrate efficacy.
            </p>
            {rows.map((a) => (
              <article key={a.id}>
                <h3>{a.name}</h3>
                <p>
                  {a.canonical} · {a.software} · {a.endedAt}
                </p>
                <table>
                  <tbody>
                    {Object.entries(a.descriptors).map(([k, v]) => (
                      <tr key={k}>
                        <td>{descriptorLabels[k] ?? k}</td>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
            <h2>Validation plan</h2>
            <p>{project.validation || "Not recorded"}</p>
            <h2>Limitations & conclusions</h2>
            <p>
              No trained activity model, docking engine, clinical validation, or
              patient-safety inference is provided. Findings are limited to
              recorded inputs and RDKit calculations. External evidence must be
              assessed separately.
            </p>
            <h2>Evidence sources</h2>
            {s.candidates
              .filter((c) => rows.some((a) => a.candidateId === c.id))
              .map((c) => (
                <p key={c.id}>
                  {c.name}: {c.source} {c.sourceUrl} · {c.retrievedAt}
                </p>
              ))}
          </div>
          <div className="actions no-print">
            <button onClick={() => window.print()}>Print / save PDF</button>
            <button
              onClick={() =>
                download(
                  "report.json",
                  JSON.stringify(
                    {
                      project,
                      analyses: rows,
                      generatedAt: new Date().toISOString(),
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              Export JSON
            </button>
            <button
              onClick={() =>
                download(
                  "results.csv",
                  csv(
                    rows.map((a: Analysis) => ({
                      name: a.name,
                      input: a.input,
                      software: a.software,
                      ...a.descriptors,
                    })),
                  ),
                  "text/csv",
                )
              }
            >
              Export results CSV
            </button>
          </div>
        </Panel>
      )}
    </>
  );
}
