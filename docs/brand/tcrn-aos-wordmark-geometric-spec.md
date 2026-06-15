# TCRN AOS Geometric Wordmark

Selected option: `03 / Geometric Product`.

Use this wordmark for the AOS product shell and dark navigation surfaces. It keeps `TCRN` as the reusable platform brand mark while giving `AOS` a more distinctive product identity.

## CSS Reference

```css
.brand-lockup {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.brand-tcrn {
  font-family: Futura, "Avenir Next", "Helvetica Neue", Arial, sans-serif;
  font-size: 29px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: 0.17em;
  color: #f7fbff;
}

.brand-aos {
  display: inline-block;
  font-family: Futura, "Avenir Next", "Helvetica Neue", Arial, sans-serif;
  font-size: 32px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: -0.035em;
  color: transparent;
  background: linear-gradient(135deg, #18d7c8 6%, #08a99d 56%, #15c4b5 100%);
  -webkit-background-clip: text;
  background-clip: text;
  transform: skewX(-5deg);
}
```

## Reuse Notes

- Preserve the selected typography relationship: airy geometric `TCRN`, heavier slanted `AOS`.
- Do not stretch or widen the gap between `TCRN` and `AOS`; the lockup should read as one product mark.
- Use `tcrn-aos-wordmark-geometric-dark.png` for transparent dark-surface placement.
- Use `tcrn-aos-wordmark-geometric-dark-preview.png` for design review and README-style previews.
