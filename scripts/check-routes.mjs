import http from 'node:http';

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 5173, path, method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () =>
          resolve({
            path,
            status: res.statusCode,
            len: data.length,
            head: data.substring(0, 240),
          })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const paths = [
    '/',
    '/d1-demo',
    '/d2-prime-demo',
    '/d3-demo',
    '/a5-demo',
    '/d5-demo',
    '/d5-recording-to-skill',
    '/chat',
  ];
  for (const p of paths) {
    try {
      const r = await get(p);
      console.log(JSON.stringify(r));
    } catch (e) {
      console.log(JSON.stringify({ path: p, err: e.message }));
    }
  }
})();
