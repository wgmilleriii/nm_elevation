#!/usr/bin/env python3
"""
Horizon Template Generator
Creates interesting horizon drawings using Python with different shading options
Demonstrates server-side generation of 10-20 jagged horizon lines
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.path import Path
import json
import os
from datetime import datetime

class HorizonTemplateGenerator:
    def __init__(self):
        self.width = 800
        self.height = 300
        self.templates = {}
        
    def generate_mountain_peaks(self, num_lines=15):
        """Generate sharp mountain peaks with varying heights"""
        x_points = np.linspace(0, self.width, num_lines)
        
        # Create jagged mountain profile
        base_height = self.height * 0.7
        peaks = []
        
        for i, x in enumerate(x_points):
            # Vary peak heights with some randomness
            height_factor = 0.3 + 0.4 * np.sin(i * 0.8) + 0.2 * np.random.random()
            y = base_height - (height_factor * self.height * 0.5)
            
            # Add some sharp variations for mountain character
            if i > 0 and i < len(x_points) - 1:
                if np.random.random() > 0.7:  # 30% chance of sharp peak
                    y -= 30 + np.random.random() * 40
            
            peaks.append((x, max(y, 50)))  # Ensure minimum height
        
        return peaks
    
    def generate_rolling_hills(self, num_lines=11):
        """Generate gentle rolling hills"""
        x_points = np.linspace(0, self.width, num_lines)
        
        # Create smooth rolling profile using sine waves
        base_height = self.height * 0.65
        hills = []
        
        for i, x in enumerate(x_points):
            # Combine multiple sine waves for natural rolling effect
            wave1 = 0.3 * np.sin(x * 0.01)
            wave2 = 0.2 * np.sin(x * 0.008 + 1.5)
            wave3 = 0.1 * np.sin(x * 0.015 + 3)
            
            height_variation = (wave1 + wave2 + wave3) * 60
            y = base_height + height_variation
            
            hills.append((x, max(y, 100)))
        
        return hills
    
    def generate_mixed_terrain(self, num_lines=18):
        """Generate mixed terrain with peaks, valleys, and plateaus"""
        x_points = np.linspace(0, self.width, num_lines)
        
        terrain = []
        base_height = self.height * 0.6
        
        for i, x in enumerate(x_points):
            # Create varied terrain types
            segment = i / len(x_points)
            
            if segment < 0.3:  # Rolling start
                y = base_height + 20 * np.sin(i * 0.5)
            elif segment < 0.6:  # Mountain section
                peak_factor = 0.8 + 0.4 * np.sin(i * 0.3)
                y = base_height - peak_factor * 120
            else:  # Plateau and decline
                plateau_height = base_height - 40
                y = plateau_height + 30 * np.sin(i * 0.4)
            
            # Add random variations
            y += (np.random.random() - 0.5) * 20
            terrain.append((x, max(y, 60)))
        
        return terrain
    
    def generate_layered_depth(self):
        """Generate multiple layers showing atmospheric perspective"""
        layers = []
        
        # Near layer (0-20% of width)
        near_x = np.linspace(0, self.width * 0.25, 6)
        near_layer = []
        for i, x in enumerate(near_x):
            y = self.height * 0.75 - i * 8
            near_layer.append((x, y))
        layers.append(('near', near_layer, 0.9, '#2F4F4F'))
        
        # Mid layer (20-70% of width)
        mid_x = np.linspace(self.width * 0.2, self.width * 0.7, 8)
        mid_layer = []
        base_mid = self.height * 0.6
        for i, x in enumerate(mid_x):
            y = base_mid + 20 * np.sin(i * 0.8) - 30
            mid_layer.append((x, y))
        layers.append(('mid', mid_layer, 0.7, '#4682B4'))
        
        # Far layer (70-100% of width)
        far_x = np.linspace(self.width * 0.65, self.width, 6)
        far_layer = []
        base_far = self.height * 0.55
        for i, x in enumerate(far_x):
            y = base_far + 15 * np.sin(i * 0.6)
            far_layer.append((x, y))
        layers.append(('far', far_layer, 0.5, '#87CEEB'))
        
        return layers
    
    def create_svg_template(self, template_name, points_data, style='default'):
        """Create SVG representation of horizon template"""
        if template_name == 'layered_depth':
            return self._create_layered_svg(points_data, style)
        else:
            return self._create_single_layer_svg(points_data, style, template_name)
    
    def _create_single_layer_svg(self, points, style, template_name):
        """Create SVG for single-layer horizon"""
        # Create path data
        path_data = f"M{points[0][0]},{points[0][1]}"
        for x, y in points[1:]:
            path_data += f" L{x},{y}"
        
        # Close path for fill
        fill_path = path_data + f" L{self.width},{self.height} L0,{self.height} Z"
        
        # Style configurations
        styles = {
            'mountain_peaks': {'stroke': '#8B4513', 'fill': 'url(#mountainGradient)'},
            'rolling_hills': {'stroke': '#228B22', 'fill': 'url(#hillsGradient)'},
            'mixed_terrain': {'stroke': '#4682B4', 'fill': 'url(#mixedGradient)'}
        }
        
        current_style = styles.get(template_name, styles['mountain_peaks'])
        
        svg_content = f'''
        <svg width="{self.width}" height="{self.height}" viewBox="0 0 {self.width} {self.height}">
            <defs>
                <linearGradient id="mountainGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#8B4513;stop-opacity:0.8"/>
                    <stop offset="100%" style="stop-color:#DEB887;stop-opacity:0.3"/>
                </linearGradient>
                <linearGradient id="hillsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#228B22;stop-opacity:0.7"/>
                    <stop offset="100%" style="stop-color:#90EE90;stop-opacity:0.2"/>
                </linearGradient>
                <linearGradient id="mixedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#4682B4;stop-opacity:0.8"/>
                    <stop offset="100%" style="stop-color:#B0C4DE;stop-opacity:0.2"/>
                </linearGradient>
            </defs>
            <rect width="{self.width}" height="{self.height}" fill="url(#skyGradient)"/>
            <path d="{fill_path}" fill="{current_style['fill']}" opacity="0.6"/>
            <path d="{path_data}" stroke="{current_style['stroke']}" stroke-width="2.5" fill="none"/>
        </svg>
        '''
        
        return svg_content
    
    def _create_layered_svg(self, layers, style):
        """Create SVG for layered depth horizon"""
        svg_content = f'<svg width="{self.width}" height="{self.height}" viewBox="0 0 {self.width} {self.height}">\n'
        
        # Add gradients for each layer
        svg_content += '<defs>\n'
        for i, (layer_name, points, opacity, color) in enumerate(layers):
            svg_content += f'''
            <linearGradient id="layer{i}Gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:{color};stop-opacity:{opacity}"/>
                <stop offset="100%" style="stop-color:{color};stop-opacity:{opacity*0.3}"/>
            </linearGradient>
            '''
        svg_content += '</defs>\n'
        
        # Add each layer
        for i, (layer_name, points, opacity, color) in enumerate(layers):
            if len(points) < 2:
                continue
                
            path_data = f"M{points[0][0]},{points[0][1]}"
            for x, y in points[1:]:
                path_data += f" L{x},{y}"
            
            # Create fill path
            last_x = points[-1][0]
            fill_path = path_data + f" L{last_x},{self.height} L{points[0][0]},{self.height} Z"
            
            svg_content += f'<path d="{fill_path}" fill="url(#layer{i}Gradient)"/>\n'
            svg_content += f'<path d="{path_data}" stroke="{color}" stroke-width="2" fill="none" opacity="{opacity}"/>\n'
        
        svg_content += '</svg>'
        return svg_content
    
    def create_matplotlib_visualization(self, template_name, points_data, style='default'):
        """Create matplotlib visualization of horizon template"""
        fig, ax = plt.subplots(figsize=(12, 4.5))
        
        # Set sky background
        ax.set_facecolor('#87CEEB')
        
        if template_name == 'layered_depth':
            self._plot_layered_depth(ax, points_data, style)
        else:
            self._plot_single_layer(ax, points_data, style, template_name)
        
        # Styling
        ax.set_xlim(0, self.width)
        ax.set_ylim(0, self.height)
        ax.set_aspect('equal')
        ax.axis('off')
        
        # Add title
        title = template_name.replace('_', ' ').title()
        ax.set_title(f'{title} - {style.title()} Style', 
                    fontsize=14, fontweight='bold', pad=20)
        
        return fig
    
    def _plot_single_layer(self, ax, points, style, template_name):
        """Plot single layer horizon"""
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        
        # Color schemes
        colors = {
            'mountain_peaks': {'line': '#8B4513', 'fill': '#DEB887'},
            'rolling_hills': {'line': '#228B22', 'fill': '#90EE90'},
            'mixed_terrain': {'line': '#4682B4', 'fill': '#B0C4DE'}
        }
        
        color_scheme = colors.get(template_name, colors['mountain_peaks'])
        
        # Fill area under curve
        ax.fill_between(x_coords, y_coords, self.height, 
                       color=color_scheme['fill'], alpha=0.4)
        
        # Draw horizon line
        line_width = 3 if style == 'bold' else 2
        ax.plot(x_coords, y_coords, 
               color=color_scheme['line'], linewidth=line_width)
        
        # Add elevation points
        for i, (x, y) in enumerate(points):
            if i % 3 == 0:  # Show every 3rd point
                ax.plot(x, y, 'o', color='#FF6347', markersize=4)
    
    def _plot_layered_depth(self, ax, layers, style):
        """Plot layered depth horizon"""
        for layer_name, points, opacity, color in layers:
            if len(points) < 2:
                continue
                
            x_coords = [p[0] for p in points]
            y_coords = [p[1] for p in points]
            
            # Fill area
            ax.fill_between(x_coords, y_coords, self.height, 
                           color=color, alpha=opacity*0.3)
            
            # Draw line
            ax.plot(x_coords, y_coords, 
                   color=color, linewidth=2, alpha=opacity)
    
    def generate_all_templates(self, output_dir='horizon_templates'):
        """Generate all template types with different styles"""
        os.makedirs(output_dir, exist_ok=True)
        
        templates = {
            'mountain_peaks': self.generate_mountain_peaks(),
            'rolling_hills': self.generate_rolling_hills(),
            'mixed_terrain': self.generate_mixed_terrain(),
            'layered_depth': self.generate_layered_depth()
        }
        
        styles = ['default', 'bold', 'subtle']
        
        results = {}
        
        for template_name, points_data in templates.items():
            results[template_name] = {}
            
            for style in styles:
                # Generate matplotlib visualization
                fig = self.create_matplotlib_visualization(template_name, points_data, style)
                
                # Save PNG
                png_filename = f'{template_name}_{style}.png'
                png_path = os.path.join(output_dir, png_filename)
                fig.savefig(png_path, dpi=150, bbox_inches='tight', 
                           facecolor='#87CEEB', edgecolor='none')
                plt.close(fig)
                
                # Generate SVG
                svg_content = self.create_svg_template(template_name, points_data, style)
                svg_filename = f'{template_name}_{style}.svg'
                svg_path = os.path.join(output_dir, svg_filename)
                
                with open(svg_path, 'w') as f:
                    f.write(svg_content)
                
                # Store metadata
                if template_name == 'layered_depth':
                    line_count = sum(len(layer[1]) for layer in points_data)
                else:
                    line_count = len(points_data)
                
                results[template_name][style] = {
                    'png_file': png_filename,
                    'svg_file': svg_filename,
                    'line_count': line_count,
                    'generated_at': datetime.now().isoformat()
                }
        
        # Save metadata
        metadata_path = os.path.join(output_dir, 'templates_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(results, f, indent=2)
        
        return results
    
    def create_comparison_chart(self, output_dir='horizon_templates'):
        """Create a comparison chart showing all templates"""
        fig, axes = plt.subplots(2, 2, figsize=(16, 10))
        fig.suptitle('Horizon Template Comparison\n10-20 Lines Per View', 
                    fontsize=16, fontweight='bold')
        
        templates = {
            'Mountain Peaks': self.generate_mountain_peaks(),
            'Rolling Hills': self.generate_rolling_hills(),
            'Mixed Terrain': self.generate_mixed_terrain(),
            'Layered Depth': self.generate_layered_depth()
        }
        
        for idx, (title, data) in enumerate(templates.items()):
            row, col = idx // 2, idx % 2
            ax = axes[row, col]
            
            ax.set_facecolor('#87CEEB')
            
            if title == 'Layered Depth':
                self._plot_layered_depth(ax, data, 'default')
                line_count = sum(len(layer[1]) for layer in data)
            else:
                template_key = title.lower().replace(' ', '_')
                self._plot_single_layer(ax, data, 'default', template_key)
                line_count = len(data)
            
            ax.set_xlim(0, self.width)
            ax.set_ylim(0, self.height)
            ax.set_aspect('equal')
            ax.axis('off')
            ax.set_title(f'{title}\n{line_count} lines', fontsize=12, fontweight='bold')
        
        plt.tight_layout()
        
        comparison_path = os.path.join(output_dir, 'horizon_comparison.png')
        fig.savefig(comparison_path, dpi=150, bbox_inches='tight', 
                   facecolor='white', edgecolor='none')
        plt.close(fig)
        
        return comparison_path

def main():
    """Generate all horizon templates"""
    print("🏔️ Generating Horizon Templates...")
    
    generator = HorizonTemplateGenerator()
    
    # Generate all templates
    results = generator.generate_all_templates()
    
    # Create comparison chart
    comparison_path = generator.create_comparison_chart()
    
    print(f"✅ Generated {len(results)} template types with multiple styles")
    print(f"📊 Comparison chart: {comparison_path}")
    print(f"📁 Output directory: horizon_templates/")
    
    # Print summary
    total_files = 0
    for template_name, styles in results.items():
        line_count = list(styles.values())[0]['line_count']
        print(f"   {template_name}: {line_count} lines, {len(styles)} styles")
        total_files += len(styles) * 2  # PNG + SVG
    
    print(f"📄 Total files generated: {total_files}")
    print("\n🎨 Templates demonstrate:")
    print("   • 10-20 strategic horizon lines")
    print("   • Multiple shading options")
    print("   • Jagged, interesting silhouettes")
    print("   • Both SVG and PNG formats")

if __name__ == "__main__":
    main() 