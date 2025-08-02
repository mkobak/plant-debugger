# Plant Debugger

An AI-powered plant health diagnostic tool that helps users identify plant diseases, pest infestations, and care issues through image analysis and contextual information.

## Features

- **Terminal-style UI** with cross-browser compatible ASCII art branding
- **Multi-step diagnosis flow**: Upload → Questions → Results  
- **AI-powered plant identification** and health analysis
- **Interactive diagnostic questions** to refine diagnosis
- **Comprehensive treatment recommendations** with prevention tips
- **PDF export functionality** for complete diagnosis reports
- **Responsive design** optimized for mobile and desktop
- **Automated ASCII art system** with SVG generation for universal browser support

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: CSS Modules with custom terminal theme
- **Testing**: Jest + React Testing Library
- **Image Processing**: browser-image-compression
- **Code Quality**: ESLint + Prettier

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/plant-debugger.git
   cd plant-debugger
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Add your API keys:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (routes)/          # Route groups for multi-step flow
│   │   ├── upload/        # Image upload step
│   │   ├── questions/     # Diagnostic questions step
│   │   └── results/       # Results and recommendations
│   ├── api/               # API routes for AI integration
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Reusable UI components
│   ├── ui/               # Atomic UI elements
│   └── layout/           # Layout components
├── features/             # Feature-specific logic and state
│   ├── upload/           # Upload functionality
│   ├── diagnosis/        # Diagnosis logic
│   └── questions/        # Question handling
├── lib/                  # Shared utilities and API clients
├── types/                # TypeScript type definitions
├── hooks/                # Custom React hooks
├── context/              # React context providers
├── utils/                # General utility functions
└── styles/               # Global and component styles
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run generate-svgs` - Generate SVG files from ASCII art in constants.ts
- `npm run update-ascii` - Extract ASCII art from constants.ts and regenerate SVGs

## ASCII Art System

The application uses a custom SVG generation system for cross-browser compatible ASCII art logos:

### How It Works

1. **ASCII Art Storage**: ASCII art is stored in `src/lib/constants.ts`
2. **Automatic Extraction**: Scripts automatically extract ASCII art from constants
3. **SVG Generation**: Converts text-based ASCII to properly sized SVG images
4. **CSS Integration**: Colors are extracted from `src/styles/base.css` design system
5. **React Components**: `ASCIILogo` component displays SVGs responsively

### Updating ASCII Art

1. Edit ASCII art in `src/lib/constants.ts`:
   - `ASCII_LOGO_SINGLE` - Single line logo
   - `ASCII_LOGO_TWO_LINES` - Two-line logo
   - `ASCII_PLANT_LOGO` - Plant ASCII art

2. Regenerate SVG files:
   ```bash
   npm run update-ascii
   ```

3. SVG files are automatically saved to `public/images/` and dimensions are calculated

### Script Files

- `scripts/generateAsciiSvgs.js` - Main SVG generation logic
- `scripts/extractColors.js` - Extracts colors from CSS custom properties  
- `scripts/updateAsciiFromConstants.js` - Orchestrates the update process
- `scripts/README.md` - Detailed documentation for script usage

## Development Guidelines

- **Clean Code**: Avoid duplication, create reusable components
- **Future-Ready**: Architecture designed for user accounts, premium features
- **PDF Export**: All formatting optimized for PDF generation
- **Accessibility**: WCAG 2.1 AA compliant
- **Performance**: <3s initial page load target

## API Integration

The app integrates with Google Gemini API for:
- Plant species identification
- Diagnostic question generation  
- Multi-expert diagnosis consensus
- Treatment recommendation generation

## Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Deployment

The application is configured for deployment on Vercel:

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on every push to main branch

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap

- [ ] Core MVP features
- [ ] User authentication system
- [ ] Premium feature tiers  
- [ ] Diagnosis history storage
- [ ] Advanced AI models
- [ ] Mobile app versions
