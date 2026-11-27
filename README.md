# editor-de-muebles

Editor 2D frontal para bosquejar muebles de melamina y sus divisiones internas.

## Desarrollo local

Requiere Node.js 20 o superior.

La persistencia usa Vercel Blob a través del helper reutilizable `src/lib/server/blobStore.ts`. Cada aplicación debe tener su propio Blob Store en Vercel; el helper recibe explícitamente el token de esa aplicación y el prefijo (namespace) que debe usar. En este proyecto el namespace es `furniture-designs/` y conserva los diseños existentes.

Para desarrollar localmente, configurá en `.env.local` el `BLOB_READ_WRITE_TOKEN` del store de esta aplicación. No copies el token de otra aplicación. En Vercel, conectá el store correcto a este proyecto y asegurate de que `BLOB_READ_WRITE_TOKEN` pertenezca a ese store. Aunque Vercel también configure `BLOB_STORE_ID`/OIDC, las operaciones de esta app pasan el token explícitamente para evitar que una selección automática apunte a otro store.

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
3. En el proyecto de Vercel, conectá el Blob Store dedicado a esta aplicación. Vercel configurará `BLOB_READ_WRITE_TOKEN` para las funciones; no conectes el store de otra app a este proyecto.
4. Desplegá con `npm run build`; Astro usa el adaptador de Vercel para servir las páginas y el API de persistencia.

Los diseños se guardan bajo el namespace `furniture-designs/` y los Blobs son públicos. El namespace organiza los datos, pero no es una frontera de seguridad. Esta versión no implementa autenticación ni separación de proyectos por usuario: desplegala solo para un grupo de confianza si los diseños no deben ser visibles o modificables por otras personas que conozcan la URL de la aplicación.

Para reutilizar el mecanismo en otra app, incorporá el helper `src/lib/server/blobStore.ts`, creá su propia instancia con el token del store de esa app y un namespace exclusivo, y usa `list()`, `putJson()` y `delete()` en las rutas de servidor. No copies el namespace `furniture-designs/` ni conectes el store de una app a la otra.

Cada push a la rama principal producirá un despliegue nuevo.
