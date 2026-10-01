import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { followSystemTheme } from "@hanskristoffer/taurio/runtime";
import "./index.css";

import { App } from "./App.tsx";

// Before the first render, so a dark Mac never sees a light frame.
followSystemTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
