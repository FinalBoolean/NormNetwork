import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import App from "./App.js";
import type { PageProps } from "./App.js";

const props: PageProps = JSON.parse(
  document.getElementById("page-data")!.textContent!,
);
hydrateRoot(
  document.getElementById("root")!,
  <StrictMode>
    <App {...props} />
  </StrictMode>,
);
