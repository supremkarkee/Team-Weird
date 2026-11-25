// PLACEHOLDER mock payment gateway.
// It exists only so `docker compose up --build` works before the real gateway is built.
// Replace this whole folder with the real mock gateway (ERD §5 lists what it must support).
import http from 'node:http';

const port = Number(process.env.GATEWAY_PORT ?? 4000);

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', placeholder: true }));
  }
  res.writeHead(501, { 'content-type': 'application/json' });
  return res.end(JSON.stringify({
    error: 'not_implemented',
    message: 'Placeholder gateway: replace with the real mock gateway.',
  }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Placeholder gateway listening on port ${port}`);
});
