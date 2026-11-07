import { useState } from "react";
import { Link } from "react-router-dom";
import { Panel, Feedback, useTask } from "../components/shared";
import {
  useStore,
  update,
  download,
  parseBackup,
  STORAGE_KEY,
  emptyState,
  storageWarning,
} from "../storage";
import { modalities } from "../core/modality-registry";
export function Dashboard() {
  const s = useStore();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Universal research. Traceable results.</p>
          <h1>Research overview</h1>
          <p>A local-first workspace for computational drug discovery.</p>
        </div>
        <Link to="/projects" className="button primary">
          Create project
        </Link>
      </div>
      <div className="stats">
        {[
          ["Active projects", s.projects.filter((p) => !p.archived).length],
          ["Saved candidates", s.candidates.length],
          ["Drug modalities", modalities.length],
          ["Completed analyses", s.analyses.length],
        ].map(([name, value]) => (
          <div className="stat" key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="two-columns">
        <Panel title="Your research starts here">
          <ol className="workflow">
            <li>
              <Link to="/projects">Define your research question</Link>
              <p>Choose any disease, biological target, and drug modality.</p>
            </li>
            <li>
              <Link to="/drugs">Find or import a candidate</Link>
              <p>Keep source records separate from user input.</p>
            </li>
            <li>
              <Link to="/molecules">Design & calculate</Link>
              <p>Edit small molecules and run RDKit locally.</p>
            </li>
            <li>
              <Link to="/reports">Document your findings</Link>
              <p>Export the actual results and reproducibility metadata.</p>
            </li>
          </ol>
        </Panel>
        <Panel title="Recent experiments">
          {s.analyses
            .slice(-5)
            .reverse()
            .map((a) => (
              <div className="record" key={a.id}>
                <h3>{a.name}</h3>
                <p>
                  {a.method} · {a.status}
                </p>
                <small>{a.endedAt}</small>
              </div>
            ))}
          {!s.analyses.length && (
            <p className="empty">
              No experiments have been run. Your actual results will appear
              here.
            </p>
          )}
        </Panel>
      </div>
      <Panel title="Research integrity & connectivity">
        <p>
          PubChem and ChEMBL are checked on request. No live connection has been
          verified in this environment. Cached responses display their retrieval
          time.
        </p>
        <p>
          Docking requires an external engine. Activity and ADMET prediction
          require validated datasets and models. No synthetic research results
          are supplied.
        </p>
        <Link to="/data">Manage local storage and backups →</Link>
      </Panel>
    </>
  );
}
export function DataManager() {
  const state = useStore();
  const task = useTask();
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const bytes = new TextEncoder().encode(JSON.stringify(state)).length;
  const [estimate, setEstimate] = useState("");
  return (
    <>
      <h1>Local data manager</h1>
      <p>
        Browser-local storage. Export a backup before clearing browser data. Do
        not store API secrets or sensitive patient records.
      </p>
      <Feedback {...task} />
      {storageWarning() && (
        <p role="alert" className="error">
          {storageWarning()}
        </p>
      )}
      <Panel title="Backup & recovery">
        <p>
          Schema version: {state.schemaVersion} · Application records:{" "}
          {(bytes / 1024).toFixed(1)} KiB
        </p>
        {bytes > 4_000_000 && (
          <p className="error">
            Storage is nearly full. Export a backup and remove unused records.
          </p>
        )}
        <div className="actions">
          <button
            onClick={() =>
              download("drugforge-backup.json", JSON.stringify(state, null, 2))
            }
          >
            Backup JSON
          </button>
          <button
            onClick={() =>
              download(
                "drugforge-raw-backup.txt",
                localStorage.getItem(STORAGE_KEY) ?? "",
                "text/plain",
              )
            }
          >
            Export raw saved data
          </button>
          <label className="file-button">
            Restore backup JSON
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void task.run(async () => {
                    const restored = parseBackup(await file.text());
                    update(() => restored, true);
                    setMessage("Backup restored.");
                  });
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() =>
              void task.run(() => {
                Object.keys(localStorage)
                  .filter((k) => k.startsWith("drugforge-cache:"))
                  .forEach((k) => localStorage.removeItem(k));
                setMessage("Search cache cleared.");
              })
            }
          >
            Clear source cache
          </button>
          <button
            onClick={() =>
              void task.run(async () => {
                if (!navigator.storage?.estimate)
                  throw Error(
                    "Storage estimate is not available in this browser.",
                  );
                const { usage, quota } = await navigator.storage.estimate();
                setEstimate(
                  `Browser origin usage: ${usage ?? "unknown"} bytes / quota: ${quota ?? "unknown"} bytes`,
                );
              })
            }
          >
            Check browser quota
          </button>
        </div>
        <p aria-live="polite">
          {message} {estimate}
        </p>
        <label>
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />{" "}
          I have backed up my data and want to delete local research records.
        </label>
        <button
          disabled={!confirm}
          onClick={() =>
            void task.run(() => {
              update(() => emptyState(), true);
              setConfirm(false);
              setMessage("Local research records reset.");
            })
          }
        >
          Reset research data
        </button>
      </Panel>
    </>
  );
}
export function Settings() {
  const { theme } = useStore();
  const task = useTask();
  return (
    <>
      <h1>Settings</h1>
      <Feedback {...task} />
      <Panel title="Appearance & privacy">
        <label className="field">
          Color mode
          <select
            value={theme}
            onChange={(e) =>
              void task.run(() =>
                update((s) => ({
                  ...s,
                  theme: e.target.value as "dark" | "light",
                })),
              )
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <p>
          No login, database, API key, or telemetry is required. Searches send
          your query to the selected scientific source through a
          fixed-destination API route.
        </p>
        <p>Founder / Researcher: Muhammad Sobri Maulana</p>
      </Panel>
    </>
  );
}
export function Pending({ title, reason }: { title: string; reason: string }) {
  return (
    <>
      <p className="eyebrow">Capability status</p>
      <h1>{title}</h1>
      <Panel title="Not implemented in the Phase 1–2 MVP">
        <p>{reason}</p>
        <p>
          No experimental results or predictions are generated for this module.
        </p>
        <div className="actions">
          <Link className="button" to="/drugs">
            Search or import a candidate
          </Link>
          <Link className="button" to="/projects">
            Record research plan
          </Link>
        </div>
      </Panel>
    </>
  );
}
