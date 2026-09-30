import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WorkDetailPage } from "./pages/work-detail-page.js";

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");
createRoot(root).render(
  <StrictMode>
    <WorkDetailPage />
  </StrictMode>,
);
