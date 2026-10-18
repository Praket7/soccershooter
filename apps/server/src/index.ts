import { createServer } from 'node:http';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '3001', 10);
if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
  throw new RangeError('PORT must be an integer in [1, 65535]');
}

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ status: 'ok', service: 'soccershooter-server', contentMode: 'FICTIONAL_PUBLIC' }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, host, () => {
  console.log(`SoccerShooter server shell listening on http://${host}:${port}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}; closing SoccerShooter server shell.`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
