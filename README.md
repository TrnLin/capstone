# React Router + shadcn/ui

This is a template for a new React Router project with React, TypeScript, and shadcn/ui.

## Production build (stages into backend)

```bash
npm run build
```

This builds the SPA and replaces `../be/static/` with the new client build so the backend can serve the UI.

- `npm run build:only` — build without copying to the backend
- `npm run stage` — copy an existing `build/client` into `../be/static`
- `BE_DIR=C:\path\to\backend npm run build` — stage into a non-sibling backend checkout

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
