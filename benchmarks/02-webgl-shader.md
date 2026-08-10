# Custom WebGL Shader — Open

Write the coolest WebGL fragment shader you can think of, and give it a page worthy of it.

There is no prescribed subject, technique, or style. Raymarched SDF scene, fluid or reaction-diffusion simulation, volumetric clouds, caustics, a particle system driven by curl noise, path-traced glass, a generative landscape, something nobody has a name for — your call. Pick the thing you actually find beautiful and go as far as you can.

## Constraints

- The visual must be produced **by the shader**. The GPU does the work. Do not fake it with CSS, SVG filters, canvas 2D, or a video.
- Write the GLSL yourself. No copy of a well-known ShaderToy piece passed off as new.
- It must be **alive**: animated over time, and responsive to the pointer in a way that is meaningfully part of the piece rather than a bolted-on mouse-follow.
- It must hold a smooth frame rate at 1440×900 on integrated graphics. If your technique is expensive, adapt — resolution scaling, reduced step counts, early exits — rather than shipping something that stutters.
- Handle resize and device pixel ratio correctly, and clamp DPR.
- Fail gracefully: if WebGL is unavailable, show something considered rather than a blank page or an exception.
- Raw WebGL or a thin CDN wrapper (three.js, ogl, twgl, regl) are all fine. The shader is the point, not the plumbing.

## Presentation

Give it a frame. A title treatment, or a caption, or nothing at all if nothing is the right answer — but decide deliberately. If you expose controls, make them part of the design rather than a debug panel bolted to the corner.

## What is being evaluated

Ambition and beauty first; correctness of the technique second. A simple idea executed with total control beats an ambitious idea that renders as noise. Judges will read your GLSL, so the maths should hold up — and they have seen the standard raymarched-sphere-on-a-checkerboard a thousand times.

Surprise us.
