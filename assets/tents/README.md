# Tent images

Drop the three JELUCAMP tent photos here, named exactly:

- `tent-blue.jpg`
- `tent-orange.jpg`
- `tent-green.jpg`

They are shown in the **Camping Tent Rental** page (Tours ▸ Camping Tent Rental),
in Section 2 · Equipment, each with a soft floating shadow.

`build.js` copies this `assets/` folder into `public/assets/` on deploy, so the
page references them at `/assets/tents/tent-*.jpg`. Until the files are added,
the images hide themselves automatically (no broken-image icons).

A square-ish photo on a white/transparent background looks best with the
floating ground shadow.
