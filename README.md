# FILEFLOW — High-Performance File Conversion & Compression Platform

FILEFLOW is a full-stack file processing platform engineered with **React + TypeScript + Vite** on the frontend, and **Node.js + Express + Sharp + pdf-lib** on the backend. It offers real server-side image format transformation, intelligent multi-level compression, PDF merging, and page-range splitting with high-speed download workflows and zero third-party telemetry.

---

## Key Features

1. **Intelligent Image Conversion & Compression**:
   - Supported input formats: **JPG / JPEG, PNG, WebP**.
   - Target conversions: Convert to **WebP, PNG, or JPG** on the fly.
   - Dynamic quality compression slider (1% – 100%) with instant preset buttons:
     - **Maximum Quality (90%)**: Crisp fidelity with clean visual clarity.
     - **Balanced (75%)**: Recommended sweet spot saving 50–70% bandwidth.
     - **High Compression (50%)**: Ultra-compact footprint for web optimization.
   - Live before-and-after byte measurement with exact percentage savings (`-74.2%`).
   - Dimension metadata inspection (Width × Height).

2. **Advanced PDF Merging**:
   - Upload multiple PDF documents.
   - Interactive reordering (move up, move down) to sequence pages with precision.
   - Aggregates page counts and produces a unified, clean document.

3. **PDF Page Splitting**:
   - Upload any multi-page PDF.
   - Real-time page count inspection.
   - Split by single pages (e.g., `2`), ranges (e.g., `1-3`), discrete groupings (e.g., `1-2, 4-5`), or all pages (`all`).
   - Generates single extracted PDFs or zipped page bundles.

4. **Batch Processing & Quick Bundling**:
   - Process multiple images simultaneously.
   - One-click **Download All as ZIP** or individual file downloads.

5. **Local Session History**:
   - Automatically tracks processed files during your session.
   - Re-download any converted asset with one click.
   - One-click "Clear All" to purge temporary storage.

6. **Enterprise Security & Privacy**:
   - Ephemeral server-side storage with UUID-based safe tokens.
   - Server file paths are never exposed to the client.
   - Automatic background garbage collection sweeps files older than 60 minutes.
   - File size validation capped at 50MB per file with magic-byte inspection.

---

## Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons.
- **Backend**: Node.js, Express, Multer (in-memory buffer streaming).
- **Image Engine**: [Sharp](https://sharp.pixelplumbing.com/) (high-speed libvips wrapper).
- **PDF Engine**: [pdf-lib](https://pdf-lib.js.org/) (pure vector & page stream manipulation) + JSZip.
- **Testing**: Node.js native test runner (`node --test`).

---

## Getting Started

### Prerequisites
- Node.js 20+ installed.
- npm 10+ installed.

### Installation
```bash
# Clone the repository
git clone <repository_url>
cd fileflow

# Install dependencies
npm install
```

### Development
```bash
# Start full-stack server (Express + Vite on port 3000)
npm run dev
```
Open your browser at `http://localhost:3000`.

### Running Tests
```bash
npm test
```

### Production Build
```bash
# Build the production Vite bundle
npm run build

# Start the full-stack server in production mode
npm start
```

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/convert-compress` | Upload image files with `targetFormat` and `quality` parameters. |
| `POST` | `/api/pdf/merge` | Upload $\ge 2$ PDF files to merge into a single PDF. |
| `POST` | `/api/pdf/split` | Upload a PDF with `ranges` string (`"1-3"`, `"2, 4-5"`, or `"all"`). |
| `POST` | `/api/pdf/info` | Inspect page count and metadata of a PDF file. |
| `GET` | `/api/download/:fileId` | Securely download a processed file by temporary token. |
| `POST` | `/api/batch-download` | Download multiple processed files as a compressed ZIP. |
| `GET` | `/api/history` | Retrieve currently available processed files in session. |
| `POST` | `/api/clear-all` | Purge all temporary storage files immediately. |
| `GET` | `/api/sample-files/:type` | Generate test JPG or multi-page PDF files on the fly. |
| `GET` | `/api/health` | Service health status. |

---

## License
Apache-2.0
