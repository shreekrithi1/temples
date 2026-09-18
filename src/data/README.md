# Local temple catalog

The application reads `temples.json` through `/api/temples`; it does not require PostgreSQL or make research API requests when a visitor opens a temple. `featured-temples.json` supplies the first twenty records immediately while the complete catalog loads.

You.com was used for source discovery and featured-temple research. The actual search queries and selected result URLs are preserved in `research-sources.json` and `you-featured-research.json`. The bulk structured data is from Wikidata's **Hindu temple (Q842402)** class and its subclasses, plus the original curated featured temples. This replaces the earlier general-temple export, which included churches and other unrelated places.

Each record stores a stable identifier, coordinates, name, country, locality, deity group, original presiding-deity value, architecture, heritage, description, source links, retrieval date, and optional photo metadata. Some classified Hindu sites also have Buddhist or other historical associations. The catalog is not a claim to include every Hindu temple in the world.

Descriptions are Wikipedia introductions (CC BY-SA 4.0), Wikidata descriptions (CC0), or clearly identified editorial summaries. Their source and license are retained per record and linked in the detail panel. Photos are Wikimedia Commons files with their own contributor, license, and source-page attribution. Missing images or facts are explicitly marked rather than invented. The import report in `catalog-meta.json` includes unavailable/rate-limited requests.

The first 40 available catalog photographs can be cached under `public/temple-images`; the remainder use the photo URL stored in JSON. Thus temple information works from local files, while uncached photos still require Internet access.

## Refresh

From `apps/web`:

```sh
# Store YOU_API_KEY in the ignored apps/web/.env.local (server-side only).
# Optional single-query source discovery.
npm run data:search -- 'Hindu temples worldwide India temple list Wikipedia'

# Download the classified Wikidata set and enrich linked Wikipedia/Commons records.
npm run data:import
npm run data:featured

# Expand the catalog through 115 You.com country/state searches.
npm run data:world

# Cache featured photos and check dataset integrity.
npm run data:images
npm run data:validate
```

`data:search` stores its results separately as `you-search-results.json`; search snippets are not automatically treated as verified temple records. The importer caches successful public API responses in the ignored `.temple-cache/` folder. Use `--refresh` only when intentionally refreshing those responses. It can also import an existing Wikidata SPARQL response using `--source /path/to/results.json`.

After updating source data, restart/rebuild the application to ship the new JSON. No API key is sent to the browser or stored in these JSON files.

## Worldwide discovery

`data:world` runs You.com searches across 81 countries/territories and 34 Indian states/territories, saves the source results in `you-world-research.json`, and expands discovered Wikipedia temple lists. It only adds articles with an explicit Hindu temple identity and valid primary coordinates. Wikidata identifiers deduplicate existing records; country names come from Wikidata, and available photographs retain Commons attribution. Unverified candidates and request failures are saved in `you-world-pending.json` for further research. These searches broaden coverage; they do not constitute an exhaustive census of every temple.

Successful requests are cached locally, allowing interrupted runs to resume without repeating successful searches. Run `npm run data:world -- --refresh` to explicitly refetch. Run worldwide discovery after the bulk importer when rebuilding the catalog. Search credentials are read only from `YOU_API_KEY`; never prefix this variable with `NEXT_PUBLIC_`.

## Budgeted settlement research

The collection budget is **USD 30 total**: the original USD 20 plus an explicitly authorized USD 10 extension. The ledger retains both authorization entries and all previous attempts. `you-settlement-plan.json` contains 6,000 geographically distributed queries drawn from the GeoNames cities500 index (CC BY 4.0). This index includes places above 500 population and administrative seats; it is not an inventory of every village. The initial queue covered continents, countries/territories, 2,000 Indian settlements, and 1,740 other settlements. The extension adds 1,000 previously unsearched Indian settlements and 1,000 international settlements across countries with Hindu communities.

`npm run data:crawl` reads `YOU_API_KEY` from `.env.local`. A persistent `you-settlement-budget.json` reserves each attempted request before sending it. Retries count toward the same 6,000-attempt lifetime ceiling at the documented base price of $0.005/call, with no extraction add-ons. The ledger is an upper-bound estimate, not an account invoice. **Do not delete or reset this ledger to resume**; cached successful queries are reused. A process lock prevents concurrent crawlers sharing the budget.

The full search results are stored in `you-settlement-research.json`. `python3 scripts/index-temple-research.py` produces `temple-research-candidates.json` (deduplicated source pages, not temple identities) and `worldwide-collection-report.json` with coverage and budget totals. `python3 scripts/export-you-research.py` can rebuild the JSON archive from cached responses without spending API credits. They are research leads, not verified temple records. `npm run data:verify-crawl` adds only eligible coordinate-verified articles to the app catalog and stores review candidates and failed requests separately. It does not spend additional You.com credits. Wikimedia requests are paced; uncached requests to a rate-limited host are deferred to a later run.

The large settlement research archive and candidate-page index are stored locally and ignored by Git. The app catalog, provenance metadata, search plan, and budget report remain separate. None of the raw research archive is sent to browser visitors.

## Expanded coordinate-backed map

The atlas now also includes OpenStreetMap records explicitly tagged `amenity=place_of_worship` and `religion=hindu`. These are community-mapped worship sites, including shrines and unnamed places; they are not an independently verified census of unique physical temples. OSM data is attributed under ODbL 1.0, with per-record source links and visible map attribution. Ways and relations use their bounding-box center, identified as approximate in the detail view. Country names may be inferred from Natural Earth polygons; missing labels are left blank.

The current bulk response returned valid records but included a timeout remark, so `osm-import-report.json` records partial coverage. Importing retained records deduplicates OSM identities, linked Wikidata identities, and closely located exact-name matches. Photos and historical details are not invented for basic map records.

Run `python3 scripts/map-research-candidates.py` to verify saved Wikipedia leads using lightweight coordinate requests, and `python3 scripts/import-osm-temples.py` to merge cached public map extracts. Neither uses paid You.com calls. The API reads the current catalog file directly; reload the page or return focus to it after an import. Cluster counts expand into individual clickable markers when zoomed in.

## September 2026 expansion

`source-expansion-report.json` records the before/after catalog totals and reviewed sources. Regional OpenStreetMap extracts recover gaps in the earlier timed-out global response. `osm-import-report.json` distinguishes failed regions from successful empty results. Run `python3 scripts/fetch-osm-temples.py --retry-failed` to resume failed bands; successful regions are cached. HTTP 429/406 responses receive a 30-second backoff. An explicit `--endpoint` can select another public Overpass instance.

The additional You.com authorization is a maximum API usage budget, not a purchase of account credits. `scripts/extend-settlement-plan.py` only extends the queue; it does not authorize spending or reset the ledger. Raw search pages are research leads and never count as mapped temple records until identity and coordinates are resolved. Simulated datasets and sources with unverified reuse terms are excluded.

This expansion added **36 mapped records** (31 Wikipedia/Wikidata-backed and five OpenStreetMap features), taking the catalog from **58,989 to 59,025**. The 1,998 additional reserved You.com requests have an estimated cost of **USD 9.99**, for **USD 29.99** across the two authorized batches. There are **31,323 candidate source pages**; these are not extra mapped temples.
