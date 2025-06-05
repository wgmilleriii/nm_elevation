# API Tests

This directory contains automated tests for the New Mexico Elevation API endpoints.

## Test Coverage

The tests cover all major API endpoints:

1. `GET /api/elevation-data`
   - Initial data load without bounds
   - Grid data with bounds (24x24)
   - Invalid bounds handling

2. `GET /api/santa-fe-elevation`
   - Valid coordinates and radius
   - Invalid parameters handling

3. `POST /api/enhance-region`
   - Valid region enhancement
   - Out-of-bounds validation
   - Missing parameters handling

## Running Tests

1. Make sure the server is running:
   ```bash
   npm start
   ```

2. In a separate terminal, run the tests:
   ```bash
   npm test
   ```

   Or run in watch mode during development:
   ```bash
   npm run test:watch
   ```

## Test Structure

- `api.test.js` - Main test suite
  - Helper functions for validation
  - Individual test cases for each endpoint
  - Error handling tests

## Adding New Tests

When adding new API endpoints, please:
1. Add corresponding test cases
2. Include both success and error scenarios
3. Use the helper functions for common validations
4. Follow the existing test structure

## Common Issues

1. **Server not running**: Make sure the server is running on port 3000 before running tests
2. **Database connection**: Ensure mountains.db exists and is accessible
3. **ESM Issues**: We use ES modules, hence the `--experimental-vm-modules` flag 