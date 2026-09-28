# Image credits

## Repair photos (`public/images/repairs/`)

All five are from Wikimedia Commons and were chosen because the file
description matches the fault the category describes.

| File | Subject | Author | Licence |
| --- | --- | --- | --- |
| `repair-aircon-leaking.jpg` | Water dripping from an air conditioning unit | Shixart1985 | CC BY 2.0 |
| `repair-water-heater.jpg` | Water Heater Leak | Tony Webster | CC BY 2.0 |
| `repair-plumbing.jpg` | Leaking PVC pipe under sink, P-trap | Tony Webster | CC BY 2.0 |
| `repair-electrical.jpg` | Wall circuit breaker and wiring | Paul The Writer | CC0 |
| `repair-window.jpg` | Window latch | darkday | CC BY 2.0 |

Source pages are on `commons.wikimedia.org` under the same file names.
The CC BY 2.0 images require attribution: keep this file with the assets, or
add a credits line in the app, if this ships.

## Avatars (`public/images/avatars/`)

Illustrated avatars from the `alohe/avatars` set, fetched through jsDelivr.
The licence for that set has not been confirmed here — check the upstream
repository before shipping this commercially.

## Why some categories have no photo

`other` deliberately has no entry in `lib/images.ts`. A ticket in that
category falls back to the plain `IMG_nnnn` reference tile, because showing a
confidently wrong photo is worse than showing no photo.
