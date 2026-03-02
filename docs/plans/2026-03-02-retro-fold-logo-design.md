# RetroBoard Logo: "The Retro Fold"

**Date:** 2026-03-02
**Status:** Approved

## Summary

Replace the placeholder `Layers` icon (resembles Databricks logo) with a custom "Retro Fold" mark — a rounded square with a curling fold in the top-right corner. Two-tone: brand red card body, navy fold underside.

## Concept

A rounded rectangle (the retro card/board) with its top-right corner peeling back and curling. The fold represents both:
- **Reflection** — literally turning a page back to look at what's underneath
- **Iteration** — the curl suggests circular motion / continuous improvement

The fold uses a concave inner edge (paper curling) and a convex outer boundary (the cutout curve), creating a crescent/ribbon shape that tapers to a point — evoking an arrow/loop.

## Colors

- **Card body:** `#DD0031` (brand primary red)
- **Fold underside:** `#004F71` (brand secondary navy)

## SVG Structure

Two paths on a 32×32 viewBox:
1. Card body: rounded rect with quadratic-curve cutout in top-right
2. Fold: crescent shape bounded by curved inner edge + curved outer edge

## Usage

| Context | Implementation |
|---------|---------------|
| Favicon | `public/favicon.svg` referenced in `index.html` |
| Header logo | Inline SVG in `Header.tsx`, replacing `Layers` icon |

## Files Changed

- `public/favicon.svg` — New file (logo SVG)
- `index.html` — Update favicon href
- `src/components/Layout/Header.tsx` — Replace Layers icon with inline SVG
