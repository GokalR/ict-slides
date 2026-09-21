export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;

  if (request.method === 'HEAD') {
    const head = await env.VIDEO.head(key);
    if (!head) return new Response(null, { status: 404 });
    const h = new Headers();
    head.writeHttpMetadata(h);
    h.set('etag', head.httpEtag);
    h.set('accept-ranges', 'bytes');
    h.set('content-length', String(head.size));
    h.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(null, { status: 200, headers: h });
  }

  const object = await env.VIDEO.get(key, {
    range: request.headers,
    onlyIf: request.headers,
  });

  if (!object) return new Response('Not Found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  if (!('body' in object)) {
    return new Response(null, { status: 304, headers });
  }

  const r = object.range;
  if (r && request.headers.has('range')) {
    let start, length;
    if (typeof r.suffix === 'number') {
      length = Math.min(r.suffix, object.size);
      start = object.size - length;
    } else {
      start = typeof r.offset === 'number' ? r.offset : 0;
      length = typeof r.length === 'number' ? r.length : object.size - start;
    }
    headers.set('content-range', `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set('content-length', String(length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('content-length', String(object.size));
  return new Response(object.body, { status: 200, headers });
}
