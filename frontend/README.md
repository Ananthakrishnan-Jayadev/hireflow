# HireFlow Frontend (React)

React + TypeScript frontend for the HireFlow app, public career page, and live copilot.

## Development

```bash
cd frontend
npm install
npm run dev
```

By default Vite runs on `http://localhost:5173`.

## Production Build

```bash
cd frontend
npm install
npm run build
```

This generates `frontend/dist`.
Backend serves the main app from `/`, `/login`, and all browser-history routes. The public career page is served at `/career`, and the live copilot page is available at `/copilot`.
