import { useState } from "react";
import { Field, Panel, Feedback, useTask } from "../components/shared";
import { modalities, modality } from "../core/modality-registry";
import { useStore, update, download, csv } from "../storage";
import { projectSchema, type Project } from "../types";
const fields = {
  name: "Project name",
  question: "Research question",
  disease: "Disease / indication",
  area: "Therapeutic area",
  target: "Biological target",
  hypothesis: "Research hypothesis",
  studyDesign: "Study design",
  dataset: "Dataset reference",
  methods: "Analysis methods",
  validation: "Validation plan",
  notes: "Research notes",
};
export function newProject(): Project {
  const at = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "",
    modality: "small-molecule",
    customModality: "",
    question: "",
    disease: "",
    area: "",
    target: "",
    hypothesis: "",
    studyDesign: "",
    dataset: "",
    methods: "",
    validation: "",
    notes: "",
    createdAt: at,
    updatedAt: at,
    archived: false,
    versions: [],
  };
}
export default function Projects() {
  const { projects } = useStore();
  const [draft, setDraft] = useState<Project>(newProject);
  const task = useTask();
  const [editing, setEditing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  function save(next: Project) {
    if (!next.name.trim()) throw Error("Project name is required.");
    const at = new Date().toISOString();
    const snapshot = Object.fromEntries(
      Object.entries(next).filter(
        ([k, v]) => k !== "versions" && typeof v === "string",
      ),
    ) as Record<string, string>;
    update((s) => ({
      ...s,
      projects: [
        ...s.projects.filter((p) => p.id !== next.id),
        {
          ...next,
          updatedAt: at,
          versions: [...next.versions, { at, snapshot }],
        },
      ],
    }));
  }
  function change(key: string, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (editing && next.name.trim()) void task.run(() => save(next));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Local research workspace</p>
          <h1>Discovery projects</h1>
          <p>
            Any indication. Any target. A method appropriate to the modality.
          </p>
        </div>
        <button
          onClick={() => {
            setDraft(newProject());
            setEditing(false);
          }}
        >
          New project
        </button>
      </div>
      <Feedback {...task} />
      <div className="two-columns">
        <Panel
          title={
            editing ? "Edit project · autosave enabled" : "Create a project"
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(() => {
                save(draft);
                setEditing(true);
              });
            }}
          >
            <div className="form-grid">
              {Object.entries(fields).map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  value={String(draft[key as keyof Project])}
                  required={key === "name"}
                  multiline={[
                    "question",
                    "hypothesis",
                    "notes",
                    "validation",
                  ].includes(key)}
                  onChange={(v) => change(key, v)}
                />
              ))}
              <label className="field">
                Drug modality
                <select
                  value={draft.modality}
                  onChange={(e) => change("modality", e.target.value)}
                >
                  {modalities.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </label>
              {draft.modality === "custom" && (
                <Field
                  label="Custom modality"
                  value={draft.customModality}
                  onChange={(v) => change("customModality", v)}
                />
              )}
            </div>
            <button type="submit" className="primary">
              {editing ? "Save version" : "Create project"}
            </button>
          </form>
          <div className="capabilities">
            {Object.entries(
              modality(draft.modality).getAvailableCapabilities(),
            ).map(([name, status]) => (
              <span className="badge" key={name}>
                {name}: {status}
              </span>
            ))}
          </div>
        </Panel>
        <Panel title={`Saved projects (${projects.length})`}>
          <label>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />{" "}
            Include archived
          </label>
          {projects
            .filter((p) => showArchived || !p.archived)
            .map((p) => (
              <article className="record" key={p.id}>
                <h3>{p.name}</h3>
                <p>
                  {p.disease || "Indication not specified"} ·{" "}
                  {modality(p.modality).displayName}
                </p>
                <small>
                  {p.id} · {p.versions.length} versions
                </small>
                <div className="actions">
                  <button
                    onClick={() => {
                      setDraft(p);
                      setEditing(true);
                    }}
                  >
                    Open / rename
                  </button>
                  <button
                    onClick={() =>
                      void task.run(() =>
                        save({
                          ...p,
                          id: crypto.randomUUID(),
                          name: `${p.name} (copy)`,
                          versions: [],
                        }),
                      )
                    }
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() =>
                      void task.run(() => save({ ...p, archived: !p.archived }))
                    }
                  >
                    {p.archived ? "Unarchive" : "Archive"}
                  </button>
                  <button
                    onClick={() =>
                      download(`${p.id}.json`, JSON.stringify(p, null, 2))
                    }
                  >
                    JSON
                  </button>
                </div>
                <details>
                  <summary>Version history</summary>
                  {p.versions.map((v, i) => (
                    <div key={i}>
                      <p>{v.at}</p>
                      <pre>{JSON.stringify(v.snapshot, null, 2)}</pre>
                      {i > 0 && (
                        <p>
                          Changed fields:{" "}
                          {Object.keys(v.snapshot)
                            .filter(
                              (k) =>
                                v.snapshot[k] !== p.versions[i - 1].snapshot[k],
                            )
                            .join(", ") || "None"}
                        </p>
                      )}
                      <button
                        onClick={() =>
                          void task.run(() => {
                            const restored = { ...p, ...v.snapshot };
                            save(projectSchema.parse(restored));
                            setDraft(restored);
                          })
                        }
                      >
                        Restore this version
                      </button>
                    </div>
                  ))}
                </details>
              </article>
            ))}
          {!projects.length && (
            <p className="empty">
              Create your first project to record a research question and
              validation plan.
            </p>
          )}
          <div className="actions">
            <button
              onClick={() =>
                download(
                  "projects.csv",
                  csv(projects.map(({ versions, ...p }) => p)),
                  "text/csv",
                )
              }
            >
              Export CSV
            </button>
            <label className="file-button">
              Import project JSON
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void task.run(async () =>
                      save({
                        ...projectSchema.parse(JSON.parse(await file.text())),
                        id: crypto.randomUUID(),
                      }),
                    );
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
