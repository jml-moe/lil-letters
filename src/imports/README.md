# FeralUI Crumple — extracted visual assets

These files were reconstructed from the captured network HAR and the FeralUI JavaScript/CSS bundle supplied in this conversation.

## Visual assets
- `paper-ball.svg` — standalone SVG recreation of the paper ball, including gradients, grain, crease paths and shadow.
- `basket.svg` — standalone SVG recreation of the basket back/cavity and front mesh/steel layers.
- `paper-sheet.svg` — standalone static SVG approximation of the paper sheet visual. The original sheet is DOM/CSS and uses animated CSS `clip-path` polygons rather than an SVG asset.
- `paper-crumple.mp3` — original network asset already extracted from the HAR.

## Geometry
- `paper-ball-geometry.json` — exact source path/polygon/crease data recovered from the bundle.
- `basket-geometry.json` — exact source basket path data recovered from the bundle.

The SVGs preserve the source geometry and visual parameters where the original implementation exposes them directly. Animation/interaction logic is not included in these standalone visual assets.
