import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@hanskristoffer/taurio/base.css";
import "@hanskristoffer/taurio/styles.css";

import { App } from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
