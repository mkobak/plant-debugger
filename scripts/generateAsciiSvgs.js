#!/usr/bin/env node

/**
 * ASCII to SVG Generator
 * Converts ASCII art from constants.ts to properly sized SVG files
 * Usage: node scripts/generateAsciiSvgs.js
 */

const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
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
  FONT_SIZE: 12,            // Base font size in pixels
  LINE_HEIGHT: 1.0,         // Line height multiplier
  
  // Font path (system fonts or web fonts)
  FONT_PATHS: [
    // Windows system fonts
    'C:/Windows/Fonts/consola.ttf',  // Consolas
    'C:/Windows/Fonts/cour.ttf',     // Courier New
    'C:/Windows/Fonts/lucon.ttf',    // Lucida Console
    // Fallback to Node.js bundled font paths if available
    path.join(__dirname, '../node_modules/@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff'),
    path.join(__dirname, '../fonts/courier-new.ttf'), // Custom font if provided
  ],
  
  // Padding around the text (in pixels)
  PADDING: {
    top: 1,
    right: 1,
    bottom: 1,
    left: 1
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
 * Load a monospace font for path generation
 */
function loadFont() {
  for (const fontPath of CONFIG.FONT_PATHS) {
    try {
      if (fs.existsSync(fontPath)) {
        console.log(`✅ Loading font: ${fontPath}`);
        return opentype.loadSync(fontPath);
      }
    } catch (error) {
      console.warn(`⚠️  Could not load font: ${fontPath}`);
    }
  }
  
  // If no system fonts found, create a simple fallback
  console.warn('⚠️  No monospace font found, using fallback character mapping');
  return null;
}

/**
 * Generate SVG paths from text using loaded font
 */
function generateTextPaths(text, font, fontSize, x, y) {
  if (!font) {
    // Fallback: create simple rectangles for each character
    return generateFallbackPaths(text, fontSize, x, y);
  }
  
  try {
    const path = font.getPath(text, x, y, fontSize);
    return path.toSVG(2); // 2 decimal precision
  } catch (error) {
    console.warn('⚠️  Error generating font paths, using fallback');
    return generateFallbackPaths(text, fontSize, x, y);
  }
}

/**
 * Fallback path generation for when font loading fails
 * Creates simple rectangles to represent ASCII block characters
 */
function generateFallbackPaths(text, fontSize, x, y) {
  let paths = '';
  const charWidth = fontSize * 0.6; // Monospace character width
  const charHeight = fontSize * 0.8; // Character height
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charX = x + (i * charWidth);
    
    // Only create rectangles for non-space characters
    if (char !== ' ' && char.trim() !== '') {
      // Create a rectangle for block characters (█, ╗, ║, etc.)
      if (char.match(/[█╗╝╚╔║═╣╠╬╦╩▓▒░▄▀▐▌]/)) {
        paths += `<rect x="${charX}" y="${y - charHeight}" width="${charWidth}" height="${charHeight}" />`;
      }
      // For other characters, create a smaller rectangle
      else {
        const smallWidth = charWidth * 0.8;
        const smallHeight = charHeight * 0.6;
        paths += `<rect x="${charX}" y="${y - smallHeight}" width="${smallWidth}" height="${smallHeight}" />`;
      }
    }
  }
  
  return paths;
}

/**
 * Calculate precise dimensions for ASCII art
 */
function calculateDimensions(asciiText, fontSize, lineHeight, font = null) {
  const lines = asciiText.split('\n');
  const height = lines.length * fontSize * lineHeight;
  
  let width = 0;
  
  if (font) {
    // Calculate actual width using font metrics for each line
    lines.forEach(line => {
      if (line.trim()) {
        try {
          const path = font.getPath(line, 0, 0, fontSize);
          const bbox = path.getBoundingBox();
          const lineWidth = bbox.x2 - bbox.x1;
          width = Math.max(width, lineWidth);
        } catch (error) {
          // Fallback to character estimation if font path fails
          const charWidth = fontSize * 0.6;
          width = Math.max(width, line.length * charWidth);
        }
      }
    });
  } else {
    // Fallback: use character width estimation
    const maxLineLength = Math.max(...lines.map(line => line.length));
    const charWidth = fontSize * 0.6;
    width = maxLineLength * charWidth;
  }
  
  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
    lines,
    maxLineLength: Math.max(...lines.map(line => line.length))
  };
}

/**
 * Generate SVG content with paths instead of font-dependent text
 */
function generateSVG(asciiText, color, fileName, font) {
  const { width, height, lines } = calculateDimensions(
    asciiText, 
    CONFIG.FONT_SIZE, 
    CONFIG.LINE_HEIGHT,
    font
  );
  
  // Add padding to dimensions
  const totalWidth = width + CONFIG.PADDING.left + CONFIG.PADDING.right;
  const totalHeight = height + CONFIG.PADDING.top + CONFIG.PADDING.bottom;
  
  // Generate SVG header
  let svgContent = `<svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .ascii-path {
      fill: ${color};
    }
  </style>`;

  // Generate paths for each line
  lines.forEach((line, index) => {
    const x = CONFIG.PADDING.left;
    const y = CONFIG.PADDING.top + CONFIG.FONT_SIZE + (index * CONFIG.FONT_SIZE * CONFIG.LINE_HEIGHT);
    
    if (line.trim()) { // Skip empty lines
      const pathContent = generateTextPaths(line, font, CONFIG.FONT_SIZE, x, y);
      
      if (font && pathContent.includes('<path')) {
        // Extract path data from opentype.js output
        const pathMatch = pathContent.match(/d="([^"]+)"/);
        if (pathMatch) {
          svgContent += `\n  <path d="${pathMatch[1]}" class="ascii-path" />`;
        }
      } else {
        // Use fallback rectangles
        svgContent += `\n  <g class="ascii-path">`;
        svgContent += generateFallbackPaths(line, CONFIG.FONT_SIZE, x, y);
        svgContent += `</g>`;
      }
    }
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
  console.log('🎨 Generating ASCII SVG files with vector paths...\n');
  
  // Load font for path generation
  const font = loadFont();
  
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
    const svgContent = generateSVG(file.ascii, file.color, file.name, font);
    const filePath = path.join(CONFIG.OUTPUT_DIR, file.name);
    
    fs.writeFileSync(filePath, svgContent, 'utf8');
    console.log(`✅ Saved: ${filePath}`);
  });
  
  console.log('\n🎉 All SVG files generated successfully with vector paths!');
  console.log('✅ These SVGs will render consistently across all devices and browsers.');
  console.log('\nTo customize colors or settings, edit the CONFIG object at the top of this script.');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { generateSVG, calculateDimensions, loadFont, CONFIG };
