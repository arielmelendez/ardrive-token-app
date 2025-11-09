# ArDrive Token State Viewer

A simple HTML5/CSS/JavaScript application for visualizing ArDrive token state data, including balances and vaults.

## Features

- **Balance Explorer**: View, search, filter, and sort token balances by address or amount
- **Vault Viewer**: Explore locked tokens with detailed information about lock periods
- **Modular Data Architecture**: Clean interface-based design for easy data source switching
- **Responsive Design**: Works on desktop and mobile devices

## Project Structure

```
ardrive_token_app/
├── index.html              # Main HTML file
├── styles.css              # Stylesheet
├── app.js                  # Main application logic
├── data-source.js          # DataSource interface
├── local-file-source.js    # Local file implementation
└── ardrive_token_state.json # Token state data
```

## Architecture

### DataSource Interface

The `DataSource` class in `data-source.js` provides a clean interface for retrieving token state data:

```javascript
export class DataSource {
    async fetchState() { /* ... */ }
    async getContractId() { /* ... */ }
    async getBalances() { /* ... */ }
    async getVaults() { /* ... */ }
    async getTokenName() { /* ... */ }
    async getTokenTicker() { /* ... */ }
}
```

### Implementations

1. **LocalFileSource** (current): Loads data from a local JSON file
2. **Future implementations**: API endpoints, computed state, etc.

## Usage

### Running Locally

Since the app uses ES6 modules, you need to serve it via HTTP:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### Creating a New Data Source

To add a new data source (e.g., API endpoint):

1. Create a new file (e.g., `api-source.js`)
2. Extend the `DataSource` class
3. Implement the `fetchState()` method
4. Update `app.js` to use your new implementation

Example:

```javascript
// api-source.js
import { DataSource } from './data-source.js';

export class ApiSource extends DataSource {
    constructor(apiEndpoint) {
        super();
        this.apiEndpoint = apiEndpoint;
    }

    async fetchState() {
        const response = await fetch(this.apiEndpoint);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        return await response.json();
    }
}

// In app.js, replace:
const dataSource = new LocalFileSource('./ardrive_token_state.json');
// With:
const dataSource = new ApiSource('https://api.example.com/state');
```

## Data Format

The application expects JSON data in the following format:

```json
{
  "contractTxId": "contract-id-here",
  "state": {
    "balances": {
      "address1": 100,
      "address2": 200
    },
    "vault": {
      "address1": [
        {
          "balance": 1000,
          "start": 12345,
          "end": 67890
        }
      ]
    },
    "name": "Token Name",
    "ticker": "TKN"
  }
}
```

## Future Enhancements

- Export data to CSV
- Advanced filtering options
- Vault timeline visualization
- Balance distribution charts
- Historical state comparison
- Address detail view
- Pagination for large datasets

## License

MIT
