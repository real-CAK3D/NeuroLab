# Credits

The Gen-2 facility dashboard scenery uses these freely licensed pixel-art sources. They are recoloured
to the dashboard's limited Game Boy Color-like palette by `frontend/scripts/build-tiles.py`; the processed
sheets live in `frontend/public/assets/tiles/`. No Nintendo / Pokemon assets are used.

| Source | Author | License | Used for |
| --- | --- | --- | --- |
| [Roguelike Indoors](https://kenney.nl/assets/roguelike-indoors) | Kenney (kenney.nl) | CC0 1.0 | desks / tables, chairs, sinks (`kenney.png`, `sprites/`) |
| [Laboratory tileset (pixelart, 16px)](https://opengameart.org/content/laboratory-tileset-pixelart-16px) | marceles | CC-BY 4.0 | lab shelves, server racks, vats, machines, wall screens, floor tiles (`lab.png`, `lab-floor.png`, `floor-*.png`, `sprites/`) |

## Attribution

- **marceles** - "Laboratory tileset pixelart 16px" (Land of Pixels), https://opengameart.org/content/laboratory-tileset-pixelart-16px,
  licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Only the 16px sheets were used; they were recoloured
  and cropped. License text: `frontend/public/assets/tiles/marceles-LICENSE.txt`.
- **Kenney** - Roguelike Indoors pack is CC0 (public domain); attribution is not required but appreciated. The original
  license is kept at `frontend/public/assets/tiles/Kenney-License.txt`.
- **SpiderDave** - "Flowers" (https://opengameart.org/sites/default/files/plants_2.png, CC0) was evaluated but is not shipped or used.

## Original art

The cannabis plant sprites (`plants.png`, `pot.png`) are generated procedurally by `frontend/scripts/cannabis_sprites.py`
and are not derived from any third-party art.

## Regenerating

```
pip install pillow
python frontend/scripts/build-tiles.py
```

(downloads the two source archives to a temp folder; pass `--raw <dir>` to reuse extracted copies in `<dir>/kenney` and `<dir>/lab`).
