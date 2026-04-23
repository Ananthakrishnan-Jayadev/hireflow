# Hireflow Live Copilot (React)

Phase 2 frontend for realtime copilot.

## Development

```bash
cd frontend/react-copilot
npm install
npm run dev
```

By default Vite runs on `http://localhost:5173`.

## Production Build

```bash
cd frontend/react-copilot
npm install
npm run build
```

This generates `frontend/react-copilot/dist`.
Backend serves that build at `/copilot/` when the `dist` folder exists.
