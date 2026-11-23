# editor-de-muebles

Editor 2D frontal para bosquejar muebles de melamina y sus divisiones internas.

## Desarrollo local

Requiere Node.js 20 o superior.

La persistencia usa Vercel Blob. Para desarrollar localmente, creá un Blob Store en Vercel y configurá su variable `BLOB_READ_WRITE_TOKEN` en un archivo `.env.local` en la raíz del proyecto.

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
3. En el proyecto de Vercel, creá un Blob Store y conectalo al proyecto. Vercel configurará `BLOB_READ_WRITE_TOKEN` para las funciones.
4. Desplegá con `npm run build`; Astro usa el adaptador de Vercel para servir las páginas y el API de persistencia.

Los proyectos se guardan en un Blob Store compartido por la aplicación y las URL de Blob son públicas. Esta versión no implementa autenticación ni separación de proyectos por usuario: desplegala solo para un grupo de confianza si los diseños no deben ser visibles o modificables por otras personas que conozcan la URL de la aplicación.

Cada push a la rama principal producirá un despliegue nuevo.
