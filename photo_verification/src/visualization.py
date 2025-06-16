import matplotlib.pyplot as plt
import numpy as np
from typing import List, Tuple, Optional
import cv2

class Visualization:
    def __init__(self):
        """Initialize the visualization module."""
        plt.style.use('seaborn')

    def plot_comparison(self,
                       photo_profile: List[Tuple[float, float]],
                       db_profile: List[Tuple[float, float]],
                       errors: List[float],
                       save_path: Optional[str] = None):
        """
        Create a visualization comparing photo and database elevation profiles.
        
        Args:
            photo_profile: List of (distance, elevation) tuples from photo
            db_profile: List of (distance, elevation) tuples from database
            errors: List of elevation errors
            save_path: Optional path to save the visualization
        """
        # Create figure with subplots
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), height_ratios=[2, 1])
        
        # Convert to numpy arrays
        photo_distances = np.array([p[0] for p in photo_profile])
        photo_elevations = np.array([p[1] for p in photo_profile])
        db_distances = np.array([p[0] for p in db_profile])
        db_elevations = np.array([p[1] for p in db_profile])
        
        # Plot elevation profiles
        ax1.plot(photo_distances, photo_elevations, 'b-', label='Photo Profile', alpha=0.7)
        ax1.plot(db_distances, db_elevations, 'r-', label='Database Profile', alpha=0.7)
        ax1.set_xlabel('Distance (meters)')
        ax1.set_ylabel('Elevation (meters)')
        ax1.set_title('Elevation Profile Comparison')
        ax1.legend()
        ax1.grid(True)
        
        # Plot errors
        ax2.plot(photo_distances, errors, 'g-', label='Elevation Error')
        ax2.axhline(y=0, color='k', linestyle='--', alpha=0.3)
        ax2.set_xlabel('Distance (meters)')
        ax2.set_ylabel('Error (meters)')
        ax2.set_title('Elevation Error Distribution')
        ax2.legend()
        ax2.grid(True)
        
        # Adjust layout
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        return fig

    def create_overlay(self,
                      image: np.ndarray,
                      skyline: np.ndarray,
                      errors: Optional[List[float]] = None,
                      save_path: Optional[str] = None) -> np.ndarray:
        """
        Create an overlay visualization of the skyline and errors on the original image.
        
        Args:
            image: Original image
            skyline: Array of y-coordinates representing the skyline
            errors: Optional list of elevation errors
            save_path: Optional path to save the visualization
        
        Returns:
            Visualization image
        """
        # Create a copy of the image
        vis_image = image.copy()
        
        # Draw skyline
        for x in range(len(skyline)):
            cv2.line(vis_image, (x, skyline[x]), (x, skyline[x]), (0, 255, 0), 1)
        
        # Add error visualization if provided
        if errors is not None:
            # Create error color map
            error_colors = np.zeros((len(errors), 3), dtype=np.uint8)
            for i, error in enumerate(errors):
                # Red for positive errors, blue for negative
                if error > 0:
                    error_colors[i] = [0, 0, min(255, int(error * 10))]
                else:
                    error_colors[i] = [min(255, int(-error * 10)), 0, 0]
            
            # Draw error bars
            for x in range(len(errors)):
                if abs(errors[x]) > 1.0:  # Only show significant errors
                    color = error_colors[x].tolist()
                    cv2.line(vis_image, 
                            (x, skyline[x]), 
                            (x, skyline[x] + int(errors[x])), 
                            color, 1)
        
        if save_path:
            cv2.imwrite(save_path, vis_image)
        
        return vis_image

    def create_summary_report(self,
                            metrics: dict,
                            save_path: Optional[str] = None) -> str:
        """
        Create a text summary of the verification results.
        
        Args:
            metrics: Dictionary containing comparison metrics
            save_path: Optional path to save the report
        
        Returns:
            Formatted report string
        """
        report = "Elevation Data Verification Report\n"
        report += "================================\n\n"
        
        report += f"Mean Absolute Error: {metrics['mean_absolute_error']:.2f} meters\n"
        report += f"Root Mean Square Error: {metrics['root_mean_square_error']:.2f} meters\n"
        report += f"Maximum Error: {metrics['max_error']:.2f} meters\n\n"
        
        # Add error distribution statistics
        errors = np.array(metrics['error_distribution'])
        report += "Error Distribution Statistics:\n"
        report += f"  Standard Deviation: {np.std(errors):.2f} meters\n"
        report += f"  Median Error: {np.median(errors):.2f} meters\n"
        report += f"  Error Range: [{np.min(errors):.2f}, {np.max(errors):.2f}] meters\n"
        
        if save_path:
            with open(save_path, 'w') as f:
                f.write(report)
        
        return report

if __name__ == "__main__":
    # Example usage
    viz = Visualization()
    
    # Example data
    photo_profile = [(1000*i, 1000 + 100*np.sin(i/10)) for i in range(100)]
    db_profile = [(1000*i, 1000 + 100*np.sin(i/10) + np.random.normal(0, 10)) for i in range(100)]
    errors = [db_profile[i][1] - photo_profile[i][1] for i in range(100)]
    
    # Create visualizations
    fig = viz.plot_comparison(photo_profile, db_profile, errors, "comparison.png")
    
    # Create example image
    image = np.zeros((1000, 1000, 3), dtype=np.uint8)
    skyline = np.array([500 + 100*np.sin(i/10) for i in range(1000)])
    overlay = viz.create_overlay(image, skyline, errors, "overlay.png")
    
    # Create report
    metrics = {
        'mean_absolute_error': np.mean(np.abs(errors)),
        'root_mean_square_error': np.sqrt(np.mean(np.array(errors)**2)),
        'max_error': np.max(np.abs(errors)),
        'error_distribution': errors
    }
    report = viz.create_summary_report(metrics, "report.txt")
    print(report) 