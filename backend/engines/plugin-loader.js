const fs = require('fs');
const path = require('path');

function loadPlugins() {
  const pluginsDir = path.join(__dirname, '../plugins');
  if (!fs.existsSync(pluginsDir)) return [];

  return fs.readdirSync(pluginsDir).filter(folder => {
    return fs.statSync(path.join(pluginsDir, folder)).isDirectory();
  }).map(folder => {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(pluginsDir, folder, 'manifest.json'), 'utf8'));
      const run = require(path.join(pluginsDir, folder, manifest.entry));
      return { ...manifest, run };
    } catch (e) {
      console.error(`[PLUGIN] Failed to load ${folder}:`, e.message);
      return null;
    }
  }).filter(Boolean);
}

module.exports = { loadPlugins };
