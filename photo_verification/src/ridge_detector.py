import cv2
import numpy as np
import os
from PIL import Image
import matplotlib.pyplot as plt
from matplotlib.widgets import Button
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk

class RidgeDetector:
    def __init__(self, image_path):
        """Initialize the ridge detector with an image path."""
        self.image = cv2.imread(image_path)
        if self.image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        self.height, self.width = self.image.shape[:2]
        self.ridge_points = []
        self.current_method = 0
        self.methods = [
            self._detect_ridge_brightness,
            self._detect_ridge_edges,
            self._detect_ridge_contours,
            self._detect_ridge_gradient,
            self._detect_ridge_adaptive,
            self._detect_ridge_brightness_low,
            self._detect_ridge_brightness_high,
            self._detect_ridge_color_separation,
            self._detect_ridge_hsv_separation,
            self._detect_ridge_combined
        ]
        
    def _detect_ridge_brightness(self, threshold=200):
        """Detect ridge using brightness threshold."""
        gray = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
        ridge = np.zeros(self.width, dtype=np.int32)
        for x in range(self.width):
            column = gray[:, x]
            sky_pixels = np.where(column < threshold)[0]
            if len(sky_pixels) > 0:
                ridge[x] = sky_pixels[0]
        return ridge

    def _detect_ridge_edges(self):
        """Detect ridge using edge detection."""
        gray = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        ridge = np.zeros(self.width, dtype=np.int32)
        for x in range(self.width):
            column = edges[:, x]
            edge_pixels = np.where(column > 0)[0]
            if len(edge_pixels) > 0:
                ridge[x] = edge_pixels[0]
        return ridge

    def _detect_ridge_contours(self):
        """Detect ridge using contour detection."""
        gray = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        ridge = np.zeros(self.width, dtype=np.int32)
        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            for point in largest_contour:
                x, y = point[0]
                if 0 <= x < self.width:
                    ridge[x] = max(ridge[x], y)
        return ridge

    def _detect_ridge_gradient(self):
        """Detect ridge using gradient analysis."""
        gray = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
        gradient = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        ridge = np.zeros(self.width, dtype=np.int32)
        for x in range(self.width):
            column = gradient[:, x]
            max_gradient = np.argmax(np.abs(column))
            ridge[x] = max_gradient
        return ridge

    def _detect_ridge_adaptive(self):
        """Detect ridge using adaptive thresholding."""
        gray = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
        binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                     cv2.THRESH_BINARY, 11, 2)
        ridge = np.zeros(self.width, dtype=np.int32)
        for x in range(self.width):
            column = binary[:, x]
            edge_pixels = np.where(column == 0)[0]
            if len(edge_pixels) > 0:
                ridge[x] = edge_pixels[0]
        return ridge

    def _detect_ridge_brightness_low(self, threshold=150):
        """Detect ridge using low brightness threshold."""
        gray = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
        ridge = np.zeros(self.width, dtype=np.int32)
        for x in range(self.width):
            column = gray[:, x]
            sky_pixels = np.where(column < threshold)[0]
            if len(sky_pixels) > 0:
                ridge[x] = sky_pixels[0]
        return ridge

    def _detect_ridge_brightness_high(self, threshold=250):
        """Detect ridge using high brightness threshold."""
        gray = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
        ridge = np.zeros(self.width, dtype=np.int32)
        for x in range(self.width):
            column = gray[:, x]
            sky_pixels = np.where(column < threshold)[0]
            if len(sky_pixels) > 0:
                ridge[x] = sky_pixels[0]
        return ridge

    def _detect_ridge_color_separation(self):
        """Detect ridge using blue channel (sky is typically blue)."""
        blue_channel = self.image[:, :, 0]  # Blue channel in BGR
        ridge = np.zeros(self.width, dtype=np.int32)
        for x in range(self.width):
            column = blue_channel[:, x]
            # Find where blue values drop significantly (mountain starts)
            threshold = np.mean(column) - np.std(column)
            mountain_pixels = np.where(column < threshold)[0]
            if len(mountain_pixels) > 0:
                ridge[x] = mountain_pixels[0]
        return ridge

    def _detect_ridge_hsv_separation(self):
        """Detect ridge using HSV color space."""
        hsv = cv2.cvtColor(self.image, cv2.COLOR_BGR2HSV)
        saturation = hsv[:, :, 1]
        ridge = np.zeros(self.width, dtype=np.int32)
        for x in range(self.width):
            column = saturation[:, x]
            # Sky typically has lower saturation
            threshold = np.mean(column) + np.std(column) * 0.5
            mountain_pixels = np.where(column > threshold)[0]
            if len(mountain_pixels) > 0:
                ridge[x] = mountain_pixels[0]
        return ridge

    def _detect_ridge_combined(self):
        """Detect ridge using combined methods."""
        # Combine brightness and edge detection
        gray = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        ridge = np.zeros(self.width, dtype=np.int32)
        
        for x in range(self.width):
            # Get brightness-based ridge
            column = gray[:, x]
            sky_pixels = np.where(column < 200)[0]
            brightness_ridge = sky_pixels[0] if len(sky_pixels) > 0 else 0
            
            # Get edge-based ridge
            edge_column = edges[:, x]
            edge_pixels = np.where(edge_column > 0)[0]
            edge_ridge = edge_pixels[0] if len(edge_pixels) > 0 else 0
            
            # Combine both methods (average)
            ridge[x] = int((brightness_ridge + edge_ridge) / 2)
        
        return ridge

    def generate_visualizations(self, output_dir):
        """Generate multiple visualizations of the ridge detection."""
        os.makedirs(output_dir, exist_ok=True)
        
        for i, method in enumerate(self.methods):
            # Get ridge points
            ridge = method()
            
            # Create visualization
            vis = self.image.copy()
            for x in range(self.width):
                cv2.line(vis, (x, ridge[x]), (x, ridge[x]), (0, 255, 0), 1)
            
            # Save visualization
            output_path = os.path.join(output_dir, f'ridge_method_{i+1}.jpg')
            cv2.imwrite(output_path, vis)
            
            # Create binary mask
            mask = np.zeros((self.height, self.width), dtype=np.uint8)
            for x in range(self.width):
                mask[ridge[x]:, x] = 255
            cv2.imwrite(os.path.join(output_dir, f'ridge_mask_{i+1}.jpg'), mask)

class RidgeSelector:
    def __init__(self, image_path, ridge_points):
        self.root = tk.Tk()
        self.root.title("Ridge Point Selector")
        
        # Load image
        self.image = Image.open(image_path)
        self.orig_width, self.orig_height = self.image.size
        self.max_width = 1200
        self.max_height = 800
        self.scale = min(self.max_width / self.orig_width, self.max_height / self.orig_height, 1.0)
        if self.scale < 1.0:
            self.display_image = self.image.resize((int(self.orig_width * self.scale), int(self.orig_height * self.scale)), Image.LANCZOS)
        else:
            self.display_image = self.image
        self.display_width, self.display_height = self.display_image.size
        self.photo = ImageTk.PhotoImage(self.display_image)
        
        # Add buttons at the top
        self.button_frame = ttk.Frame(self.root)
        self.button_frame.pack(pady=5)
        
        ttk.Button(self.button_frame, text="Clear Points", command=self.clear_points).pack(side='left', padx=5)
        ttk.Button(self.button_frame, text="Save Points", command=self.save_points).pack(side='left', padx=5)
        
        # Create canvas
        self.canvas = tk.Canvas(self.root, width=self.display_width, height=self.display_height)
        self.canvas.pack()
        self.canvas.create_image(0, 0, image=self.photo, anchor='nw')
        
        # Bind click event
        self.canvas.bind('<Button-1>', self.on_click)
        
        # Store ridge points
        self.ridge_points = ridge_points
        self.selected_points = []
        
    def on_click(self, event):
        """Handle mouse click events."""
        x_disp, y_disp = event.x, event.y
        # Map display coordinates back to original image coordinates
        x_orig = int(x_disp / self.scale)
        y_orig = int(y_disp / self.scale)
        self.selected_points.append((x_orig, y_orig))
        self.canvas.create_oval(x_disp-2, y_disp-2, x_disp+2, y_disp+2, fill='red')
        
    def clear_points(self):
        """Clear all selected points."""
        self.selected_points = []
        self.canvas.delete('all')
        self.canvas.create_image(0, 0, image=self.photo, anchor='nw')
        
    def save_points(self):
        """Save selected points to file."""
        if self.selected_points:
            with open('selected_ridge_points.txt', 'w') as f:
                for x, y in self.selected_points:
                    f.write(f"{x},{y}\n")
            self.root.quit()
        
    def run(self):
        """Run the selector GUI."""
        self.root.mainloop()

def main():
    # Get workspace root directory
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    image_path = os.path.join(workspace_root, "data/images/20231024_085412.jpg")
    output_dir = os.path.join(workspace_root, "data/images/ridge_detection")
    
    # Create ridge detector
    detector = RidgeDetector(image_path)
    
    # Generate visualizations
    print("Generating ridge detection visualizations...")
    detector.generate_visualizations(output_dir)
    print(f"Visualizations saved to {output_dir}")
    
    # Create and run ridge selector
    print("\nOpening ridge point selector...")
    selector = RidgeSelector(image_path, detector.ridge_points)
    selector.run()

if __name__ == "__main__":
    main() 