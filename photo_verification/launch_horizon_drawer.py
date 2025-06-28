#!/usr/bin/env python3
"""
Launcher script for the Horizon Line Drawing Tool
"""

import os
import sys

# Add the src directory to the Python path
src_dir = os.path.join(os.path.dirname(__file__), 'src')
sys.path.insert(0, src_dir)

# Import and run the horizon line drawer
from horizon_line_drawer import HorizonLineDrawer

def main():
    """Launch the horizon line drawing tool."""
    print("🎨 Launching Horizon Line Drawing Tool...")
    print("📸 Default image: corrales.png")
    print("🖱️  Click and drag to draw red horizon lines")
    print("🔧 Use buttons to clear, save, or load horizon data")
    print()
    
    # Check if an image path was provided as command line argument
    image_path = None
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        if not os.path.exists(image_path):
            print(f"❌ Error: Image file not found: {image_path}")
            return
        print(f"📂 Loading image: {image_path}")
    
    # Create and run the tool
    try:
        tool = HorizonLineDrawer(image_path)
        tool.run()
    except Exception as e:
        print(f"❌ Error launching tool: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 