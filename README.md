# New Mexico Elevation Data Collector

A Node.js application that collects hierarchical elevation data for New Mexico using multiple elevation data APIs.

## Features

- Hierarchical grid-based collection:
  - Level 1: 10x10 grid (100 points)
  - Level 2: Each L1 cell → 10x10 grid (1,000 points)
  - Level 3: Each L2 cell → 10x10 grid (10,000 points)

- Multiple API Support:
  - SRTM30m (OpenTopoData)
  - ASTER30m (OpenTopoData)
  - Open-Meteo Elevation
  - Open-Elevation

- Smart API Management:
  - Round-robin API cycling
  - API-specific batch sizes
  - Rate limit handling with exponential backoff
  - Automatic fallback on API failures

- Progress Tracking:
  - SQLite database for storing elevation data
  - Progress logging with timestamps
  - Error logging with full stack traces

## Installation

1. Clone the repository:
```bash
git clone https://github.com/wgmilleriii/nm_elevation.git
cd nm_elevation
```

2. Install dependencies:
```bash
npm install
```

## Usage

Run the script:
```bash
node collect_sparse_points.js
```

The script will:
1. Create a SQLite database (`mountains.db`)
2. Start collecting elevation data in a hierarchical grid pattern
3. Log progress to `collection_progress.log`
4. Log errors to `collection_errors.log` 