import {DurableObject} from 'cloudflare:workers';

// One Durable Object per user ID, holding the whole log as a single value.
// The server is a dumb store: the client owns validation and last-write-wins.
export class UserLog extends DurableObject {
  async read() {
    return (await this.ctx.storage.get('saved')) ?? null;
  }

  async write(saved) {
    await this.ctx.storage.put('saved', saved);
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
      await stub.write(await request.json());
      return new Response(null, {status: 204});
    }
    return new Response('Method not allowed', {status: 405});
  },
};
