// Mock implementation of GPS live tracking
const gpsModule = {
  successCallback: null,
  errorCallback: null,
  
  initMap: () => {
    const map = global.L.map('map');
    const tileLayer = global.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    tileLayer.addTo(map);
    return map;
  },

  updateCoordinates: (lat, lon, acc) => {
    document.getElementById('lat').textContent = lat;
    document.getElementById('lon').textContent = lon;
    document.getElementById('acc').textContent = acc;
    
    const indicator = document.getElementById('acc-indicator');
    indicator.className = 'accuracy-indicator ' + 
      (acc <= 10 ? 'accuracy-high' : acc <= 20 ? 'accuracy-medium' : 'accuracy-low');
  },

  updateElevation: (elevation) => {
    document.getElementById('elev').textContent = elevation;
  },

  updateVisualization: (elevation) => {
    const svg = document.getElementById('elevation-svg');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '50');
    circle.setAttribute('r', '10');
    svg.appendChild(circle);
  },

  handlePosition: (position) => {
    const { latitude, longitude, accuracy } = position.coords;
    gpsModule.updateCoordinates(latitude, longitude, accuracy);
    
    // Fetch elevation data
    fetch(`/api/elevation?lat=${latitude}&lon=${longitude}`)
      .then(response => response.json())
      .then(data => {
        gpsModule.updateElevation(data.elevation);
        gpsModule.updateVisualization(data.elevation);
      })
      .catch(error => console.error('Error fetching elevation:', error));
  },

  handleError: (error) => {
    console.error('GPS Error:', error);
    gpsModule.updateCoordinates('---.------', '---.------', '---');
    gpsModule.updateElevation('----');
  }
};

// Initialize map
const map = gpsModule.initMap();

// Set up GPS tracking
navigator.geolocation.watchPosition = jest.fn((success, error) => {
  gpsModule.successCallback = success;
  gpsModule.errorCallback = error;
  return 123; // watchId
});

// Start tracking
navigator.geolocation.watchPosition(gpsModule.handlePosition, gpsModule.handleError);

module.exports = gpsModule; 