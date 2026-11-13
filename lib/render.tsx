import { renderToString, renderToStaticMarkup } from "react-dom/server";

import type { RequestHandler } from "express";

import App from "../src/App.js";

import type { PageProps } from "../src/App.js";

// Keep the existing route/status/redirect contract while replacing EJS with React.

export function reactPages(clientScript?: string): RequestHandler {
  return (_req, res, next) => {
    res.render = (view: string, options?: object) => {
      const data = (options ?? {}) as Partial<PageProps>;

      // Explicit allowlist: never serialize Express locals, DB handles, or passwords.

      const props: PageProps = {
        page: view.replace("pages/", ""),
        title: data.title ?? "Norm's Network",

        currentPath: res.locals.currentPath,
        currentUser: res.locals.currentUser,

        profile: data.profile,
        editingProfile: data.editingProfile,
        companionTypes: data.companionTypes,
        studyProfile: data.studyProfile,
        gamingProfile: data.gamingProfile,
        datingPreferences: data.datingPreferences,
        values: data.values,
        errors: data.errors,
        next: data.next,
        notice: data.notice,

        description: data.description,
        status: data.status,
        message: data.message,
      };

      const json = JSON.stringify(props).replace(/</g, "\\u003c");

      const markup = renderToString(<App {...props} />);

      const head = renderToStaticMarkup(
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{`${props.title} - Norm's Network`}</title>
          <link rel="stylesheet" href="/css/styles.css" />
        </head>,
      );

      const devScripts =
        clientScript === "/src/main.tsx"
          ? `<script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script><script type="module" src="/@vite/client"></script>`
          : "";
      res
        .type("html")
        .send(
          `<!doctype html><html lang="en">${head}<body>${devScripts}<div id="root">${markup}</div><script id="page-data" type="application/json">${json}</script>${clientScript ? `<script type="module" src="${clientScript}"></script>` : ""}</body></html>`,
        );
    };

    next();
  };
}
