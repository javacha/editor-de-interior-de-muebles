import { del, list, put } from '@vercel/blob';

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

const PREFIX = 'furniture-designs/';
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
  const blobs = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: PREFIX, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const designs = await Promise.all(blobs.map(async (blob) => {
    try {
      const response = await fetch(blob.url);
      if (!response.ok) return null;
      const value: unknown = await response.json();
      return isDesign(value) ? value : null;
    } catch {
      return null;
    }
  }));

  return designs
    .filter((design): design is Design => design !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function saveDesign(design: Design): Promise<void> {
  await put(`${PREFIX}${design.id}.json`, JSON.stringify(design), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export async function deleteDesign(id: string): Promise<void> {
  await del(`${PREFIX}${id}.json`);
}