import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Panel, Field, Feedback, useTask } from "../components/shared";
import {
  analyze,
  descriptorLabels,
  ruleOfFive,
  tanimoto,
} from "../core/chemistry";
import { canAnalyze, modality } from "../core/modality-registry";
import { useStore, update, download } from "../storage";
import type { Analysis } from "../types";
export default function Molecules() {
  const s = useStore();
  const [params] = useSearchParams();
  const [candidateId, setCandidateId] = useState(
    params.get("candidate") ?? s.candidates[0]?.id ?? "",
  );
  const [projectId, setProjectId] = useState("");
  const candidate = s.candidates.find((c) => c.id === candidateId);
  const [input, setInput] = useState(
    s.analyses.filter((a) => a.candidateId === candidateId).at(-1)?.canonical ??
      candidate?.smiles ??
      "",
  );
  const [ready, setReady] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const task = useTask();
  const compatible =
    !!candidate &&
    modality(candidate.modality).getAvailableCapabilities().descriptors ===
      "Available";
  const currentInput = useRef(input);
  currentInput.current = input;
  const history = s.analyses.filter((a) => a.candidateId === candidateId);
  const latest = history.at(-1);
  const original = history[0];
  useEffect(() => {
    setInput(
      s.analyses.filter((a) => a.candidateId === candidateId).at(-1)
        ?.canonical ??
        candidate?.smiles ??
        "",
    );
  }, [candidateId, candidate?.smiles]);
  useEffect(() => {
    function message(e: MessageEvent) {
      if (
        e.origin !== location.origin ||
        e.source !== frame.current?.contentWindow
      )
        return;
      if (e.data?.type === "editor-ready") setReady(true);
      if (e.data?.type === "molecule" && typeof e.data.smiles === "string")
        setInput(e.data.smiles);
      if (e.data?.type === "editor-error")
        task.setError(String(e.data.message));
    }
    window.addEventListener("message", message);
    return () => window.removeEventListener("message", message);
  }, []);
  const send = (type: string, smiles?: string) =>
    frame.current?.contentWindow?.postMessage(
      { type, smiles },
      location.origin,
    );
  async function calculate() {
    if (!candidate || !canAnalyze({ ...candidate, smiles: input }))
      throw Error("This modality does not support molecular analysis.");
    const startedAt = new Date().toISOString();
    const result = await analyze(input);
    if (input !== currentInput.current)
      throw Error("Structure changed during analysis. Run again.");
    const entry: Analysis = {
      ...result,
      id: crypto.randomUUID(),
      projectId,
      candidateId,
      name: candidate.name,
      input,
      startedAt,
      endedAt: new Date().toISOString(),
      status: "Completed",
      method: "RDKit descriptors",
      warnings: [
        "Calculated properties are not biological activity or patient safety evidence.",
      ],
      stale: false,
    };
    update((state) => ({
      ...state,
      analyses: [
        ...state.analyses.map((a) =>
          a.candidateId === candidateId ? { ...a, stale: true } : a,
        ),
        entry,
      ],
    }));
    setInput(result.canonical);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Real browser chemistry · WebAssembly</p>
          <h1>Molecular designer</h1>
          <p>
            Draw with Ketcher. Validate and calculate with RDKit. Every saved
            calculation records its input and software version.
          </p>
        </div>
        <Link to="/drugs" className="button">
          Add a candidate
        </Link>
      </div>
      <Feedback {...task} />
      <Panel title="Research inputs">
        <div className="search-row">
          <label className="field grow">
            Candidate
            <select
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
            >
              <option value="">Select candidate</option>
              {s.candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {modality(c.modality).displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow">
            Project association
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {s.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!compatible && (
          <p className="notice">
            {candidate
              ? "Molecular analysis is not applicable to this modality, or a SMILES structure is missing."
              : "Save a small-molecule candidate in the explorer to begin."}
          </p>
        )}
        <Field
          label="SMILES / structure input"
          value={input}
          onChange={setInput}
        />
        <div className="actions">
          <button
            disabled={!compatible || task.busy || !input.trim()}
            className="primary"
            onClick={() => void task.run(calculate)}
          >
            Validate & calculate
          </button>
          <button
            disabled={!ready || !compatible}
            onClick={() => send("load-molecule", input)}
          >
            Load into editor
          </button>
          <button
            disabled={!ready || !compatible}
            onClick={() => send("export-molecule")}
          >
            Use edited structure
          </button>
          <button
            disabled={!latest}
            onClick={() =>
              latest &&
              download(
                "structure.smi",
                latest.canonical,
                "chemical/x-daylight-smiles",
              )
            }
          >
            Export canonical SMILES
          </button>
        </div>
        <p className="muted">
          {ready
            ? "Ketcher ready · drawing changes are applied with “Use edited structure”."
            : "Loading Ketcher editor…"}{" "}
          {latest &&
            input !== latest.canonical &&
            "Input changed · previous calculation is stale for the current structure."}
        </p>
      </Panel>
      {compatible && (
        <section className="editor-wrap">
          <iframe
            title="Ketcher molecular editor"
            ref={frame}
            src="/editor.html"
          />
        </section>
      )}
      {latest && (
        <div className="two-columns">
          <Panel title="Latest calculated structure">
            <div className="molecule-svg">
              <img
                alt="Calculated molecular structure"
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(latest.svg)}`}
              />
            </div>
            <p className="mono">{latest.canonical}</p>
            <p>
              {latest.software} · {latest.endedAt}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Value</th>
                  <th>Original</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(latest.descriptors).map(([key, value]) => (
                  <tr key={key}>
                    <td>{descriptorLabels[key] ?? key}</td>
                    <td>{value.toFixed(3)}</td>
                    <td>{original?.descriptors[key]?.toFixed(3) ?? "—"}</td>
                    <td>
                      {original?.descriptors[key] === undefined
                        ? "—"
                        : (value - original.descriptors[key]).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {original && (
              <p>
                Morgan fingerprint Tanimoto vs original:{" "}
                {tanimoto(original.fingerprint, latest.fingerprint).toFixed(4)}
              </p>
            )}
            <p className="muted">
              Only descriptors supported by the installed RDKit build appear.
            </p>
          </Panel>
          <Panel title="Rule of five · heuristic only">
            <p>
              This heuristic does not establish efficacy, bioavailability, or
              safety.
            </p>
            {ruleOfFive(latest.descriptors).map((rule) => (
              <p key={rule.label}>
                {rule.label}: {rule.value?.toFixed(2) ?? "Unavailable"} / ≤{" "}
                {rule.limit} <span className="badge">{rule.status}</span>
              </p>
            ))}
            <h3>Structure versions</h3>
            {history.map((a, i) => (
              <div className="record" key={a.id}>
                <strong>Version {i + 1}</strong>
                <p className="mono">{a.canonical}</p>
                <small>{a.endedAt}</small>
                <button onClick={() => setInput(a.canonical)}>
                  Restore to input
                </button>
              </div>
            ))}
          </Panel>
        </div>
      )}
    </>
  );
}
