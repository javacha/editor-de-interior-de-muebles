import type { APIRoute } from 'astro';
import { deleteDesign } from '../../../lib/server/designs';

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id || !UUID_PATTERN.test(id)) {
    return Response.json({ error: 'Identificador de proyecto inválido.' }, { status: 400 });
  }

  try {
    await deleteDesign(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error al eliminar diseño de Vercel Blob:', error);
    return Response.json({ error: 'No se pudo eliminar el proyecto.' }, { status: 500 });
  }
};