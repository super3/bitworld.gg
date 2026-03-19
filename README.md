# bitworld.gg
[![Frontend](https://img.shields.io/github/actions/workflow/status/super3/bitworld.gg/frontend.yml?branch=main&label=frontend)](https://github.com/super3/bitworld.gg/actions/workflows/frontend.yml)
[![Tests](https://img.shields.io/github/actions/workflow/status/super3/bitworld.gg/test.yml?branch=main&label=tests)](https://github.com/super3/bitworld.gg/actions/workflows/test.yml)
[![Coverage](https://coveralls.io/repos/github/super3/bitworld.gg/badge.svg?branch=main)](https://coveralls.io/github/super3/bitworld.gg?branch=main)

A pixel life simulation where you live, explore, and make friends in a growing city.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the game:
   ```bash
   npm start
   ```

3. Open `http://localhost:8080` in your browser

## Assets

This project uses the [Pixel Spaces - 2D Life-Sim/Room Building Asset Pack](https://netherzapdos.itch.io/pixel-spaces) by Netherzapdos for room building and life simulation assets.

## Deployment

The game automatically deploys to GitHub Pages on push to main branch.

### Setup GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Set source to **GitHub Actions**
3. Your game will be live at: `https://[username].github.io/[repo-name]/`