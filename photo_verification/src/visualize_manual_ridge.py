import cv2
import numpy as np
import os

def load_ridge_points(points_file):
    """Load ridge points from file."""
    points = []
    with open(points_file, 'r') as f:
        for line in f:
            if line.strip():
                x, y = map(int, line.strip().split(','))
                points.append((x, y))
    return points

def visualize_manual_ridge(image_path, points_file, output_path):
    """Visualize the manually selected ridge line on the original image."""
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Failed to load image: {image_path}")
    
    # Load points
    points = load_ridge_points(points_file)
    if not points:
        raise ValueError("No points found in file")
    
    # Sort points by x-coordinate to ensure proper line connection
    points = sorted(points, key=lambda p: p[0])
    
    # Draw points as circles
    for point in points:
        cv2.circle(image, point, 5, (0, 0, 255), -1)  # Red circles
    
    # Draw connecting lines
    for i in range(len(points) - 1):
        cv2.line(image, points[i], points[i + 1], (0, 255, 0), 3)  # Green line
    
    # Add text overlay
    cv2.putText(image, f"Manual Ridge Selection ({len(points)} points)", 
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    
    # Save result
    cv2.imwrite(output_path, image)
    print(f"Manual ridge visualization saved to: {output_path}")
    
    return image, points

def main():
    # Get workspace root directory
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    
    # Paths
    image_path = os.path.join(workspace_root, "data/images/20231024_085412.jpg")
    points_file = "selected_ridge_points.txt"
    output_path = os.path.join(workspace_root, "data/images/manual_ridge_visualization.jpg")
    
    # Create visualization
    try:
        image, points = visualize_manual_ridge(image_path, points_file, output_path)
        
        print(f"\nLoaded {len(points)} ridge points:")
        for i, (x, y) in enumerate(points, 1):
            print(f"  Point {i}: ({x}, {y})")
        
        print(f"\nVisualization created with:")
        print(f"  - Red circles marking your selected points")
        print(f"  - Green line connecting the points")
        print(f"  - Saved to: {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main() 