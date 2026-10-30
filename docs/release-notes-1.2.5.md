# Tessra 1.2.5

## A demo that plays on its own

The README and Marketplace page now open with a looping animated demo recorded in VS Code. It plays without a click on the Marketplace, in VS Code's extension page, and on GitHub. Select it, or the "Watch the full demo with sound" link, to open the full 44-second video with sound, which also sits at the top of the Screenshots section.

1.2.4 tried to autoplay the video itself, but the Marketplace removes the `muted` attribute from `<video>`, and browsers only autoplay muted media.

No extension code changes.
