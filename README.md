# Plant Debugger

Great at debugging code but struggling to keep plants alive?
Plant Debugger makes plant care as easy as debugging, with terminal-style UX and plant concepts explained in programming terms.

## Features

- Terminal-style UX
- Multi-step AI diagnosis: identify plant → initial analysis → targeted questions → final structured diagnosis
- Plant identification from one or more photos (drag & drop, file picker, mobile camera support)
- Practical treatment guidance and next steps
- Responsive layout for mobile and desktop
- Cost tracking summary for Gemini API usage (toggleable)

## Tech Stack

- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: vanilla CSS with a custom terminal theme (see `src/styles`)
- Testing: Jest + React Testing Library
- Image processing: `browser-image-compression`
- Code quality: ESLint + Prettier, TypeScript type checks

## Getting Started

### Prerequisites

- Node.js 18.17+ (<= 20.x)
- npm

### Installation

1) Clone the repository

```powershell
git clone https://github.com/mkobak/plant-debugger.git
cd plant-debugger
```

2) Install dependencies

```powershell
npm install
```

3) Configure environment variables

- Copy the example file and edit values:

```powershell
Copy-Item .env.local.example .env.local
```

Required:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Optional (debug/logging toggles):

```
PB_DEBUG_VERBOSE=0                      # set to 1/true to print prompts/responses
NEXT_PUBLIC_PB_DEBUG_VERBOSE=0          # client-side verbose logging
NEXT_PUBLIC_ENABLE_CLIENT_COST_LOGS=1   # log cost summaries in the browser
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4) Start the dev server

```powershell
npm run dev
```

Then open http://localhost:3000

## Project Structure

```
.
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (routes)/
│   │   │   ├── upload/           # Image upload step
│   │   │   ├── questions/        # Diagnostic questions step
│   │   │   └── results/          # Results + recommendations
│   │   ├── api/                  # Route handlers (AI pipeline)
│   │   │   ├── identify-plant/
│   │   │   ├── initial-diagnosis/
│   │   │   ├── generate-questions/
│   │   │   ├── final-diagnosis/
│   │   │   ├── no-plant-response/
│   │   │   └── reset-costs/
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Home page
│   ├── components/
│   │   ├── layout/               # Layout + header
│   │   └── ui/                   # Buttons, modals, upload, loaders, etc.
│   ├── context/                  # React context providers
│   ├── hooks/                    # Custom React hooks
│   ├── lib/
│   │   ├── api/                  # Gemini client, prompts, pricing, retries, logging
│   │   ├── constants.ts          # Upload limits, MIME types, etc.
│   │   ├── costTracker.ts        # Client-side cost tracking summary
│   │   └── typingSession.ts      # Typing effects
│   ├── styles/                   # Global CSS (terminal theme)
│   ├── types/                    # Shared TypeScript types
│   └── utils/                    # Helpers (circuit breaker, formatters)
├── public/
│   └── images/                   # ASCII SVG assets
├── scripts/                      # Utility scripts (ASCII generation)
├── __mocks__/next/navigation.ts  # Next.js navigation mock for tests
├── jest.config.js, jest.setup.js # Testing config
└── vercel.json                   # Deployment config (optional)
```

## Available Scripts

- `dev` — Start development server
- `build` — Build for production
- `start` — Start production server
- `lint` — Run ESLint
- `typecheck` — TypeScript type checks
- `format` — Prettier write
- `format:check` — Prettier check
- `test` — Run Jest tests
- `test:watch` — Jest watch mode
- `test:coverage` — Jest with coverage
- `generate-svgs` — Generate ASCII SVGs under `public/images`
- `update-ascii` — Sync ASCII from constants and regenerate SVGs

## Notes and Tips

- Gemini models are configured in `src/lib/api/modelConfig.ts`.
- Required env: `GEMINI_API_KEY`. Optional toggles control verbose logging and client cost logs.
- Image upload supports drag & drop and mobile camera capture.
- Tests live in `src/__tests__` and run with Jest + jsdom.

