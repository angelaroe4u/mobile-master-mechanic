#!/usr/bin/env node
/**
 * Patches expo-asset's AssetUris.js for React Native 0.81.5 compatibility.
 *
 * ROOT CAUSE:
 *   React Native 0.81.5 defines URL.prototype.protocol, .pathname, .search,
 *   and .hash as getter-only properties (no setters). expo-asset's
 *   getManifestBaseUrl() tries to assign to all four, crashing with:
 *   "Cannot assign to property 'protocol' which has only a getter"
 *
 * THE FIX:
 *   Wrap those four assignments in try-catch. The function already has a
 *   string-replace fallback on the next line — this just lets it reach it.
 *
 * This script runs automatically via package.json's "postinstall" hook.
 */

const fs = require('fs');
const path = require('path');

const TARGET = path.resolve(
  __dirname,
  '../node_modules/expo/node_modules/expo-asset/build/AssetUris.js'
);

if (!fs.existsSync(TARGET)) {
  console.log('[fix-url] AssetUris.js not found at expected path — skipping.');
  process.exit(0);
}

let src = fs.readFileSync(TARGET, 'utf8');

if (src.includes('/* RN-0.81-COMPAT-PATCH */')) {
  console.log('[fix-url] AssetUris.js already patched — nothing to do.');
  process.exit(0);
}

const ORIGINAL = `    urlObject.protocol = nextProtocol;
    // Trim filename, query parameters, and fragment, if any
    const directory = urlObject.pathname.substring(0, urlObject.pathname.lastIndexOf('/') + 1);
    urlObject.pathname = directory;
    urlObject.search = '';
    urlObject.hash = '';`;

const PATCHED = `    /* RN-0.81-COMPAT-PATCH: URL properties are getter-only in RN 0.81.5 — use try-catch
       so the string-replace fallback below can handle protocol conversion. */
    try { urlObject.protocol = nextProtocol; } catch (_) {}
    // Trim filename, query parameters, and fragment, if any
    const directory = urlObject.pathname.substring(0, urlObject.pathname.lastIndexOf('/') + 1);
    try { urlObject.pathname = directory; } catch (_) {}
    try { urlObject.search = ''; } catch (_) {}
    try { urlObject.hash = ''; } catch (_) {}`;

if (!src.includes(ORIGINAL)) {
  console.log('[fix-url] Expected pattern not found — AssetUris.js may have changed. Skipping.');
  process.exit(0);
}

fs.writeFileSync(TARGET, src.replace(ORIGINAL, PATCHED), 'utf8');
console.log('[fix-url] ✓ AssetUris.js patched — RN 0.81.5 URL getter-only fix applied.');
