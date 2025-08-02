# ASCII SVG Generator

This automated system converts ASCII art from `constants.ts` into cross-browser compatible SVG files.

## Usage

### Automatic Update (Recommended)
```bash
npm run update-ascii
```
This command:
1. Extracts ASCII art from `src/lib/constants.ts`
2. Extracts colors from `src/styles/base.css`
3. Generates optimized SVG files
4. Updates dimensions automatically

### Manual Generation Only
```bash
npm run generate-svgs
```
This only generates SVGs using current script configuration.

## Workflow

### Method 1: Fully Automated (Recommended)
1. Edit ASCII art in `src/lib/constants.ts`:
   - `ASCII_LOGO_SINGLE`
   - `ASCII_LOGO_TWO_LINES`
   - `ASCII_PLANT_LOGO`
2. Run `npm run update-ascii`
3. Done! Everything is automatically updated.

### Method 2: Manual (Not Recommended)
1. Edit the fallback `ASCII_ART` object in `scripts/generateAsciiSvgs.js`
2. Run `npm run generate-svgs`
3. Manually update dimensions in `ASCIILogo.tsx`

## Features

- **Automatic extraction**: Reads ASCII art directly from `constants.ts`
- **CSS color integration**: Extracts colors from your design system
- **Precise sizing**: Calculates exact dimensions with minimal padding
- **No extra whitespace**: Optimized top/bottom spacing
- **Browser universal**: Works on Chrome Android, Safari, Firefox, etc.
- **Vector-based**: Scales perfectly at any size

## Configuration

The system automatically extracts colors from `base.css`, but you can customize other settings in `scripts/generateAsciiSvgs.js`:

### Colors (Auto-extracted from CSS)
```javascript
LOGO_COLOR: cssColors.green || '#6dcf43',           // --color-green
PLANT_COLOR: cssColors['grey-2'] || '#575757',      // --color-grey-2
```

### Font Settings
```javascript
FONT_FAMILY: "'Courier New', 'Lucida Console', 'Monaco', monospace",
FONT_SIZE: 10,            // Base font size in pixels
LINE_HEIGHT: 1.0,         // Line height multiplier
```

### Padding (Optimized)
```javascript
PADDING: {
  top: 1,       // Minimal top padding
  right: 4,     // Side padding
  bottom: 8,    // Extra bottom padding to prevent cropping
  left: 4       // Side padding
}
```
FONT_SIZE: 10,            // Base font size in pixels
LINE_HEIGHT: 1.0,         // Line height multiplier
```

### Padding
```javascript
PADDING: {
  top: 2,
  right: 2,
  bottom: 2,
  left: 2
}
```

## Output

The system generates three optimized SVG files in `/public/images/`:
- `ascii-logo-single.svg` - Single-line logo (752x69px)
- `ascii-logo-two-lines.svg` - Two-line logo (416x149px)
- `ascii-plant-logo.svg` - Plant ASCII art (338x429px)

*Dimensions are automatically calculated and may change based on content.*

## How It Works

1. **Extracts ASCII art** directly from `src/lib/constants.ts` using regex patterns
2. **Extracts colors** from CSS custom properties in `src/styles/base.css`
3. **Calculates precise dimensions** by analyzing character count and line height
4. **Generates optimized SVG** with minimal padding and proper viewBox
5. **Saves files** to public directory with cross-browser compatibility
6. **Updates React component** dimensions automatically

## File Structure

```
scripts/
├── generateAsciiSvgs.js        # Main SVG generation logic
├── extractColors.js            # CSS color extraction utility
├── updateAsciiFromConstants.js # Orchestrates the update process
└── README.md                   # This documentation
```

## Benefits

- ✅ **Universal compatibility** (Chrome Android, Safari, Firefox, etc.)
- ✅ **Zero extra whitespace** (optimized padding)
- ✅ **No cropping issues** (proper bottom padding)
- ✅ **Automatic color sync** (extracted from design system)
- ✅ **Vector-based scaling** (crisp at any size)
- ✅ **Fully automated workflow** (one command updates everything)
- ✅ **Maintainable** (ASCII art stored in constants, not hardcoded)

## Updating ASCII Art

1. Edit ASCII art in `src/lib/constants.ts`
2. Run `npm run update-ascii`
3. Everything else is automatic! ✨

The system handles XML escaping, dimension calculation, color extraction, and React component updates automatically.
