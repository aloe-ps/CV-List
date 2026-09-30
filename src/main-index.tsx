import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IndexPage } from "./pages/index-page.js";

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");
createRoot(root).render(
  <StrictMode>
    <IndexPage />
  </StrictMode>,
);
