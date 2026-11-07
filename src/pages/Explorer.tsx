import { useState } from "react";
import { Link } from "react-router-dom";
import { Panel, Field, Feedback, useTask } from "../components/shared";
import { modalities, modality, canAnalyze } from "../core/modality-registry";
import {
  createAdapter,
  sources,
  referenceSources,
  type Source,
  type SearchResult,
} from "../integrations";
import { useStore, update, download, csv } from "../storage";
import { candidateSchema, type Candidate } from "../types";
export default function Explorer() {
  const state = useStore();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source>("pubchem");
  const [result, setResult] = useState<SearchResult>();
  const [page, setPage] = useState(0);
  const [byId, setById] = useState(false);
  const task = useTask();
  const [custom, setCustom] = useState({
    name: "",
    modality: "small-molecule",
    smiles: "",
    sequence: "",
    notes: "",
  });
  async function search(offset = 0) {
    setResult(undefined);
    const adapter = createAdapter(source);
    const response = await (byId
      ? adapter.fetchById(query)
      : adapter.search(query, offset));
    setResult(response);
    setPage(offset);
  }
  function save(c: Candidate) {
    update((s) => ({
      ...s,
      candidates: [...s.candidates.filter((x) => x.id !== c.id), c],
    }));
  }
  const render = (c: Candidate, saved = false) => (
    <article className="record" key={c.id}>
      <div className="record-heading">
        <h3>{c.name}</h3>
        <span className="badge">{modality(c.modality).displayName}</span>
      </div>
      <p className="mono">
        {c.smiles || c.sequence || "No structure supplied"}
      </p>
      <p>
        {c.source} · Retrieved {new Date(c.retrievedAt).toLocaleDateString()}{" "}
        {c.sourceUrl && (
          <a href={c.sourceUrl} target="_blank" rel="noreferrer">
            Source record ↗
          </a>
        )}
      </p>
      <div className="actions">
        {saved ? (
          <>
            <Link className="button" to={`/molecules?candidate=${c.id}`}>
              Open research record
            </Link>
            <button
              onClick={() =>
                void task.run(() =>
                  update((s) => ({
                    ...s,
                    candidates: s.candidates.filter((x) => x.id !== c.id),
                  })),
                )
              }
            >
              Remove
            </button>
          </>
        ) : (
          <button onClick={() => void task.run(() => save(c))}>
            {state.candidates.some(
              (x) => x.sourceUrl && x.sourceUrl === c.sourceUrl,
            )
              ? "Save another copy"
              : "Save candidate"}
          </button>
        )}
        <span className="muted">
          {canAnalyze(c)
            ? "RDKit compatible"
            : "Molecular analysis not applicable / structure missing"}
        </span>
      </div>
    </article>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Source-backed discovery</p>
          <h1>All Drugs Explorer</h1>
          <p>Search public records or import a research-defined candidate.</p>
        </div>
      </div>
      <Feedback {...task} />
      <Panel title="Search scientific sources">
        <form
          className="search-row"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(() => search());
          }}
        >
          <label className="field grow">
            Name or source identifier
            <input
              aria-label="Drug search"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. aspirin or CHEMBL25"
            />
          </label>
          <label className="field">
            Source
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value as Source);
                setResult(undefined);
              }}
            >
              {Object.entries(sources).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={byId}
              onChange={(e) => setById(e.target.checked)}
            />{" "}
            Identifier lookup
          </label>
          <button className="primary" disabled={task.busy}>
            Search
          </button>
        </form>
        <button
          disabled={!query.trim()}
          onClick={() =>
            void task.run(() =>
              update((s) => ({
                ...s,
                savedSearches: [...new Set([...s.savedSearches, query])],
              })),
            )
          }
        >
          Save search
        </button>
        {state.savedSearches.map((q) => (
          <button key={q} onClick={() => setQuery(q)}>
            {q}
          </button>
        ))}
        {result && (
          <>
            <p className="badge">
              {result.provenance.cached
                ? "Offline fallback · cached record"
                : "Connected · validated response"}{" "}
              · {result.provenance.retrievedAt}
            </p>
            {result.records.map((c) => render(c))}
            {result.hasMore && (
              <button onClick={() => void task.run(() => search(page + 1))}>
                Next page
              </button>
            )}
            {page > 0 && (
              <button onClick={() => void task.run(() => search(page - 1))}>
                Previous page
              </button>
            )}
            {!result.records.length && <p>No matching records.</p>}
          </>
        )}
        <details>
          <summary>
            Other scientific references · lookup integration pending
          </summary>
          <p>
            These links open the source website. They are not integrated API
            searches.
          </p>
          {referenceSources.map((s) => (
            <a
              className="button"
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noreferrer"
            >
              {s.name} ↗
            </a>
          ))}
        </details>
      </Panel>
      <div className="two-columns">
        <Panel title="Add a custom candidate">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(() => {
                save(
                  candidateSchema.parse({
                    ...custom,
                    id: crypto.randomUUID(),
                    source: "User input",
                    retrievedAt: new Date().toISOString(),
                  }),
                );
                setCustom({
                  ...custom,
                  name: "",
                  smiles: "",
                  sequence: "",
                  notes: "",
                });
              });
            }}
          >
            <Field
              label="Candidate name"
              required
              value={custom.name}
              onChange={(name) => setCustom({ ...custom, name })}
            />
            <label className="field">
              Modality
              <select
                aria-label="Modality"
                value={custom.modality}
                onChange={(e) =>
                  setCustom({ ...custom, modality: e.target.value })
                }
              >
                {modalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </label>
            {modality(custom.modality).supportedInputs.includes("SMILES") && (
              <Field
                label="SMILES"
                value={custom.smiles}
                onChange={(smiles) => setCustom({ ...custom, smiles })}
              />
            )}
            {modality(custom.modality).supportedInputs.includes("sequence") && (
              <Field
                label="Sequence"
                multiline
                value={custom.sequence}
                onChange={(sequence) => setCustom({ ...custom, sequence })}
              />
            )}
            <Field
              label="Modality metadata / research notes"
              multiline
              value={custom.notes}
              onChange={(notes) => setCustom({ ...custom, notes })}
            />
            <button className="primary">Save research record</button>
          </form>
        </Panel>
        <Panel title={`Saved candidates (${state.candidates.length})`}>
          {state.candidates.map((c) => render(c, true))}
          {!state.candidates.length && (
            <p className="empty">
              Saved source records and custom candidates appear here.
            </p>
          )}
          <div className="actions">
            <button
              onClick={() =>
                download(
                  "candidates.json",
                  JSON.stringify(state.candidates, null, 2),
                )
              }
            >
              Export JSON
            </button>
            <button
              onClick={() =>
                download(
                  "candidates.csv",
                  csv(
                    state.candidates.map(({ identifiers, ...c }) => ({
                      ...c,
                      ...identifiers,
                    })),
                  ),
                  "text/csv",
                )
              }
            >
              Export CSV
            </button>
            <label className="file-button">
              Import candidate JSON
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void task.run(async () => {
                      const raw = JSON.parse(await file.text());
                      if (!Array.isArray(raw))
                        throw Error("Expected an array of candidates.");
                      const candidates = raw.map((x) =>
                        candidateSchema.parse({
                          ...x,
                          id: crypto.randomUUID(),
                        }),
                      );
                      update((s) => ({
                        ...s,
                        candidates: [...s.candidates, ...candidates],
                      }));
                    });
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </Panel>
      </div>
    </>
  );
}
