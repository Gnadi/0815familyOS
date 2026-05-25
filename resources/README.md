# App Icons & Splash Screens

This folder holds the master source assets used by `@capacitor/assets` to
generate all platform-specific icon and splash variants.

## Required source files

Place the following files here (they are NOT yet committed — design them first):

| File | Size | Notes |
| --- | --- | --- |
| `icon-only.png` | 1024×1024 | App icon. No transparency, no rounded corners (Apple rounds automatically). Center the logo with ~10% safe-area padding. |
| `icon-foreground.png` | 1024×1024 | Foreground layer for Android adaptive icons. |
| `icon-background.png` | 1024×1024 | Solid background color (e.g. `#3B82F6`) for adaptive icons. |
| `splash.png` | 2732×2732 | Launch screen. Centered logo on solid background; outer ~40% will be cropped on small devices. |
| `splash-dark.png` | 2732×2732 | Dark-mode launch screen (optional but recommended). |

## Generating

After adding the source files and running `npm install`:

```bash
npx capacitor-assets generate --ios
```

This writes the generated icons into `ios/App/App/Assets.xcassets/` and
splash variants into the iOS project automatically.

## Web/PWA icons

The PWA manifest at `public/manifest.json` references:

- `/icons/icon-192.png`
- `/icons/icon-512.png`
- `/icons/icon-maskable-512.png`
- `/icons/apple-touch-icon-180.png`
- `/icons/apple-touch-icon-167.png`
- `/icons/apple-touch-icon-152.png`

Export these from the same `icon-only.png` master and place them in
`public/icons/` before deploying. Any image tool (Figma, Sketch, ImageMagick)
can resize. Example with ImageMagick:

```bash
convert resources/icon-only.png -resize 192x192 public/icons/icon-192.png
convert resources/icon-only.png -resize 512x512 public/icons/icon-512.png
convert resources/icon-only.png -resize 180x180 public/icons/apple-touch-icon-180.png
convert resources/icon-only.png -resize 167x167 public/icons/apple-touch-icon-167.png
convert resources/icon-only.png -resize 152x152 public/icons/apple-touch-icon-152.png
```
