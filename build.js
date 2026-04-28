/**
 * build.js — Accepts Design_Reference.html OR site.html
 * Outputs: public/index.html with bridge.js injected
 */
const fs   = require('fs');
const path = require('path');
const DEST = path.join(__dirname, 'public', 'index.html');

const CANDIDATES = ['site.html','Design_Reference.html','design_reference.html','source.html'];
let SRC = null;
for (const name of CANDIDATES) {
  const c = path.join(__dirname, name);
  if (fs.existsSync(c)) { SRC = c; break; }
}
if (!SRC) {
  console.error('\n❌  HTML file not found. Upload Design_Reference.html to the project root.\n');
  process.exit(1);
}
console.log(`📄  Source: ${path.basename(SRC)}`);

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

let html = fs.readFileSync(SRC, 'utf8');
console.log(`📖  Read ${(html.length/1024).toFixed(0)} KB`);

const BRIDGE = '\n  <!-- Vercel Bridge -->\n  <script src="/bridge.js" defer></script>';
html = html.includes('<head>') ? html.replace('<head>', '<head>' + BRIDGE) : BRIDGE + '\n' + html;

fs.writeFileSync(DEST, html, 'utf8');
console.log(`🚀  Built → public/index.html (${(fs.statSync(DEST).size/1024).toFixed(0)} KB)`);
