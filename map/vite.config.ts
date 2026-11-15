import { defineConfig, type Plugin } from 'vite';
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';

// Arksus data lives in ../web/public/data (owned by the web/contract side).
// Serve it under /data/nobetsu in dev and copy it into the build, instead of
// keeping a second copy in this folder.
const DATA = resolve(import.meta.dirname, '../web/public/data');
// ledger/ is ~2 MB per district and only fetched when the process simulation opens.
const FILES = ['site_index.json', 'defaults.json', 'validation.json', 'results', 'smap', 'ledger', 'agent'];

function nobetsuData(): Plugin {
  return {
    name: 'nobetsu-data',
    configureServer(server) {
      server.middlewares.use('/data/nobetsu', (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^([/\\])+/, '');
        const file = join(DATA, rel);
        if (!file.startsWith(DATA) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        createReadStream(file).pipe(res);
      });
    },
    writeBundle(options) {
      if (process.env.VITE_NOBETSU_DATA) return; // the host site serves the data (see pilots.ts)
      const out = join(options.dir ?? 'dist', 'data/nobetsu');
      // agent/ exists only after `python -m nobetsu.agent`; skip any optional folder that is missing.
      for (const f of FILES) if (existsSync(join(DATA, f))) cpSync(join(DATA, f), join(out, f), { recursive: true });
    },
  };
}

// Upstream hosts the app talks to. With VITE_TILE_PROXY=1 the dev server
// relays them under /x/<name>/..., for sandboxed browsers that can reach
// localhost but not the internet. Production builds always call them directly.
export const UPSTREAMS: Record<string, string> = {
  s3: 'https://s3.amazonaws.com',
  esri: 'https://server.arcgisonline.com',
  eox: 'https://tiles.maps.eox.at',
  osm: 'https://tile.openstreetmap.org',
  topo: 'https://a.tile.opentopomap.org',
  ovpa: 'https://overpass-api.de',
  ovpb: 'https://maps.mail.ru',
  nominatim: 'https://nominatim.openstreetmap.org',
  tkgm: 'https://cbsapi.tkgm.gov.tr',
};

export default defineConfig({
  plugins: [nobetsuData()],
  server: {
    proxy: Object.fromEntries(
      Object.entries(UPSTREAMS).map(([name, target]) => [
        `/x/${name}`,
        {
          target,
          changeOrigin: true,
          rewrite: (p: string) => p.replace(`/x/${name}`, ''),
          // OSM's tile and Nominatim policies require an identifying User-Agent.
          headers: { 'User-Agent': 'Terrashift-dev/0.1 (local development)' },
        },
      ]),
    ),
  },
});
