import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GeneratorPage } from "./pages/generator-page.js";

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");
createRoot(root).render(
  <StrictMode>
    <GeneratorPage />
  </StrictMode>,
);
