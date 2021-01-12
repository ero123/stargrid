# Getting Started Guide

First, run `npm install`. Then `npm start`. Done.

The only files we should be editing are in:
- src/
- dist/index.html
- dist/main.css


### main.js
- starts express server, listens on port
- creates and starts AsteroidsServerEngine
    - contains a AsteroidsGameEngine

### AsteroidsServerEngine.js
- Starts collision tracking
- initializes playerGroups and playerReady
- adds walls and finish line
- sends group update when all players have joined
