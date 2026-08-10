# Playable 3D Game

Build a complete, playable 3D game in a single HTML file.

Not a demo, not a tech showcase — a game. Someone should be able to open it, understand it in five seconds, play it for two minutes, lose or win, and want one more go.

## Requirements

- **Genuinely 3D.** Real 3D space, real camera, real depth. Three.js from CDN is fine, as is raw WebGL if you prefer.
- **A complete loop.** Title/ready state → play → fail or win → score or result → restart without reloading the page. All states reachable, all states leave-able.
- **Real-time input** on keyboard, with the controls stated on screen. Pointer input as well if it suits the design.
- **A reason to keep playing.** Difficulty that escalates, a score to beat, a run that varies — some pressure that makes the second attempt different from the first.
- **Game feel.** Acceleration and easing rather than binary movement, camera that responds to the action, feedback on every meaningful event — hit, near-miss, pickup, death. Juice matters more than polygon count.
- **Collision and state handled correctly.** No tunnelling through geometry at speed, no score that keeps ticking after death, no input that survives a restart.
- **Frame-rate independent.** Delta time everywhere. The game must play the same on a 60Hz and a 144Hz display.
- **Performance.** Smooth at 1280×800. Pool and reuse objects rather than allocating per frame.
- Audio is optional and must be generated with the Web Audio API if present. It must be muted or trivially mutable by default — never autoplay loud.

## What is being evaluated

Whether it is actually fun, whether the loop is complete, and whether the moment-to-moment feel is controlled. A beautiful scene you cannot really play scores badly. A simple mechanic executed with excellent feel scores very well.

Genre, theme, and mechanic are yours. Choose something you can finish properly at this scale rather than something ambitious you can only stub.
