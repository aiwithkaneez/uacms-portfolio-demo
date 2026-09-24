## Frontend Setup

### 1. Prerequisites

Before setting up the frontend, ensure the following are installed on your system:

- **Node.js**: version 18.x or later (LTS recommended)
- **npm**: version 9.x or later (bundled with Node.js 18+)

You can verify your installed versions with:

```bash
node -v
npm -v
```

### 2. Installation

Clone the repository and install the frontend dependencies:

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the frontend project folder
cd uacms-app

# Install dependencies
npm install
```

### 3. Environment Variables

The frontend uses [Vite](https://vitejs.dev/) environment variables to configure the API base URL. Create a `.env` file in the project root (you can copy `.env.example` as a starting point):

```bash
cp .env.example .env
```

| Variable              | Required | Description                                                                 |
|------------------------|:--------:|-------------------------------------------------------------------------------|
| `VITE_API_BASE_URL`    | Yes      | Base URL of the backend API the frontend communicates with (e.g. login, complaints, users). If not set, the app falls back to `http://127.0.0.1:8000`. |

**Example `.env` file:**

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

> **Note:** Any variable consumed by the frontend must be prefixed with `VITE_` to be exposed to the client by Vite. After changing `.env`, restart the dev server for the change to take effect.

### 4. Running the Development Server

Start the local development server with hot module reloading:

```bash
npm run dev
```

This project's `vite.config.js` pins the dev server to port `5174`, so it's served at `http://localhost:5174`.

### 5. Building for Production

To generate an optimized production build:

```bash
npm run build
```

The output is written to the `dist/` directory.

### 6. Previewing the Production Build

To locally preview the production build (serves the contents of `dist/`):

```bash
npm run preview
```

### 7. Project Structure (brief)

```
uacms-app/
├── src/
│   ├── api/            # Axios client and API-related config
│   ├── components/     # Reusable UI components
│   ├── pages/           # Route-level page components
│   ├── utils/           # Formatting and helper utilities
│   └── main.jsx         # App entry point
├── .env.example           # Example environment variable file
├── package.json
└── vite.config.js
```

### 8. Troubleshooting

**Port already in use**
If port `5174` (this project's configured port) is already occupied, Vite will automatically try the next available port and print it in the terminal. You can also specify a different port manually:

```bash
npm run dev -- --port=5175
```

**Backend not reachable**
If API requests fail (e.g. login doesn't work, requests hang, or you see network errors in the browser console), verify:
- The backend server is running and reachable at the URL set in `VITE_API_BASE_URL`.
- The value in `.env` matches your backend's actual host and port.
- There are no CORS restrictions blocking requests from the frontend origin.

**Missing environment variables**
If `.env` is missing entirely, the app silently falls back to `http://127.0.0.1:8000` for the API base URL. If your backend runs elsewhere, this mismatch will cause every API call — including login — to fail. Confirm `.env` exists in the project root and contains `VITE_API_BASE_URL`, then restart `npm run dev`.

**npm install issues**
- Delete `node_modules` and `package-lock.json`, then reinstall:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```
- Confirm your Node.js version meets the minimum requirement (18.x+).
- If installs hang or fail on a corporate network, check for proxy/registry settings (`npm config get registry`).