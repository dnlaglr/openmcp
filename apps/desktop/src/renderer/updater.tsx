import { createRoot } from "react-dom/client";
import { StrictMode } from "react";

import { UpdaterApp } from "./UpdaterApp";

import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UpdaterApp />
  </StrictMode>
);
