import { createRoot } from "react-dom/client";
import { AosShellApp } from "./app.js";

const root = document.getElementById("aos-root");

if (root) {
  createRoot(root).render(<AosShellApp />);
}
