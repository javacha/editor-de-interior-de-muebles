import type { APIRoute } from 'astro';
import { isDesign, listDesigns, saveDesign } from '../../../lib/server/designs';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    return Response.json({ designs: await listDesigns() });
  } catch (error) {
    console.error('Error al listar diseños de Vercel Blob:', error);
    return Response.json({ error: 'No se pudieron cargar los proyectos.' }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return Response.json({ error: 'El cuerpo de la solicitud no es JSON válido.' }, { status: 400 });
  }

  if (!isDesign(value)) {
    return Response.json({ error: 'El proyecto no tiene un formato válido.' }, { status: 400 });
  }

  try {
    await saveDesign(value);
    return Response.json({ design: value });
  } catch (error) {
    console.error('Error al guardar diseño en Vercel Blob:', error);
    return Response.json({ error: 'No se pudo guardar el proyecto.' }, { status: 500 });
  }
};