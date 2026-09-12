# Agent Guide

## Project Shape

- This is a dependency-free HTML5 Canvas game; there is no package manifest, bundler, build step, or automated test suite.
- `index.html` provides the fixed `800x600` canvas and loads `game.js`; the game state, entities, input handlers, update loop, and rendering all live in `game.js`.
- Keep browser globals and the classic-script loading order intact: `game.js` expects `#canvas` to already exist.

## Run And Verify

- Launch from the repository root with `npx serve .`, then open `http://localhost:3000`; opening `index.html` directly also works.
- Verify changes manually in a browser: the canvas renders, arrow-key movement/thrust works, Space fires, asteroids split and wrap at edges, lives/game-over behavior works, and Space restarts after game over.
- There are no repository-defined lint, format, typecheck, build, or test commands to run.

## Change Boundaries

- Preserve the existing plain JavaScript and inline CSS approach unless a task explicitly requires introducing tooling or dependencies.
- If changing the canvas dimensions or element ID in `index.html`, update the matching constants and lookup in `game.js`.
