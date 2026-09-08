# Project review and changes

## Findings addressed

1. **Unbounded startup dependency:** all three JSON requests had to resolve before anything rendered. The app now renders cached/bundled data first, loads sections independently, bounds requests and body reads, and offers retry.
2. **Old data looked current:** June reports and an expired forecast were presented as “right now” and “next Friday”. Price/report freshness is computed from original timestamps. Stale forecasts, stale cheapest claims and stale savings comparisons are suppressed.
3. **Hardcoded area:** the header, station list and source links assumed Fredericton. Selection, GPS, offline places, online NB search, local filtering and destination-specific links now share a location model.
4. **Fragile collector:** source requests had no timeout; a valid HTTP page with no prices was accepted; history selection favoured row count; partial station scrapes discarded other regions. These paths now validate data, have deadlines and preserve valid prior observations.
5. **Misleading forecast confidence:** the old copy claimed accuracy without backtesting and could extrapolate stale or mismatched input. The forecast is now described as an estimate, and input freshness/baseline checks gate publication.
6. **Phone usability:** the new layout improves the first screen, adds persistent bottom navigation, safe-area spacing, location shortcuts, useful empty states, station favourites/directions and calculation tools. Graphs retain their SVG rendering with additional ranges, statistics and accessible exploration.
7. **Storage and accessibility:** storage failures are isolated, browser zoom is enabled, reduced motion applies to JavaScript animations, inputs have accessible names, and the location dialog uses native modal focus handling.

## Remaining external limitations

- A static site can only show the data last published by its scheduled build. Browser refresh cannot trigger an upstream scrape.
- Fresh station prices depend on the public source and are not guaranteed across every NB location. The UI makes missing/old coverage explicit and offers local searches.
- Location requests require browser permission. The GPS region check is a coarse regional bounds check, not a surveyed NB border polygon. The cap remains explicitly labelled as NB-only.
- The forecasting model is an approximation; further accuracy work needs historical backtesting against actual weekly caps.

## Delivery

Changes are local to this repository and preserve the existing GitHub Pages deployment workflow. No push, production deployment or hosting migration is performed by this review.
