import { createRoot } from "react-dom/client";
import { StrictMode } from "react";

import { Updater } from "./Updater";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Updater />
  </StrictMode>
);
