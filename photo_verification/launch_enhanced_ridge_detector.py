#!/usr/bin/env python3
"""
Launcher script for the Enhanced Ridge Detector
"""

import os
import sys

# Add the src directory to the Python path
src_dir = os.path.join(os.path.dirname(__file__), 'src')
sys.path.insert(0, src_dir)

# Import and run the enhanced ridge detector
from enhanced_ridge_detector import EnhancedRidgeDetector

def main():
    """Launch the enhanced ridge detector."""
    print("🏔️  Enhanced Ridge Point Detector")
    print("📂 Smart File Management:")
    print("   • Browse to any JPG - automatically copies to data folder")
    print("   • Browse to data folder - loads existing data")
    print("   • Auto-creates data files for new images")
    print()
    print("📍 GPS & Direction Editing:")
    print("   • Edit GPS coordinates and facing direction")
    print("   • Auto-extract EXIF data when available")
    print("   • Validate coordinate ranges")
    print()
    print("🎯 Point Selection:")
    print("   • Click to select ridge points")
    print("   • Clear All Points button")
    print("   • Undo last point")
    print("   • Auto-save on changes")
    print()
    
    # Create and run the tool
    try:
        detector = EnhancedRidgeDetector()
        detector.run()
    except Exception as e:
        print(f"❌ Error launching detector: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 