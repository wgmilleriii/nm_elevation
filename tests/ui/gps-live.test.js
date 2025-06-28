const { screen, waitFor } = require('@testing-library/dom');
const userEvent = require('@testing-library/user-event');
require('@testing-library/jest-dom');

describe('GPS Live Tracking Interface', () => {
  let container;
  let gpsModule;

  beforeEach(() => {
    // Set up our HTML structure
    document.body.innerHTML = `
      <div class="coordinates">
        <div>
          <label>LAT:</label>
          <span id="lat" class="lat">---.------</span>
        </div>
        <div>
          <label>LON:</label>
          <span id="lon" class="lon">---.------</span>
        </div>
        <div>
          <label>ELEV:</label>
          <span id="elev" class="elev">----</span>
          <span>m</span>
        </div>
        <div>
          <label>ACC:</label>
          <span id="acc">--</span>
          <span>m</span>
          <span id="acc-indicator" class="accuracy-indicator" data-testid="acc-indicator"></span>
        </div>
      </div>
      <div id="map"></div>
      <div id="svg-container">
        <svg id="elevation-svg"></svg>
      </div>
    `;

    container = document.body;

    // Mock fetch for elevation data
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ elevation: 1620 })
      })
    );

    // Import and initialize the GPS module
    gpsModule = require('../mocks/gps_live.mock.js');
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  test('should initialize map with Leaflet', () => {
    expect(global.L.map).toHaveBeenCalledWith('map');
    expect(global.L.tileLayer).toHaveBeenCalledWith(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    );
  });

  test('should update coordinates when GPS position changes', async () => {
    const mockPosition = {
      coords: {
        latitude: 35.0844,
        longitude: -106.6504,
        accuracy: 10
      }
    };

    gpsModule.handlePosition(mockPosition);

    await waitFor(() => {
      expect(screen.getByText('35.0844')).toBeInTheDocument();
      expect(screen.getByText('-106.6504')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  test('should update accuracy indicator color based on accuracy value', async () => {
    const mockPositions = [
      { coords: { latitude: 35.0844, longitude: -106.6504, accuracy: 5 } },  // High accuracy
      { coords: { latitude: 35.0844, longitude: -106.6504, accuracy: 15 } }, // Medium accuracy
      { coords: { latitude: 35.0844, longitude: -106.6504, accuracy: 30 } }  // Low accuracy
    ];

    for (const pos of mockPositions) {
      gpsModule.handlePosition(pos);
      
      await waitFor(() => {
        const indicator = screen.getByTestId('acc-indicator');
        if (pos.coords.accuracy <= 10) {
          expect(indicator).toHaveClass('accuracy-high');
        } else if (pos.coords.accuracy <= 20) {
          expect(indicator).toHaveClass('accuracy-medium');
        } else {
          expect(indicator).toHaveClass('accuracy-low');
        }
      });
    }
  });

  test('should fetch and display elevation data', async () => {
    const mockPosition = {
      coords: {
        latitude: 35.0844,
        longitude: -106.6504,
        accuracy: 10
      }
    };

    gpsModule.handlePosition(mockPosition);

    await waitFor(() => {
      expect(screen.getByText('1620')).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledWith(
        `/api/elevation?lat=${mockPosition.coords.latitude}&lon=${mockPosition.coords.longitude}`
      );
    });
  });

  test('should handle GPS errors gracefully', async () => {
    const mockError = {
      code: 1,
      message: 'User denied geolocation'
    };

    gpsModule.handleError(mockError);

    await waitFor(() => {
      expect(document.getElementById('lat').textContent).toBe('---.------');
      expect(document.getElementById('lon').textContent).toBe('---.------');
      expect(document.getElementById('elev').textContent).toBe('----');
      expect(document.getElementById('acc').textContent).toBe('---');
    });
  });

  test('should update SVG visualization with elevation data', async () => {
    const mockPosition = {
      coords: {
        latitude: 35.0844,
        longitude: -106.6504,
        accuracy: 10
      }
    };

    gpsModule.handlePosition(mockPosition);

    await waitFor(() => {
      const svg = document.querySelector('#elevation-svg');
      expect(svg.children.length).toBeGreaterThan(0);
      const circle = svg.querySelector('circle');
      expect(circle).toBeInTheDocument();
      expect(circle.getAttribute('r')).toBe('10');
    });
  });
}); 