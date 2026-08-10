# Three.js Scroll Journey

Build a scroll-driven 3D narrative page using Three.js — the kind of piece that wins Awwwards Site of the Day, not a tutorial demo.

The page tells a story in **four distinct scenes** as the user scrolls through roughly 5–6 viewport heights. The 3D scene is persistent and continuous: one WebGL canvas that transforms as the user scrolls. Do not cut between separate scenes — morph, travel, or transition between them so the whole page feels like one continuous camera move.

## Requirements

- **Scroll is the only timeline.** Camera position, camera target, object state, materials, and lighting are all driven by a normalised scroll progress value. Scrolling back up must run everything perfectly in reverse — no one-way triggers, no state that cannot be undone.
- **Smoothed, not snapped.** Interpolate scroll progress with damping/lerp so motion feels weighted, and make it frame-rate independent using delta time rather than assuming 60fps.
- **Real 3D substance.** At minimum: custom geometry (procedural or mathematically generated — not just primitives sitting in a row), at least one custom `ShaderMaterial` with your own GLSL, meaningful lighting, and depth. Post-processing is welcome if you can do it without breaking the single-file rule.
- **Typography over 3D.** HTML text overlays that enter, hold, and exit in sync with the scroll timeline. The type should be as considered as the 3D — this is a designed page, not a canvas with captions.
- **Correctness.** Handle resize and device pixel ratio properly. Clamp DPR so it does not melt a retina display. Dispose or reuse geometries and materials rather than allocating per frame.
- **Performance.** Must hold a smooth frame rate at 1440×900. Budget your draw calls.
- **A landing state.** The first viewport should read as a deliberate opening frame — it is the first thing the judge sees before scrolling.

## What is being evaluated

Whether the scroll choreography feels authored rather than mechanical, whether the GLSL is real, and whether the page holds together as a single designed artefact. A technically correct page with no point of view scores poorly. So does a beautiful still frame whose scroll behaviour is a linear camera dolly.

You choose the subject and the story. Make it something you would be proud to sign.
