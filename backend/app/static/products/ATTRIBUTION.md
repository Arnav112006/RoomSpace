# Product photo sources

These photos are shipped locally so the app makes **no image network requests at
runtime** and the generated concept image is reproducible. All are free to use;
none require attribution, but the sources are recorded here anyway.

Files are named after the `image_url` field in `frontend/src/shared/lib/catalog.ts`
plus `.jpg`. That field used to hold placeholder strings such as `sofa-modern`;
it now doubles as the local image key.

## Unsplash — Unsplash License

License: https://unsplash.com/license

| File key | Source photo |
|---|---|
| `sofa-modern` | https://images.unsplash.com/photo-1555041469-a586c61ea9bc |
| `sofa-scandi` | https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e |
| `sofa-boho` | https://images.unsplash.com/photo-1540574163026-643ea20ade25 |
| `bed-scandi` | https://images.unsplash.com/photo-1505693416388-ac5ce068fe85 |
| `bed-industrial` | https://images.unsplash.com/photo-1505693314120-0d443867891c |
| `bed-traditional` | https://images.unsplash.com/photo-1616594039964-ae9021a400a0 |
| `table-minimal` | https://images.unsplash.com/photo-1533090161767-e6ffed986c88 |
| `table-industrial` | https://images.unsplash.com/photo-1531971589569-0d9370cbe1e5 |
| `table-boho` | https://images.unsplash.com/photo-1499933374294-4584851497cc |
| `chair-modern` | https://images.unsplash.com/photo-1567538096630-e0c55bd6374c |
| `chair-scandi` | https://images.unsplash.com/photo-1598300042247-d088f8ab3a91 |
| `desk-minimal` | https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd |
| `decor-boho` | https://images.unsplash.com/photo-1485955900006-10f4d324d411 |

## Wikimedia Commons — CC0 (public domain dedication)

License: https://creativecommons.org/publicdomain/zero/1.0/

| File key | Source |
|---|---|
| `wardrobe-classic` | https://commons.wikimedia.org/wiki/File:Wardrobe._1820-30,_V%26A_London.jpg |
| `shelf-modern` | https://commons.wikimedia.org/wiki/File:Bookcase_MET_ADA3165.jpg |
| `lamp-modern` | https://commons.wikimedia.org/wiki/File:Floor_Lamp_MET_DT8293.jpg |

All images were resized and cropped to 600×500 JPEG for consistency and size.
Photos whose contents can be recognised by COCO classes were checked with the
project's own YOLOv8n model before being assigned to a category.
