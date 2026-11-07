import React from "react";
import { createRoot } from "react-dom/client";
import { Editor } from "ketcher-react";
import { StandaloneStructServiceProvider } from "ketcher-standalone";
import "ketcher-react/dist/index.css";
import type { Ketcher } from "ketcher-core";
let editor: Ketcher | undefined;
window.addEventListener("message", (event) => {
  if (event.origin !== location.origin || event.source !== window.parent)
    return;
  const message = event.data;
  if (message?.type === "load-molecule" && typeof message.smiles === "string")
    editor
      ?.setMolecule(message.smiles)
      .catch((e) =>
        window.parent.postMessage(
          { type: "editor-error", message: String(e) },
          location.origin,
        ),
      );
  if (message?.type === "export-molecule")
    editor
      ?.getSmiles()
      .then((smiles) =>
        window.parent.postMessage(
          { type: "molecule", smiles },
          location.origin,
        ),
      )
      .catch((e) =>
        window.parent.postMessage(
          { type: "editor-error", message: String(e) },
          location.origin,
        ),
      );
});
const service = new StandaloneStructServiceProvider();
createRoot(document.getElementById("root")!).render(
  <>
    <div style={{ height: "100vh" }}>
      <Editor
        staticResourcesUrl="/ketcher"
        structServiceProvider={service}
        disableMacromoleculesEditor
        errorHandler={(message) =>
          window.parent.postMessage(
            { type: "editor-error", message },
            location.origin,
          )
        }
        onInit={(instance) => {
          editor = instance;
          window.parent.postMessage({ type: "editor-ready" }, location.origin);
        }}
      />
    </div>
  </>,
);
