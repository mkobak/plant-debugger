#!/usr/bin/env node

/**
 * ASCII Art Extractor
 * Extracts ASCII art from constants.ts and updates the SVG generator script
 * Usage: node scripts/updateAsciiFromConstants.js
 */

const fs = require('fs');
const path = require('path');
const { generateSVG, calculateDimensions, CONFIG } = require('./generateAsciiSvgs');

const CONSTANTS_PATH = path.join(__dirname, '../src/lib/constants.ts');
const SVG_GENERATOR_PATH = path.join(__dirname, 'generateAsciiSvgs.js');

/**
 * Extract ASCII art from constants.ts
 */
function extractAsciiFromConstants() {
  if (!fs.existsSync(CONSTANTS_PATH)) {
    throw new Error(`Constants file not found: ${CONSTANTS_PATH}`);
  }
  
  const content = fs.readFileSync(CONSTANTS_PATH, 'utf8');
  
  // Extract ASCII_LOGO_SINGLE
  const singleMatch = content.match(/export const ASCII_LOGO_SINGLE = `([^`]+)`/s);
  const single = singleMatch ? singleMatch[1] : null;
  
  // Extract ASCII_LOGO_TWO_LINES
  const twoLinesMatch = content.match(/export const ASCII_LOGO_TWO_LINES = `([^`]+)`/s);
  const twoLines = twoLinesMatch ? twoLinesMatch[1] : null;
  
  // Extract ASCII_PLANT_LOGO
  const plantMatch = content.match(/export const ASCII_PLANT_LOGO =`([^`]+)`/s);
  const plant = plantMatch ? plantMatch[1] : null;
  
  if (!single || !twoLines || !plant) {
    throw new Error('Could not extract all ASCII art from constants.ts');
  }
  
  return { single, twoLines, plant };
}

/**
 * Update the SVG generator script with new ASCII art
 */
function updateSvgGenerator(asciiArt) {
  if (!fs.existsSync(SVG_GENERATOR_PATH)) {
    throw new Error(`SVG generator script not found: ${SVG_GENERATOR_PATH}`);
  }
  
  let content = fs.readFileSync(SVG_GENERATOR_PATH, 'utf8');
  
  // Create the new ASCII_ART object
  const newAsciiArt = `const ASCII_ART = {
  single: \`${asciiArt.single}\`,

  twoLines: \`${asciiArt.twoLines}\`,

  plant: \`${asciiArt.plant}\`
};`;
  
  // Replace the existing ASCII_ART object
  content = content.replace(/const ASCII_ART = \{[^}]+\};/s, newAsciiArt);
  
  fs.writeFileSync(SVG_GENERATOR_PATH, content, 'utf8');
  console.log('✅ Updated SVG generator script with ASCII art from constants.ts');
}

/**
 * Main execution
 */
function main() {
  try {
    console.log('🔄 Extracting ASCII art from constants.ts...');
    const asciiArt = extractAsciiFromConstants();
    
    console.log('📝 Updating SVG generator script...');
    updateSvgGenerator(asciiArt);
    
    console.log('🎉 Done! You can now run "npm run generate-svgs" to create updated SVG files.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { extractAsciiFromConstants, updateSvgGenerator };
