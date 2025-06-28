require('@testing-library/jest-dom');

// Mock Leaflet since it's used in our UI
const mockLeaflet = {
  map: jest.fn(() => ({
    setView: jest.fn(),
    addLayer: jest.fn(),
    on: jest.fn(),
    remove: jest.fn()
  })),
  tileLayer: jest.fn(() => ({
    addTo: jest.fn()
  })),
  marker: jest.fn(() => ({
    addTo: jest.fn(),
    setLatLng: jest.fn(),
    bindPopup: jest.fn()
  })),
  circle: jest.fn(() => ({
    addTo: jest.fn(),
    setLatLng: jest.fn()
  }))
};

global.L = mockLeaflet;

// Mock geolocation API
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn()
};

global.navigator.geolocation = mockGeolocation; 