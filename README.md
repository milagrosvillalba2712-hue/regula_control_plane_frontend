# Regula Control Plane Frontend

UI central para el Admin General de Regula.

## Alcance Del Primer Corte

- Dashboard de empresas, planes, instalaciones y catalogos publicados.
- Consume `regula_control_plane_backend` en `http://localhost:8090`.
- Usa `X-API-Key` desde `VITE_CONTROL_PLANE_ADMIN_KEY`.

## Ejecutar

```powershell
npm install
npm run dev
```

Puerto por defecto: `5174`.

Variables:

```text
VITE_CONTROL_PLANE_ADMIN_KEY=...
```

## Validación

```powershell
npm run build
```
