# Photo Verification System

A system for verifying elevation data in databases using photographs of mountains and landscapes.

## Overview

This system allows you to:
1. Process photographs of mountains to detect the skyline
2. Extract elevation profiles from photos
3. Compare photo-derived elevation profiles with database data
4. Visualize and analyze the differences

## Installation

1. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage

```python
from photo_processor import PhotoProcessor
from data_verifier import DataVerifier
from visualization import Visualization

# Process photo
processor = PhotoProcessor('mountain_photo.jpg')
skyline = processor.detect_skyline()
photo_profile = processor.get_elevation_profile(
    camera_position=(35.0844, -106.6504),  # Example: Albuquerque
    camera_direction=45,  # degrees from north
    camera_height=1.7  # meters
)

# Verify data
verifier = DataVerifier()
db_profile = verifier.get_elevation_data(
    camera_position=(35.0844, -106.6504),
    direction=45,
    fov=60.0
)

# Compare profiles
results = verifier.compare_profiles(photo_profile, db_profile)

# Visualize results
viz = Visualization()
viz.plot_comparison(photo_profile, db_profile, results['error_distribution'], 'comparison.png')
viz.create_overlay(processor.image, skyline, results['error_distribution'], 'overlay.png')
viz.create_summary_report(results, 'report.txt')
```

### Required Information

To use the system, you need:
1. A photograph of a mountain/landscape
2. Camera position (latitude, longitude)
3. Camera direction (degrees from north)
4. Optional: Camera height above ground
5. Optional: Camera field of view (FOV)

## Project Structure

```
photo_verification/
├── src/
│   ├── photo_processor.py    # Photo analysis
│   ├── data_verifier.py      # Database comparison
│   └── visualization.py      # Results display
├── tests/
│   └── test_verification.py  # Unit tests
├── docs/
│   └── photo_verification.md # Documentation
├── requirements.txt          # Dependencies
└── README.md                # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 