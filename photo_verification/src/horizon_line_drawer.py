#!/usr/bin/env python3
"""
Horizon Line Drawing Tool
Interactive GUI for drawing horizon lines on mountain photographs.
Click and drag to draw a red horizon line, with buttons to clear and save.
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from PIL import Image, ImageTk, ImageDraw
import os
import json
from datetime import datetime
from typing import List, Tuple, Optional

class HorizonLineDrawer:
    def __init__(self, image_path: str = None):
        """Initialize the Horizon Line Drawing Tool."""
        self.root = tk.Tk()
        self.root.title("Horizon Line Drawing Tool")
        self.root.geometry("1400x900")
        
        # Image handling
        self.image_path = image_path
        self.image = None
        self.orig_width = 0
        self.orig_height = 0
        self.display_image = None
        self.photo = None
        self.scale = 1.0
        
        # Display settings
        self.max_width = 1200
        self.max_height = 700
        
        # Horizon line data
        self.horizon_points = []  # List of (x, y) tuples in original image coordinates
        self.display_horizon_points = []  # List of (x, y) tuples in display coordinates
        self.is_drawing = False
        self.last_point = None
        
        # Canvas objects
        self.canvas = None
        self.horizon_line_ids = []  # Track line segment IDs for clearing
        
        # Setup UI
        self.setup_ui()
        
        # Load default image if provided
        if image_path and os.path.exists(image_path):
            self.load_image(image_path)
        else:
            # Load corrales.png by default
            default_path = os.path.join(os.path.dirname(__file__), "..", "data", "images", "corrales.png")
            if os.path.exists(default_path):
                self.load_image(default_path)
    
    def setup_ui(self):
        """Setup the user interface."""
        # Main frame
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Control panel at the top
        control_frame = ttk.Frame(main_frame)
        control_frame.pack(fill='x', pady=(0, 10))
        
        # File operations
        file_frame = ttk.LabelFrame(control_frame, text="File Operations", padding=10)
        file_frame.pack(side='left', fill='x', expand=True, padx=(0, 10))
        
        ttk.Button(file_frame, text="Load Image", command=self.load_image_dialog).pack(side='left', padx=5)
        ttk.Button(file_frame, text="Save Horizon", command=self.save_horizon).pack(side='left', padx=5)
        ttk.Button(file_frame, text="Load Horizon", command=self.load_horizon).pack(side='left', padx=5)
        
        # Horizon operations
        horizon_frame = ttk.LabelFrame(control_frame, text="Horizon Drawing", padding=10)
        horizon_frame.pack(side='right', padx=(10, 0))
        
        ttk.Button(horizon_frame, text="Clear Horizon", command=self.clear_horizon).pack(side='left', padx=5)
        ttk.Button(horizon_frame, text="Undo Last Segment", command=self.undo_last_segment).pack(side='left', padx=5)
        
        # Status bar
        self.status_var = tk.StringVar()
        self.status_var.set("Ready - Load an image to start drawing horizon lines")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief='sunken', anchor='w')
        status_bar.pack(fill='x', pady=(0, 10))
        
        # Canvas frame with scrollbars
        canvas_frame = ttk.Frame(main_frame)
        canvas_frame.pack(fill='both', expand=True)
        
        # Create canvas with scrollbars
        self.canvas = tk.Canvas(canvas_frame, bg='white', cursor='crosshair')
        
        # Scrollbars
        v_scrollbar = ttk.Scrollbar(canvas_frame, orient='vertical', command=self.canvas.yview)
        h_scrollbar = ttk.Scrollbar(canvas_frame, orient='horizontal', command=self.canvas.xview)
        
        self.canvas.configure(yscrollcommand=v_scrollbar.set, xscrollcommand=h_scrollbar.set)
        
        # Pack scrollbars and canvas
        v_scrollbar.pack(side='right', fill='y')
        h_scrollbar.pack(side='bottom', fill='x')
        self.canvas.pack(side='left', fill='both', expand=True)
        
        # Bind mouse events for drawing
        self.canvas.bind('<Button-1>', self.on_mouse_down)
        self.canvas.bind('<B1-Motion>', self.on_mouse_drag)
        self.canvas.bind('<ButtonRelease-1>', self.on_mouse_up)
        
        # Bind keyboard shortcuts
        self.root.bind('<Control-o>', lambda e: self.load_image_dialog())
        self.root.bind('<Control-s>', lambda e: self.save_horizon())
        self.root.bind('<Control-z>', lambda e: self.undo_last_segment())
        self.root.bind('<Delete>', lambda e: self.clear_horizon())
        self.root.bind('<Escape>', lambda e: self.cancel_drawing())
    
    def load_image_dialog(self):
        """Open file dialog to load an image."""
        file_path = filedialog.askopenfilename(
            title="Select Image File",
            filetypes=[
                ("Image files", "*.png *.jpg *.jpeg *.gif *.bmp *.tiff"),
                ("PNG files", "*.png"),
                ("JPEG files", "*.jpg *.jpeg"),
                ("All files", "*.*")
            ]
        )
        
        if file_path:
            self.load_image(file_path)
    
    def load_image(self, image_path: str):
        """Load and display an image."""
        try:
            self.image_path = image_path
            self.image = Image.open(image_path)
            self.orig_width, self.orig_height = self.image.size
            
            # Calculate scale to fit in display area
            self.scale = min(
                self.max_width / self.orig_width,
                self.max_height / self.orig_height,
                1.0
            )
            
            # Resize image for display
            if self.scale < 1.0:
                display_width = int(self.orig_width * self.scale)
                display_height = int(self.orig_height * self.scale)
                self.display_image = self.image.resize((display_width, display_height), Image.LANCZOS)
            else:
                self.display_image = self.image.copy()
            
            # Convert to PhotoImage for tkinter
            self.photo = ImageTk.PhotoImage(self.display_image)
            
            # Update canvas
            self.canvas.delete('all')
            self.canvas.create_image(0, 0, image=self.photo, anchor='nw')
            self.canvas.configure(scrollregion=self.canvas.bbox('all'))
            
            # Clear horizon data
            self.clear_horizon_data()
            
            # Update status
            filename = os.path.basename(image_path)
            self.status_var.set(f"Loaded: {filename} ({self.orig_width}x{self.orig_height}) - Click and drag to draw horizon line")
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load image: {str(e)}")
    
    def on_mouse_down(self, event):
        """Handle mouse button press - start drawing."""
        if not self.image:
            return
        
        self.is_drawing = True
        x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
        self.last_point = (x, y)
        
        # Convert to original image coordinates
        orig_x = int(x / self.scale)
        orig_y = int(y / self.scale)
        
        # Start new horizon segment
        self.horizon_points.append((orig_x, orig_y))
        self.display_horizon_points.append((x, y))
        
        # Draw starting point
        point_id = self.canvas.create_oval(x-2, y-2, x+2, y+2, fill='red', outline='darkred', width=2)
        self.horizon_line_ids.append(point_id)
        
        self.status_var.set(f"Drawing horizon line... Points: {len(self.horizon_points)}")
    
    def on_mouse_drag(self, event):
        """Handle mouse drag - continue drawing line."""
        if not self.is_drawing or not self.last_point:
            return
        
        x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
        
        # Draw line segment from last point to current point
        line_id = self.canvas.create_line(
            self.last_point[0], self.last_point[1], x, y,
            fill='red', width=3, capstyle='round', smooth=True
        )
        self.horizon_line_ids.append(line_id)
        
        # Convert to original image coordinates
        orig_x = int(x / self.scale)
        orig_y = int(y / self.scale)
        
        # Add point to horizon data
        self.horizon_points.append((orig_x, orig_y))
        self.display_horizon_points.append((x, y))
        
        # Update last point
        self.last_point = (x, y)
        
        self.status_var.set(f"Drawing horizon line... Points: {len(self.horizon_points)}")
    
    def on_mouse_up(self, event):
        """Handle mouse button release - finish drawing segment."""
        if self.is_drawing:
            self.is_drawing = False
            self.last_point = None
            
            # Draw end point
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            point_id = self.canvas.create_oval(x-2, y-2, x+2, y+2, fill='red', outline='darkred', width=2)
            self.horizon_line_ids.append(point_id)
            
            self.status_var.set(f"Horizon segment complete. Total points: {len(self.horizon_points)} - Click and drag to add more segments")
    
    def cancel_drawing(self):
        """Cancel current drawing operation."""
        self.is_drawing = False
        self.last_point = None
        self.status_var.set("Drawing cancelled")
    
    def clear_horizon(self):
        """Clear all horizon line data and visual elements."""
        if not self.horizon_points:
            return
        
        # Confirm with user
        if messagebox.askyesno("Clear Horizon", "Are you sure you want to clear the entire horizon line?"):
            self.clear_horizon_data()
            self.redraw_canvas()
            self.status_var.set("Horizon line cleared")
    
    def clear_horizon_data(self):
        """Clear horizon data without confirmation."""
        self.horizon_points = []
        self.display_horizon_points = []
        self.horizon_line_ids = []
        self.is_drawing = False
        self.last_point = None
    
    def undo_last_segment(self):
        """Remove the last drawn segment."""
        if not self.horizon_points:
            return
        
        # Remove last 10 points (approximate segment)
        points_to_remove = min(10, len(self.horizon_points))
        self.horizon_points = self.horizon_points[:-points_to_remove]
        self.display_horizon_points = self.display_horizon_points[:-points_to_remove]
        
        # Redraw canvas
        self.redraw_canvas()
        self.status_var.set(f"Undid last segment. Points remaining: {len(self.horizon_points)}")
    
    def redraw_canvas(self):
        """Redraw the canvas with current horizon line."""
        if not self.image:
            return
        
        # Clear canvas and redraw image
        self.canvas.delete('all')
        self.canvas.create_image(0, 0, image=self.photo, anchor='nw')
        
        # Clear line IDs
        self.horizon_line_ids = []
        
        # Redraw horizon line
        if len(self.display_horizon_points) > 1:
            for i in range(len(self.display_horizon_points) - 1):
                x1, y1 = self.display_horizon_points[i]
                x2, y2 = self.display_horizon_points[i + 1]
                line_id = self.canvas.create_line(
                    x1, y1, x2, y2,
                    fill='red', width=3, capstyle='round', smooth=True
                )
                self.horizon_line_ids.append(line_id)
        
        # Draw points
        for x, y in self.display_horizon_points:
            point_id = self.canvas.create_oval(x-2, y-2, x+2, y+2, fill='red', outline='darkred', width=2)
            self.horizon_line_ids.append(point_id)
    
    def save_horizon(self):
        """Save horizon line data to file."""
        if not self.horizon_points:
            messagebox.showwarning("No Data", "No horizon line to save. Draw a horizon line first.")
            return
        
        if not self.image_path:
            messagebox.showerror("Error", "No image loaded.")
            return
        
        # Generate filename based on image name
        image_name = os.path.splitext(os.path.basename(self.image_path))[0]
        default_filename = f"horizon_{image_name}.json"
        
        file_path = filedialog.asksaveasfilename(
            title="Save Horizon Line",
            defaultextension=".json",
            initialvalue=default_filename,
            filetypes=[
                ("JSON files", "*.json"),
                ("Text files", "*.txt"),
                ("All files", "*.*")
            ]
        )
        
        if not file_path:
            return
        
        try:
            # Prepare data to save
            horizon_data = {
                "image_path": self.image_path,
                "image_name": os.path.basename(self.image_path),
                "image_dimensions": {
                    "width": self.orig_width,
                    "height": self.orig_height
                },
                "horizon_points": self.horizon_points,
                "total_points": len(self.horizon_points),
                "created_date": datetime.now().isoformat(),
                "tool_version": "1.0"
            }
            
            # Save as JSON
            if file_path.endswith('.json'):
                with open(file_path, 'w') as f:
                    json.dump(horizon_data, f, indent=2)
            else:
                # Save as simple text format
                with open(file_path, 'w') as f:
                    f.write(f"# Horizon Line Data for {os.path.basename(self.image_path)}\n")
                    f.write(f"# Image dimensions: {self.orig_width}x{self.orig_height}\n")
                    f.write(f"# Total points: {len(self.horizon_points)}\n")
                    f.write(f"# Created: {datetime.now().isoformat()}\n")
                    f.write("# Format: x,y (in original image coordinates)\n\n")
                    
                    for x, y in self.horizon_points:
                        f.write(f"{x},{y}\n")
            
            self.status_var.set(f"Horizon saved: {os.path.basename(file_path)} ({len(self.horizon_points)} points)")
            messagebox.showinfo("Success", f"Horizon line saved successfully!\n\nFile: {file_path}\nPoints: {len(self.horizon_points)}")
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save horizon line: {str(e)}")
    
    def load_horizon(self):
        """Load horizon line data from file."""
        file_path = filedialog.askopenfilename(
            title="Load Horizon Line",
            filetypes=[
                ("JSON files", "*.json"),
                ("Text files", "*.txt"),
                ("All files", "*.*")
            ]
        )
        
        if not file_path:
            return
        
        try:
            if file_path.endswith('.json'):
                # Load JSON format
                with open(file_path, 'r') as f:
                    horizon_data = json.load(f)
                
                self.horizon_points = horizon_data.get('horizon_points', [])
                
                # Check if image matches
                saved_image = horizon_data.get('image_name', '')
                current_image = os.path.basename(self.image_path) if self.image_path else ''
                
                if saved_image != current_image:
                    if not messagebox.askyesno("Image Mismatch", 
                        f"Horizon was saved for '{saved_image}' but current image is '{current_image}'.\n\nLoad anyway?"):
                        return
            
            else:
                # Load simple text format
                self.horizon_points = []
                with open(file_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#'):
                            try:
                                x, y = map(int, line.split(','))
                                self.horizon_points.append((x, y))
                            except ValueError:
                                continue
            
            # Convert to display coordinates
            self.display_horizon_points = []
            for x, y in self.horizon_points:
                disp_x = x * self.scale
                disp_y = y * self.scale
                self.display_horizon_points.append((disp_x, disp_y))
            
            # Redraw canvas
            self.redraw_canvas()
            
            self.status_var.set(f"Horizon loaded: {os.path.basename(file_path)} ({len(self.horizon_points)} points)")
            messagebox.showinfo("Success", f"Horizon line loaded successfully!\n\nPoints: {len(self.horizon_points)}")
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load horizon line: {str(e)}")
    
    def run(self):
        """Run the horizon drawing tool."""
        self.root.mainloop()

def main():
    """Main function to run the horizon line drawing tool."""
    import sys
    
    # Check for command line argument
    image_path = None
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    
    # Create and run the tool
    tool = HorizonLineDrawer(image_path)
    tool.run()

if __name__ == "__main__":
    main() 