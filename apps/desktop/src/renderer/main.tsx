import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Tooltip } from "@base-ui/react/tooltip";
import { createRoot } from "react-dom/client";
import { Toast } from "@base-ui/react/toast";
import { StrictMode } from "react";

import { Toaster } from "./components/Toaster";
import { toaster } from "./lib/toast";
import { App } from "./App";

import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

document.documentElement.dataset.platform = navigator.userAgent.includes("Macintosh") ? "mac" : "other";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Toast.Provider toastManager={toaster} limit={3}>
        <Tooltip.Provider delay={350}>
          <App />
          <Toaster />
        </Tooltip.Provider>
      </Toast.Provider>
    </QueryClientProvider>
  </StrictMode>
);
