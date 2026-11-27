import { del, list, put } from '@vercel/blob';

export type BlobStoreConfig = {
  token?: string;
  namespace: string;
};

/**
 * Creates a namespaced Blob client. Passing the token explicitly prevents
 * Vercel's automatic OIDC/store selection from silently choosing another store.
 */
export function createBlobStore(config: BlobStoreConfig) {
  const namespace = config.namespace.replace(/^\/+|\/+$/g, '');
  if (!namespace) throw new Error('Blob namespace must not be empty.');

  function getToken() {
    const token = config.token?.trim();
    if (!token) throw new Error('Missing Blob read/write token for this application.');
    return token;
  }

  function getPath(key: string) {
    const normalizedKey = key.replace(/^\/+/, '');
    if (!normalizedKey || normalizedKey.split('/').includes('..')) {
      throw new Error('Invalid Blob key.');
    }
    return `${namespace}/${normalizedKey}`;
  }

  return {
    async list() {
      const blobs: Awaited<ReturnType<typeof list>>['blobs'] = [];
      let cursor: string | undefined;

      do {
        const page = await list({ prefix: `${namespace}/`, cursor, token: getToken() });
        blobs.push(...page.blobs);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);

      return blobs;
    },

    putJson(key: string, value: unknown, access: 'public' | 'private' = 'public') {
      return put(getPath(key), JSON.stringify(value), {
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        token: getToken(),
      });
    },

    delete(key: string) {
      return del(getPath(key), { token: getToken() });
    },
  };
}