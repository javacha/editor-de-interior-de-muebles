# editor-de-muebles

Editor 2D frontal para bosquejar muebles de melamina y sus divisiones internas.

## Desarrollo local

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abrí la dirección que indique Astro, normalmente `http://localhost:4321`.

Para crear una versión de producción:

```bash
npm run build
npm run preview
```

## Versionado con Git

```bash
git init
git add .
git commit -m "feat: editor de muebles"
```

Luego creá un repositorio vacío en tu proveedor Git y asociá el remoto:

```bash
git remote add origin <URL_DEL_REPOSITORIO>
git branch -M main
git push -u origin main
```

## Despliegue en Vercel

1. Subí el repositorio a GitHub, GitLab o Bitbucket.
2. En [Vercel](https://vercel.com/new), importá el repositorio.
3. Vercel detectará Astro automáticamente. Conservá los comandos sugeridos: `npm run build` para build y `dist` como directorio de salida.
4. Seleccioná **Deploy**.

No requiere variables de entorno ni configuración adicional. Cada push a la rama principal producirá un despliegue nuevo.
