# GitHub Pages Demo

This directory contains the demo page for the SMART Web Messaging SDK.

## Setup Instructions

1. **Enable GitHub Pages** in your repository settings:
   - Go to Settings > Pages
   - Source: GitHub Actions
   - The workflow will automatically deploy on pushes to main/master

2. **Manual Build** (for development):
   ```bash
   npm run build:docs
   ```

3. **Access the Demo**:
   - After deployment, visit: `https://[username].github.io/[repository-name]/`
   - Example: `https://tiro-health.github.io/smart-web-messaging/`

## Files

- `index.html` - Interactive demo page
- `dist/` - Built CommonJS library files (auto-generated)
- `.github/workflows/deploy-pages.yml` - GitHub Actions workflow

The demo page provides:
- Connection management interface
- Message sending capabilities  
- Handler registration examples
- Real-time console logging