# fem-frontend-architecture

## Cloudflare Pages

This repo deploys the nested diagrams app under `/diagrams`.

Use these Cloudflare Pages settings:

- Build command: `npm run build`
- Build output directory: `diagrams/dist`
- Node.js: v20 or newer

The root build sets `DIAGRAMS_BASE_PATH=/diagrams`, so the generated static output is:

- `/diagrams/`
- `/diagrams/v1/`
- `/diagrams/v2/`

Run the same build locally with:

```sh
npm run build
```
