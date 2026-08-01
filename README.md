# INNOVIO – Sistema de Facturación v2.0

Versión modernizada del sistema de facturación INNOVIO.
La versión 1 (`../Hoja de Servicio/innovio-billing2.6.html`) sigue funcionando intacta.

## Stack

- **Vite** + JavaScript modular (sin framework pesado)
- **Supabase** (Auth + Postgres + Storage + Edge Functions) — usa la **misma base de datos** que v1
- **CSS plano** con tokens — conserva la identidad visual de v1 (paleta navy, Plus Jakarta Sans, etc.)
- Router por hash (compatible con GitHub Pages y Vercel sin configuración extra)

## Instalación

```bash
npm install
```

Copiar variables de entorno:

```bash
copy .env.example .env
```

Editar `.env` y poner tus claves (las de v1 ya están en `.env.example`).

## Desarrollo

```bash
npm run dev
```

Abre en `http://localhost:5173`.

## Build de producción

```bash
npm run build
```

El resultado queda en `dist/`. `npm run preview` para servirlo localmente.

## Despliegue

### Vercel (recomendado)
1. Subí el repo a GitHub.
2. Importá el repo en Vercel.
3. En **Settings → Environment Variables** agregá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Listo. `vercel.json` ya está configurado.

### GitHub Pages
1. `npm run build`.
2. Subí la carpeta `dist/` a la rama `gh-pages` (o usá GitHub Actions).
3. Como `base: './'` en `vite.config.js`, funciona en cualquier subruta.

## Estructura

```
src/
├── main.js              # Entry point + router
├── lib/
│   ├── supabase.js      # Cliente Supabase
│   ├── router.js        # Router hash
│   ├── auth.js          # Helpers de autenticación
│   └── utils.js         # Utilidades (formatos, fechas, etc.)
├── styles/
│   ├── tokens.css       # Variables CSS (identidad visual de v1)
│   ├── base.css         # Reset + tipografía
│   ├── app.css          # Layout app (sidebar, topbar, cards)
│   └── comprobante.css  # (futuro) Estilos del comprobante – copia exacta de v1
├── components/          # Componentes reutilizables (sidebar, toast, modales)
└── views/               # Vistas (login, dashboard, documentos, clientes)
```

## Roadmap

- [x] Estructura base + login + listados (lectura de BD existente)
- [ ] Editor de documento con comprobante idéntico a v1
- [ ] Dashboard con métricas
- [ ] Flujo Hacienda real (firma .p12 + envío API)
- [ ] Pagos parciales / cobros
- [ ] Modo offline (IndexedDB)

## Reglas del proyecto

1. **No tocar** `../Hoja de Servicio/`. Esa es producción estable.
2. **Usar la misma BD Supabase** que v1. Si hace falta una tabla nueva, se agrega con `IF NOT EXISTS` sin romper.
3. **El diseño del comprobante** se copia tal cual de v1, no se modifica.
