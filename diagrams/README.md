# C4 Diagrams

This folder stores versioned C4 diagrams as Structurizr DSL workspaces and exports each version as a static site for Cloudflare Pages.

## Layout

- `v1/workspace.dsl` exports to `dist/v1/`
- `v2/workspace.dsl` exports to `dist/v2/`
- Additional versions follow the same pattern: create `v3/workspace.dsl`, then run the build.

## Local build

The build downloads the official Structurizr CLI and, if needed, a Java runtime into `.cache/`. Diagram layout uses the checked-in `bin/dot` Graphviz-compatible shim, so you do not need a native Graphviz install.

```sh
npm run build
```

If you do not have Java locally but do have Docker:

```sh
npm run build:docker
```

The generated site is written to `dist/`. You can preview it with:

```sh
python3 -m http.server 8000 --directory dist
```

Then open:

- `http://localhost:8000/v1/`
- `http://localhost:8000/v2/`

From the repository root, `npm run build` generates the Cloudflare Pages output with the diagrams mounted under `/diagrams`:

- `diagrams/dist/diagrams/`
- `http://localhost:8000/diagrams/v1/`
- `http://localhost:8000/diagrams/v2/`

## Cloudflare Pages

If deploying this folder as the Pages project root, use these settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Node.js: v20 or newer

The build script exports every `v*/workspace.dsl` file to a matching static route, so `/v1/`, `/v2/`, etc. are available after deployment.

If deploying from the parent repository root, use the parent `wrangler.toml` and these settings instead:

- Build command: `npm run build`
- Build output directory: `diagrams/dist`

That root build sets `DIAGRAMS_BASE_PATH=/diagrams`, so `/diagrams/v1/`, `/diagrams/v2/`, etc. are available after deployment.

The script downloads the Structurizr CLI release defined by `STRUCTURIZR_CLI_VERSION` if it is not already cached. By default it uses `2025.11.09`.
