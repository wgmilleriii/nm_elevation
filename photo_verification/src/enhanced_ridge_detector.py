#!/usr/bin/env python3
"""
Enhanced Ridge Detector with File Management and GPS Editing
Interactive GUI for ridge point selection with enhanced file management capabilities.
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog, simpledialog
from PIL import Image, ImageTk
import cv2
import numpy as np
import os
import json
import shutil
from datetime import datetime
from typing import List, Tuple, Optional, Dict
import re

class EnhancedRidgeDetector:
    def __init__(self):
        """Initialize the Enhanced Ridge Detector."""
        self.root = tk.Tk()
        self.root.title("Enhanced Ridge Point Detector")
        self.root.geometry("1400x900")
        
        # File and data management
        self.current_image_path = None
        self.current_data_file = None
        self.workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        self.data_folder = os.path.join(self.workspace_root, "data", "images")
        
        # Image handling
        self.image = None
        self.orig_width = 0
        self.orig_height = 0
        self.display_image = None
        self.photo = None
        self.scale = 1.0
        
        # Display settings
        self.max_width = 1000
        self.max_height = 600
        
        # Ridge point data
        self.selected_points = []  # List of (x, y) tuples in original image coordinates
        self.display_points = []   # List of point IDs for clearing
        
        # Metadata
        self.gps_latitude = ""
        self.gps_longitude = ""
        self.direction_facing = ""
        self.image_notes = ""
        
        # Canvas
        self.canvas = None
        
        # Setup UI
        self.setup_ui()
    
    def setup_ui(self):
        """Setup the user interface."""
        # Main container
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Top control panel
        control_frame = ttk.Frame(main_frame)
        control_frame.pack(fill='x', pady=(0, 10))
        
        # File operations
        file_frame = ttk.LabelFrame(control_frame, text="File Operations", padding=10)
        file_frame.pack(side='left', fill='x', expand=True, padx=(0, 10))
        
        ttk.Button(file_frame, text="Open Image", command=self.open_image).pack(side='left', padx=5)
        ttk.Button(file_frame, text="Save Data", command=self.save_data).pack(side='left', padx=5)
        ttk.Button(file_frame, text="Load Data", command=self.load_data).pack(side='left', padx=5)
        
        # Point operations
        point_frame = ttk.LabelFrame(control_frame, text="Point Operations", padding=10)
        point_frame.pack(side='right', padx=(10, 0))
        
        ttk.Button(point_frame, text="Clear All Points", command=self.clear_all_points).pack(side='left', padx=5)
        ttk.Button(point_frame, text="Undo Last Point", command=self.undo_last_point).pack(side='left', padx=5)
        
        # Metadata panel
        metadata_frame = ttk.LabelFrame(main_frame, text="Image Metadata", padding=10)
        metadata_frame.pack(fill='x', pady=(0, 10))
        
        # GPS and Direction row
        gps_frame = ttk.Frame(metadata_frame)
        gps_frame.pack(fill='x', pady=2)
        
        ttk.Label(gps_frame, text="GPS Latitude:").pack(side='left', padx=(0, 5))
        self.lat_var = tk.StringVar()
        self.lat_entry = ttk.Entry(gps_frame, textvariable=self.lat_var, width=15)
        self.lat_entry.pack(side='left', padx=(0, 10))
        
        ttk.Label(gps_frame, text="GPS Longitude:").pack(side='left', padx=(0, 5))
        self.lon_var = tk.StringVar()
        self.lon_entry = ttk.Entry(gps_frame, textvariable=self.lon_var, width=15)
        self.lon_entry.pack(side='left', padx=(0, 10))
        
        ttk.Label(gps_frame, text="Direction Facing:").pack(side='left', padx=(0, 5))
        self.dir_var = tk.StringVar()
        self.dir_entry = ttk.Entry(gps_frame, textvariable=self.dir_var, width=10)
        self.dir_entry.pack(side='left', padx=(0, 10))
        
        ttk.Button(gps_frame, text="Edit GPS/Direction", command=self.edit_gps_direction).pack(side='left', padx=10)
        
        # Notes row
        notes_frame = ttk.Frame(metadata_frame)
        notes_frame.pack(fill='x', pady=2)
        
        ttk.Label(notes_frame, text="Notes:").pack(side='left', padx=(0, 5))
        self.notes_var = tk.StringVar()
        self.notes_entry = ttk.Entry(notes_frame, textvariable=self.notes_var, width=60)
        self.notes_entry.pack(side='left', fill='x', expand=True, padx=(0, 10))
        
        # Status bar
        self.status_var = tk.StringVar()
        self.status_var.set("Ready - Open an image to start selecting ridge points")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief='sunken', anchor='w')
        status_bar.pack(fill='x', pady=(0, 10))
        
        # Canvas frame
        canvas_frame = ttk.Frame(main_frame)
        canvas_frame.pack(fill='both', expand=True)
        
        # Create canvas with scrollbars
        self.canvas = tk.Canvas(canvas_frame, bg='lightgray', cursor='crosshair')
        
        # Scrollbars
        v_scrollbar = ttk.Scrollbar(canvas_frame, orient='vertical', command=self.canvas.yview)
        h_scrollbar = ttk.Scrollbar(canvas_frame, orient='horizontal', command=self.canvas.xview)
        
        self.canvas.configure(yscrollcommand=v_scrollbar.set, xscrollcommand=h_scrollbar.set)
        
        # Pack scrollbars and canvas
        v_scrollbar.pack(side='right', fill='y')
        h_scrollbar.pack(side='bottom', fill='x')
        self.canvas.pack(side='left', fill='both', expand=True)
        
        # Bind mouse events
        self.canvas.bind('<Button-1>', self.on_click)
        
        # Bind keyboard shortcuts
        self.root.bind('<Control-o>', lambda e: self.open_image())
        self.root.bind('<Control-s>', lambda e: self.save_data())
        self.root.bind('<Control-z>', lambda e: self.undo_last_point())
        self.root.bind('<Delete>', lambda e: self.clear_all_points())
        
        # Bind metadata change events
        self.lat_var.trace_add('write', self.on_metadata_change)
        self.lon_var.trace_add('write', self.on_metadata_change)
        self.dir_var.trace_add('write', self.on_metadata_change)
        self.notes_var.trace_add('write', self.on_metadata_change)
    
    def open_image(self):
        """Open an image file with smart file management."""
        file_path = filedialog.askopenfilename(
            title="Select Image File",
            filetypes=[
                ("JPEG files", "*.jpg *.jpeg"),
                ("PNG files", "*.png"),
                ("All image files", "*.jpg *.jpeg *.png *.gif *.bmp *.tiff"),
                ("All files", "*.*")
            ]
        )
        
        if not file_path:
            return
        
        try:
            # Check if the file is already in our data folder
            if os.path.dirname(file_path) == self.data_folder:
                # File is already in data folder, just load it
                self.load_existing_image(file_path)
            else:
                # File is external, copy it to data folder
                self.import_new_image(file_path)
                
        except Exception as e:
            messagebox.showerror("Error", f"Failed to open image: {str(e)}")
    
    def import_new_image(self, source_path: str):
        """Import a new image from outside the data folder."""
        # Generate appropriate filename
        original_name = os.path.basename(source_path)
        name_without_ext = os.path.splitext(original_name)[0]
        ext = os.path.splitext(original_name)[1].lower()
        
        # Ensure it's a jpg for consistency
        if ext != '.jpg':
            ext = '.jpg'
        
        # Create unique filename if needed
        counter = 1
        new_filename = f"{name_without_ext}{ext}"
        new_path = os.path.join(self.data_folder, new_filename)
        
        while os.path.exists(new_path):
            new_filename = f"{name_without_ext}_{counter:03d}{ext}"
            new_path = os.path.join(self.data_folder, new_filename)
            counter += 1
        
        # Copy the file
        os.makedirs(self.data_folder, exist_ok=True)
        
        if source_path.lower().endswith('.jpg') or source_path.lower().endswith('.jpeg'):
            shutil.copy2(source_path, new_path)
        else:
            # Convert to JPG if it's a different format
            img = Image.open(source_path)
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            img.save(new_path, 'JPEG', quality=95)
        
        # Create new data file
        self.create_new_data_file(new_path)
        
        # Load the image
        self.load_image_file(new_path)
        
        self.status_var.set(f"Imported: {new_filename} - Click to select ridge points")
        messagebox.showinfo("Image Imported", f"Image copied to data folder as:\n{new_filename}\n\nNew data file created.")
    
    def load_existing_image(self, image_path: str):
        """Load an existing image from the data folder."""
        # Look for existing data file
        data_file = self.get_data_file_path(image_path)
        
        if os.path.exists(data_file):
            # Load existing data
            self.load_data_file(data_file)
        else:
            # Create new data file for existing image
            self.create_new_data_file(image_path)
        
        # Load the image
        self.load_image_file(image_path)
        
        filename = os.path.basename(image_path)
        self.status_var.set(f"Loaded: {filename} - Click to select ridge points")
    
    def load_image_file(self, image_path: str):
        """Load and display an image file."""
        self.current_image_path = image_path
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
        
        # Redraw existing points
        self.redraw_points()
    
    def get_data_file_path(self, image_path: str) -> str:
        """Get the data file path for an image."""
        image_name = os.path.splitext(os.path.basename(image_path))[0]
        return os.path.join(self.data_folder, f"{image_name}_data.json")
    
    def create_new_data_file(self, image_path: str):
        """Create a new data file for an image."""
        self.current_data_file = self.get_data_file_path(image_path)
        
        # Initialize with empty data
        self.selected_points = []
        self.gps_latitude = ""
        self.gps_longitude = ""
        self.direction_facing = ""
        self.image_notes = ""
        
        # Try to extract EXIF data if available
        self.extract_exif_data(image_path)
        
        # Update UI
        self.update_metadata_ui()
        
        # Save initial data file
        self.save_data_file()
    
    def extract_exif_data(self, image_path: str):
        """Extract GPS and direction data from EXIF if available."""
        try:
            from PIL.ExifTags import TAGS, GPSTAGS
            
            image = Image.open(image_path)
            exif_data = image._getexif()
            
            if exif_data:
                for tag_id, value in exif_data.items():
                    tag = TAGS.get(tag_id, tag_id)
                    
                    if tag == "GPSInfo":
                        gps_data = {}
                        for gps_tag_id, gps_value in value.items():
                            gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                            gps_data[gps_tag] = gps_value
                        
                        # Extract latitude and longitude
                        if 'GPSLatitude' in gps_data and 'GPSLatitudeRef' in gps_data:
                            lat = self.convert_gps_coordinate(gps_data['GPSLatitude'])
                            if gps_data['GPSLatitudeRef'] == 'S':
                                lat = -lat
                            self.gps_latitude = str(lat)
                        
                        if 'GPSLongitude' in gps_data and 'GPSLongitudeRef' in gps_data:
                            lon = self.convert_gps_coordinate(gps_data['GPSLongitude'])
                            if gps_data['GPSLongitudeRef'] == 'W':
                                lon = -lon
                            self.gps_longitude = str(lon)
                        
                        if 'GPSImgDirection' in gps_data:
                            self.direction_facing = str(float(gps_data['GPSImgDirection']))
        
        except Exception as e:
            print(f"Could not extract EXIF data: {e}")
    
    def convert_gps_coordinate(self, coord):
        """Convert GPS coordinate from EXIF format to decimal degrees."""
        degrees, minutes, seconds = coord
        return float(degrees) + float(minutes)/60 + float(seconds)/3600
    
    def load_data_file(self, data_file_path: str):
        """Load data from a JSON file."""
        try:
            with open(data_file_path, 'r') as f:
                data = json.load(f)
            
            self.current_data_file = data_file_path
            self.selected_points = data.get('ridge_points', [])
            self.gps_latitude = data.get('gps_latitude', '')
            self.gps_longitude = data.get('gps_longitude', '')
            self.direction_facing = data.get('direction_facing', '')
            self.image_notes = data.get('notes', '')
            
            self.update_metadata_ui()
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load data file: {str(e)}")
    
    def save_data_file(self):
        """Save current data to JSON file."""
        if not self.current_data_file:
            return
        
        try:
            data = {
                'image_path': self.current_image_path,
                'image_name': os.path.basename(self.current_image_path) if self.current_image_path else '',
                'image_dimensions': {
                    'width': self.orig_width,
                    'height': self.orig_height
                },
                'ridge_points': self.selected_points,
                'total_points': len(self.selected_points),
                'gps_latitude': self.gps_latitude,
                'gps_longitude': self.gps_longitude,
                'direction_facing': self.direction_facing,
                'notes': self.image_notes,
                'last_modified': datetime.now().isoformat(),
                'tool_version': '2.0'
            }
            
            with open(self.current_data_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save data file: {str(e)}")
    
    def update_metadata_ui(self):
        """Update the metadata UI fields."""
        self.lat_var.set(self.gps_latitude)
        self.lon_var.set(self.gps_longitude)
        self.dir_var.set(self.direction_facing)
        self.notes_var.set(self.image_notes)
    
    def on_metadata_change(self, *args):
        """Handle metadata field changes."""
        self.gps_latitude = self.lat_var.get()
        self.gps_longitude = self.lon_var.get()
        self.direction_facing = self.dir_var.get()
        self.image_notes = self.notes_var.get()
        
        # Auto-save data when metadata changes
        if self.current_data_file:
            self.save_data_file()
    
    def edit_gps_direction(self):
        """Open dialog to edit GPS and direction information."""
        dialog = GPSDirectionDialog(self.root, self.gps_latitude, self.gps_longitude, self.direction_facing)
        result = dialog.show()
        
        if result:
            self.gps_latitude, self.gps_longitude, self.direction_facing = result
            self.update_metadata_ui()
            if self.current_data_file:
                self.save_data_file()
    
    def on_click(self, event):
        """Handle mouse click events to add ridge points."""
        if not self.image:
            return
        
        x_disp, y_disp = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
        
        # Convert to original image coordinates
        x_orig = int(x_disp / self.scale)
        y_orig = int(y_disp / self.scale)
        
        # Add point to data
        self.selected_points.append((x_orig, y_orig))
        
        # Draw point on canvas
        point_id = self.canvas.create_oval(
            x_disp-3, y_disp-3, x_disp+3, y_disp+3, 
            fill='red', outline='darkred', width=2
        )
        self.display_points.append(point_id)
        
        # Update status
        self.status_var.set(f"Ridge points: {len(self.selected_points)} - Click to add more points")
        
        # Auto-save
        if self.current_data_file:
            self.save_data_file()
    
    def clear_all_points(self):
        """Clear all selected ridge points."""
        if not self.selected_points:
            return
        
        if messagebox.askyesno("Clear All Points", 
                              f"Are you sure you want to clear all {len(self.selected_points)} ridge points?"):
            self.selected_points = []
            self.redraw_points()
            self.status_var.set("All ridge points cleared")
            
            # Auto-save
            if self.current_data_file:
                self.save_data_file()
    
    def undo_last_point(self):
        """Remove the last selected point."""
        if self.selected_points:
            self.selected_points.pop()
            self.redraw_points()
            self.status_var.set(f"Ridge points: {len(self.selected_points)} - Last point removed")
            
            # Auto-save
            if self.current_data_file:
                self.save_data_file()
    
    def redraw_points(self):
        """Redraw all ridge points on the canvas."""
        # Clear existing point displays
        for point_id in self.display_points:
            self.canvas.delete(point_id)
        self.display_points = []
        
        # Redraw all points
        for x_orig, y_orig in self.selected_points:
            x_disp = x_orig * self.scale
            y_disp = y_orig * self.scale
            
            point_id = self.canvas.create_oval(
                x_disp-3, y_disp-3, x_disp+3, y_disp+3,
                fill='red', outline='darkred', width=2
            )
            self.display_points.append(point_id)
    
    def save_data(self):
        """Save current data with user confirmation."""
        if not self.current_data_file:
            messagebox.showwarning("No Data", "No image loaded to save data for.")
            return
        
        self.save_data_file()
        
        filename = os.path.basename(self.current_data_file)
        messagebox.showinfo("Data Saved", 
                           f"Ridge point data saved successfully!\n\n"
                           f"File: {filename}\n"
                           f"Points: {len(self.selected_points)}\n"
                           f"GPS: {self.gps_latitude}, {self.gps_longitude}\n"
                           f"Direction: {self.direction_facing}°")
    
    def load_data(self):
        """Load data from a selected file."""
        file_path = filedialog.askopenfilename(
            title="Load Ridge Data",
            initialdir=self.data_folder,
            filetypes=[
                ("JSON files", "*.json"),
                ("All files", "*.*")
            ]
        )
        
        if file_path:
            self.load_data_file(file_path)
            
            # Try to load corresponding image
            data_name = os.path.splitext(os.path.basename(file_path))[0]
            if data_name.endswith('_data'):
                image_name = data_name[:-5]  # Remove '_data' suffix
                image_path = os.path.join(self.data_folder, f"{image_name}.jpg")
                
                if os.path.exists(image_path):
                    self.load_image_file(image_path)
                else:
                    messagebox.showwarning("Image Not Found", 
                                         f"Data loaded but corresponding image not found:\n{image_name}.jpg")
    
    def run(self):
        """Run the enhanced ridge detector."""
        self.root.mainloop()

class GPSDirectionDialog:
    def __init__(self, parent, lat, lon, direction):
        self.result = None
        
        # Create dialog window
        self.dialog = tk.Toplevel(parent)
        self.dialog.title("Edit GPS and Direction")
        self.dialog.geometry("400x300")
        self.dialog.transient(parent)
        self.dialog.grab_set()
        
        # Center the dialog
        self.dialog.geometry("+%d+%d" % (parent.winfo_rootx() + 50, parent.winfo_rooty() + 50))
        
        # Main frame
        main_frame = ttk.Frame(self.dialog, padding=20)
        main_frame.pack(fill='both', expand=True)
        
        # GPS Latitude
        ttk.Label(main_frame, text="GPS Latitude:").grid(row=0, column=0, sticky='w', pady=5)
        self.lat_var = tk.StringVar(value=lat)
        lat_entry = ttk.Entry(main_frame, textvariable=self.lat_var, width=20)
        lat_entry.grid(row=0, column=1, sticky='ew', padx=(10, 0), pady=5)
        ttk.Label(main_frame, text="(e.g., 35.240222)").grid(row=0, column=2, sticky='w', padx=(5, 0))
        
        # GPS Longitude
        ttk.Label(main_frame, text="GPS Longitude:").grid(row=1, column=0, sticky='w', pady=5)
        self.lon_var = tk.StringVar(value=lon)
        lon_entry = ttk.Entry(main_frame, textvariable=self.lon_var, width=20)
        lon_entry.grid(row=1, column=1, sticky='ew', padx=(10, 0), pady=5)
        ttk.Label(main_frame, text="(e.g., -106.635889)").grid(row=1, column=2, sticky='w', padx=(5, 0))
        
        # Direction Facing
        ttk.Label(main_frame, text="Direction Facing:").grid(row=2, column=0, sticky='w', pady=5)
        self.dir_var = tk.StringVar(value=direction)
        dir_entry = ttk.Entry(main_frame, textvariable=self.dir_var, width=20)
        dir_entry.grid(row=2, column=1, sticky='ew', padx=(10, 0), pady=5)
        ttk.Label(main_frame, text="(degrees, 0-360)").grid(row=2, column=2, sticky='w', padx=(5, 0))
        
        # Help text
        help_frame = ttk.LabelFrame(main_frame, text="Help", padding=10)
        help_frame.grid(row=3, column=0, columnspan=3, sticky='ew', pady=20)
        
        help_text = """GPS Coordinates:
• Use decimal degrees format (e.g., 35.240222, -106.635889)
• Positive latitude = North, Negative = South
• Positive longitude = East, Negative = West

Direction Facing:
• 0° or 360° = North
• 90° = East
• 180° = South
• 270° = West"""
        
        ttk.Label(help_frame, text=help_text, justify='left').pack(anchor='w')
        
        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=4, column=0, columnspan=3, pady=20)
        
        ttk.Button(button_frame, text="OK", command=self.ok_clicked).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Cancel", command=self.cancel_clicked).pack(side='left', padx=5)
        
        # Configure grid weights
        main_frame.columnconfigure(1, weight=1)
        
        # Focus on first entry
        lat_entry.focus()
    
    def ok_clicked(self):
        """Handle OK button click."""
        try:
            lat = self.lat_var.get().strip()
            lon = self.lon_var.get().strip()
            direction = self.dir_var.get().strip()
            
            # Validate latitude
            if lat:
                lat_val = float(lat)
                if not (-90 <= lat_val <= 90):
                    raise ValueError("Latitude must be between -90 and 90")
            
            # Validate longitude
            if lon:
                lon_val = float(lon)
                if not (-180 <= lon_val <= 180):
                    raise ValueError("Longitude must be between -180 and 180")
            
            # Validate direction
            if direction:
                dir_val = float(direction)
                if not (0 <= dir_val <= 360):
                    raise ValueError("Direction must be between 0 and 360")
            
            self.result = (lat, lon, direction)
            self.dialog.destroy()
            
        except ValueError as e:
            messagebox.showerror("Invalid Input", str(e))
    
    def cancel_clicked(self):
        """Handle Cancel button click."""
        self.dialog.destroy()
    
    def show(self):
        """Show the dialog and return the result."""
        self.dialog.wait_window()
        return self.result

def main():
    """Main function to run the enhanced ridge detector."""
    print("🏔️  Enhanced Ridge Point Detector")
    print("📂 File Management: Import images, auto-create data files")
    print("📍 GPS Editing: Edit coordinates and direction information")
    print("🎯 Point Selection: Click to select ridge points")
    print()
    
    try:
        detector = EnhancedRidgeDetector()
        detector.run()
    except Exception as e:
        print(f"❌ Error launching detector: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 