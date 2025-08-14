#!/usr/bin/env node

/**
 * CSS Color Extractor
 * Extracts CSS custom properties from base.css
 */

const fs = require('fs');
const path = require('path');

const BASE_CSS_PATH = path.join(__dirname, '../src/styles/base.css');

/**
 * Extract CSS custom properties from base.css
 */
function extractColorsFromCSS() {
  if (!fs.existsSync(BASE_CSS_PATH)) {
    throw new Error(`base.css not found: ${BASE_CSS_PATH}`);
  }

  const content = fs.readFileSync(BASE_CSS_PATH, 'utf8');

  // Extract CSS custom properties
  const colors = {};
  const colorRegex = /--([a-zA-Z0-9-]+):\s*([^;]+);/g;
  let match;

  while ((match = colorRegex.exec(content)) !== null) {
    const [, name, value] = match;
    colors[name] = value.trim();
  }

  return colors;
}

module.exports = { extractColorsFromCSS };
