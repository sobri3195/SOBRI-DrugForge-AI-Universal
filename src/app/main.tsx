import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  NavLink,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import {
  FlaskConical,
  LayoutDashboard,
  Search,
  FolderOpen,
  Dna,
  Atom,
  Beaker,
  Menu,
  X,
  Database,
  Settings as SettingsIcon,
} from "lucide-react";
import Projects from "../pages/Projects";
import Explorer from "../pages/Explorer";
import Molecules from "../pages/Molecules";
import {
  Experiments,
  Comparison,
  Biologics,
  Reports,
} from "../pages/Workbench";
import { Dashboard, DataManager, Settings, Pending } from "../pages/System";
import { ErrorBoundary } from "../components/shared";
import { useStore, storageWarning } from "../storage";
import "../app/style.css";
const primary = [
  ["/", "Dashboard", LayoutDashboard],
  ["/drugs", "All Drugs Explorer", Search],
  ["/projects", "Discovery Projects", FolderOpen],
  ["/molecules", "Molecular Designer", Atom],
  ["/biologics", "Biologics & Sequence Lab", Dna],
  ["/experiments", "Experiment Workbench", Beaker],
  ["/comparison", "Results Comparison", FlaskConical],
  ["/reports", "Research Reports", FolderOpen],
  ["/data", "Local Data Manager", Database],
  ["/settings", "Settings", SettingsIcon],
] as const;
const pending = [
  [
    "targets",
    "Disease & Target Explorer",
    "Integrated target lookup is pending. Disease and target fields accept unrestricted research annotations in projects.",
  ],
  [
    "ai-models",
    "AI Model Laboratory",
    "Requires Dataset. Training, held-out evaluation, scaffold splits and prediction are planned for Phase 3.",
  ],
  [
    "screening",
    "Virtual Screening",
    "Requires Dataset for compatible activity prediction. Batch standardization and screening are not implemented. Docking requires an external engine.",
  ],
  [
    "optimization",
    "Candidate Optimization",
    "Multi-objective ranking and Pareto optimization are pending. Structure editing and measured descriptor comparisons are available in the designer and comparison workspace.",
  ],
  [
    "admet",
    "ADMET Research",
    "Model unavailable. Only calculated physicochemical properties are available in the molecular designer.",
  ],
  [
    "repurposing",
    "Drug Repurposing",
    "Hypothesis ranking and clinical-trial API integration are pending. Record repurposing hypotheses in projects.",
  ],
  [
    "natural-products",
    "Natural Product Explorer",
    "Dedicated botanical records are pending. Search known compounds in PubChem; no plant constituents or activities are assumed.",
  ],
  [
    "formulations",
    "Formulation Research",
    "Formulation-specific records and version comparisons are pending. Research plans can be documented in projects.",
  ],
  [
    "evidence",
    "Scientific Evidence",
    "Structured claim-to-evidence linking is pending. Source record links and retrieval times are retained for imported candidates.",
  ],
] as const;
function App() {
  const state = useStore();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="mobile-header">
        <span>◈ DRUGFORGE</span>
        <button
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-icon">
            <FlaskConical size={26} />
          </div>
          <div>
            <strong>SOBRI DRUGFORGE</strong>
            <small>UNIVERSAL RESEARCH AI</small>
          </div>
        </div>
        <p className="nav-section">RESEARCH WORKSPACE</p>
        <nav aria-label="Main navigation">
          {primary.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
          <details>
            <summary>Planned research modules</summary>
            {pending.map(([path, label]) => (
              <NavLink key={path} to={`/${path}`}>
                {label}
                <span className="planned-dot">○</span>
              </NavLink>
            ))}
          </details>
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" /> Local-first workspace
          <small>Phase 1–2 MVP · v0.1.0</small>
          <small>Muhammad Sobri Maulana</small>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <span>
            RESEARCH PLATFORM <span className="slash">/</span>{" "}
            {primary.find(([p]) => p === location.pathname)?.[1] ??
              "Research module"}
          </span>
          <span className="badge">Browser-local · no login</span>
        </header>
        <main id="main">
          {storageWarning() && (
            <p className="error" role="alert">
              {storageWarning()}
            </p>
          )}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/drugs" element={<Explorer />} />
            <Route path="/molecules" element={<Molecules />} />
            <Route path="/biologics" element={<Biologics />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/comparison" element={<Comparison />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/data" element={<DataManager />} />
            <Route path="/settings" element={<Settings />} />
            {pending.map(([path, title, reason]) => (
              <Route
                key={path}
                path={`/${path}`}
                element={<Pending title={title} reason={reason} />}
              />
            ))}
            <Route
              path="*"
              element={
                <Pending
                  title="Page not found"
                  reason="Use the navigation to open a research workspace."
                />
              }
            />
          </Routes>
          <footer className="main-footer">
            SOBRI UNIVERSAL DRUGFORGE AI · Research use only. Computational
            findings require experimental validation.
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile shortcuts">
        {primary.slice(0, 4).map(([p, label, Icon]) => (
          <NavLink end key={p} to={p}>
            <Icon size={20} />
            <span>{label.split(" ")[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
