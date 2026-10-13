import {DurableObject} from 'cloudflare:workers';
import {resolveSave} from './save.js';

// One Durable Object per user ID, holding the whole log as a single value.
// A stale save combines today's ticks; the rest of the incoming log replaces the stored log.
export class UserLog extends DurableObject {
  async read() {
    return (await this.ctx.storage.get('saved')) ?? null;
  }

  async write(incoming) {
    return this.ctx.storage.transaction(async storage => {
      const current = await storage.get('saved');
      const saved = resolveSave(current, incoming);
      await storage.put('saved', saved);
      return saved;
    });
  }
}

export default {
  async fetch(request, env) {
    const match = new URL(request.url).pathname.match(/^\/api\/log\/([a-z0-9]{12})$/);
    if (!match) return new Response('Not found', {status: 404});
    const stub = env.USER_LOG.getByName(match[1]);
    if (request.method === 'GET') {
      const saved = await stub.read();
      return saved ? Response.json(saved) : new Response('Unknown ID', {status: 404});
    }
    if (request.method === 'PUT') {
      return Response.json(await stub.write(await request.json()));
    }
    return new Response('Method not allowed', {status: 405});
  },
};
