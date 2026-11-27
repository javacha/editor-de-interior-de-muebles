import { createBlobStore } from './blobStore';

export type Orientation = 'vertical' | 'horizontal';
export type DesignNode =
  | { type: 'leaf' }
  | { type: 'split'; id: string; orientation: Orientation; position: number; first: DesignNode; second: DesignNode };

export type Design = {
  version: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  root: DesignNode;
};

const designStore = createBlobStore({
  token: (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.BLOB_READ_WRITE_TOKEN,
  namespace: 'furniture-designs',
});
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isNode(value: unknown, depth = 0): value is DesignNode {
  if (!value || typeof value !== 'object' || depth > 100) return false;
  const node = value as Partial<DesignNode>;
  if (node.type === 'leaf') return true;
  if (node.type !== 'split' || !('first' in node) || !('second' in node)) return false;
  const split = node as Extract<DesignNode, { type: 'split' }>;
  return typeof split.id === 'string'
    && (split.orientation === 'vertical' || split.orientation === 'horizontal')
    && Number.isFinite(split.position)
    && isNode(split.first, depth + 1)
    && isNode(split.second, depth + 1);
}

export function isDesign(value: unknown): value is Design {
  if (!value || typeof value !== 'object') return false;
  const design = value as Partial<Design>;
  return design.version === 1
    && typeof design.id === 'string'
    && UUID_PATTERN.test(design.id)
    && typeof design.name === 'string'
    && design.name.trim().length > 0
    && Number.isFinite(design.width)
    && Number.isFinite(design.height)
    && (design.width ?? 0) > 3.6
    && (design.height ?? 0) > 3.6
    && isNode(design.root);
}

export async function listDesigns(): Promise<Design[]> {
  const blobs = await designStore.list();

  const designs = await Promise.all(blobs.map(async (blob) => {
    try {
      const response = await fetch(blob.url);
      if (!response.ok) {
        console.warn(`No se pudo descargar el Blob ${blob.pathname}: HTTP ${response.status}`);
        return null;
      }
      const value: unknown = await response.json();
      if (!isDesign(value)) {
        console.warn(`Se omitió el Blob ${blob.pathname}: no tiene un formato de diseño válido.`);
        return null;
      }
      return value;
    } catch (error) {
      console.warn(`No se pudo leer el Blob ${blob.pathname}:`, error);
      return null;
    }
  }));

  return designs
    .filter((design): design is Design => design !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function saveDesign(design: Design): Promise<void> {
  await designStore.putJson(`${design.id}.json`, design);
}

export async function deleteDesign(id: string): Promise<void> {
  await designStore.delete(`${id}.json`);
}