#!/usr/bin/env node

/**
 * ASCII to SVG Generator
 * Converts ASCII art from constants.ts to properly sized SVG files
 * Usage: node scripts/generateAsciiSvgs.js
 */

const fs = require('fs');
const path = require('path');
const { extractColorsFromCSS } = require('./extractColors');

// Extract colors from CSS
let cssColors = {};
try {
  cssColors = extractColorsFromCSS();
  console.log('✅ Extracted colors from base.css');
} catch (error) {
  console.warn('⚠️  Could not extract colors from base.css, using fallback colors');
}

/**
 * Extract ASCII art directly from constants.ts
 */
function extractAsciiFromConstants() {
  const constantsPath = path.join(__dirname, '../src/lib/constants.ts');
  
  if (!fs.existsSync(constantsPath)) {
    throw new Error(`Constants file not found: ${constantsPath}`);
  }
  
  const content = fs.readFileSync(constantsPath, 'utf8');
  
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
    console.warn('⚠️  Could not extract all ASCII art from constants.ts, using fallback');
    return null;
  }
  
  console.log('✅ Extracted ASCII art from constants.ts');
  return { single, twoLines, plant };
}

// Configuration
const CONFIG = {
  // Colors (extracted from base.css, with fallbacks)
  LOGO_COLOR: cssColors.green || '#6dcf43',    // Green for titles
  PLANT_COLOR: cssColors['grey-2'] || '#575757',   // Grey for plant
  
  // Font settings
  FONT_FAMILY: "'Courier New', 'Lucida Console', 'Monaco', monospace",
  FONT_SIZE: 10,            // Base font size in pixels
  LINE_HEIGHT: 1.0,         // Line height multiplier
  
  // Padding around the text (in pixels)
  PADDING: {
    top: -8,       // Minimal top padding to reduce extra space
    right: -7,
    bottom: 9,    // Extra bottom padding to prevent cropping
    left: 0
  },
  
  // Output directory
  OUTPUT_DIR: path.join(__dirname, '../public/images')
};

// Try to extract ASCII art from constants.ts, fallback to hardcoded if fails
const extractedAscii = extractAsciiFromConstants();
const ASCII_ART = extractedAscii || {
  single: `██╗      ██████╗ ██╗      █████╗ ███╗   ██╗████████╗    ██████╗ ███████╗██████╗ ██╗   ██╗ ██████╗  ██████╗ ███████╗██████╗ 
╚██╗     ██╔══██╗██║     ██╔══██╗████╗  ██║╚══██╔══╝    ██╔══██╗██╔════╝██╔══██╗██║   ██║██╔════╝ ██╔════╝ ██╔════╝██╔══██╗
 ╚██╗    ██████╔╝██║     ███████║██╔██╗ ██║   ██║       ██║  ██║█████╗  ██████╔╝██║   ██║██║  ███╗██║  ███╗█████╗  ██████╔╝
 ██╔╝    ██╔═══╝ ██║     ██╔══██║██║╚██╗██║   ██║       ██║  ██║██╔══╝  ██╔══██╗██║   ██║██║   ██║██║   ██║██╔══╝  ██╔══██╗
██╔╝     ██║     ███████╗██║  ██║██║ ╚████║   ██║       ██████╔╝███████╗██████╔╝╚██████╔╝╚██████╔╝╚██████╔╝███████╗██║  ██║
╚═╝      ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝       ╚═════╝ ╚══════╝╚═════╝  ╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝`,

  twoLines: `██╗      ██████╗ ██╗      █████╗ ███╗   ██╗████████╗
╚██╗     ██╔══██╗██║     ██╔══██╗████╗  ██║╚══██╔══╝
 ╚██╗    ██████╔╝██║     ███████║██╔██╗ ██║   ██║   
 ██╔╝    ██╔═══╝ ██║     ██╔══██║██║╚██╗██║   ██║   
██╔╝     ██║     ███████╗██║  ██║██║ ╚████║   ██║   
╚═╝      ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝  
                                                  

██████╗ ███████╗██████╗ ██╗   ██╗ ██████╗  ██████╗ ███████╗██████╗ 
██╔══██╗██╔════╝██╔══██╗██║   ██║██╔════╝ ██╔════╝ ██╔════╝██╔══██╗
██║  ██║█████╗  ██████╔╝██║   ██║██║  ███╗██║  ███╗█████╗  ██████╔╝
██║  ██║██╔══╝  ██╔══██╗██║   ██║██║   ██║██║   ██║██╔══╝  ██╔══██╗
██████╔╝███████╗██████╔╝╚██████╔╝╚██████╔╝╚██████╔╝███████╗██║  ██║
╚═════╝ ╚══════╝╚═════╝  ╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝`,

  plant: `#############
#################
####.......#########
####............######                    #######
#####.............#####             ##################
 ####.....####......####         #####################
 ####......######....####      ######.............####
  ####.......######...####    #####..............####
   ####.........#####.####   ####......#####.....####
    #####.........########   ####...#######.....####
     ######........#######  ####..######.......#####
       ##################   #########.........#####
          ################  #######.........#####
                ####   ####  ######.....########
                        ######################
                        #######  #########
                        #######
                         #####
                         #####
                         #####
      ##########################################
     ############################################
     ####....................................####
     ####....................................####
     ####....................................####
      ##########################################
       #########################################
        ####..............................####
         ###..............................###
         ###..........###....###..........###
         ####..##########....##########..####
         ####...#######........#######...####
         ####............................####
          ###...........######...........####
          ###........#############.......####
          ####.....####........####.....####
          ####.....###..........###.....####
          ####..........................####
          ####..........................####
           ####........................####
            ##############################
              ##########################`
};

/**
 * Calculate precise dimensions for ASCII art
 */
function calculateDimensions(asciiText, fontSize, lineHeight) {
  const lines = asciiText.split('\n');
  const height = lines.length * fontSize * lineHeight;
  
  // Find the longest line to determine width
  const maxLineLength = Math.max(...lines.map(line => line.length));
  
  // Average character width for monospace fonts (approximately 0.6 * fontSize)
  const charWidth = fontSize * 0.6;
  const width = maxLineLength * charWidth;
  
  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
    lines,
    maxLineLength
  };
}

/**
 * Generate SVG content
 */
function generateSVG(asciiText, color, fileName) {
  const { width, height, lines } = calculateDimensions(
    asciiText, 
    CONFIG.FONT_SIZE, 
    CONFIG.LINE_HEIGHT
  );
  
  // Add padding to dimensions
  const totalWidth = width + CONFIG.PADDING.left + CONFIG.PADDING.right;
  const totalHeight = height + CONFIG.PADDING.top + CONFIG.PADDING.bottom;
  
  // Generate SVG
  let svgContent = `<svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .ascii-text {
      font-family: ${CONFIG.FONT_FAMILY};
      font-size: ${CONFIG.FONT_SIZE}px;
      fill: ${color};
      white-space: pre;
      dominant-baseline: text-before-edge;
    }
  </style>`;

  // Add text elements for each line
  lines.forEach((line, index) => {
    // Improved Y positioning: start closer to top with minimal padding
    const y = CONFIG.PADDING.top + CONFIG.FONT_SIZE + (index * CONFIG.FONT_SIZE * CONFIG.LINE_HEIGHT);
    svgContent += `\n  <text x="${CONFIG.PADDING.left}" y="${y}" class="ascii-text">${escapeXml(line)}</text>`;
  });
  
  svgContent += '\n</svg>';
  
  console.log(`Generated ${fileName}: ${totalWidth}x${totalHeight}px (${lines.length} lines)`);
  return svgContent;
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Ensure output directory exists
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🎨 Generating ASCII SVG files...\n');
  
  // Ensure output directory exists
  ensureDirectoryExists(CONFIG.OUTPUT_DIR);
  
  // Generate each SVG file
  const files = [
    {
      name: 'ascii-logo-single.svg',
      ascii: ASCII_ART.single,
      color: CONFIG.LOGO_COLOR
    },
    {
      name: 'ascii-logo-two-lines.svg',
      ascii: ASCII_ART.twoLines,
      color: CONFIG.LOGO_COLOR
    },
    {
      name: 'ascii-plant-logo.svg',
      ascii: ASCII_ART.plant,
      color: CONFIG.PLANT_COLOR
    }
  ];
  
  files.forEach(file => {
    const svgContent = generateSVG(file.ascii, file.color, file.name);
    const filePath = path.join(CONFIG.OUTPUT_DIR, file.name);
    
    fs.writeFileSync(filePath, svgContent, 'utf8');
    console.log(`✅ Saved: ${filePath}`);
  });
  
  console.log('\n🎉 All SVG files generated successfully!');
  console.log('\nTo customize colors or settings, edit the CONFIG object at the top of this script.');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { generateSVG, calculateDimensions, CONFIG };
