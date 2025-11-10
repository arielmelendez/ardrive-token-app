# ArDrive Token Toolkit

A simple HTML5/CSS/JavaScript application for visualizing ArDrive token state data, including balances, vaults, and contract settings.

Also provides user interfaces for transferring tokens via interactions signed by Wander Wallet.

## Features

- **Multiple Data Sources**: Choose between example snapshot, live Cache API, or custom sources
- **Balance Explorer**: View, search, filter, and sort token balances by address or amount
- **Vault Viewer**: Explore locked tokens with detailed information about lock periods
- **Modular Data Architecture**: Clean interface-based design for easy data source switching
- **Column Sorting**: Click column headers to sort data with visual indicators
- **Responsive Design**: Works on desktop and mobile devices

## Project Structure

```
ardrive_token_app/
├── index.html              # Main HTML file
├── styles.css              # Stylesheet
├── app.js                  # Main application logic
├── data-source.js          # DataSource interface
├── local-file-source.js    # Local file implementation
├── api-source.js           # API endpoint implementation
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

1. **LocalFileSource**: Loads data from a local JSON file (included example)
2. **ApiSource**: Fetches data from HTTP endpoints (arns.app Cache API supported)
3. **Custom sources**: Extensible architecture for future implementations

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

### Using Data Sources

The application supports multiple data sources:

#### Example Snapshot
Uses the included `ardrive_token_state.json` file. Good for quick testing and offline usage.

#### Cache API
Fetches live token state from the arns.app cache API:
- Default endpoint: `https://api.arns.app/v1/contract/{contractId}?validity=true`
- Default contract: `-8A6RexFkpfWwuyVO98wzSFZh0d6VJuI-buTJvlwOJQ`
- You can enter a different contract address to view other SmartWeave contracts

#### Compute State (Coming Soon)
Placeholder for computing state from transaction history.

**To load data:**
- The app automatically loads data from the Cache API on startup
- You can change the data source and click "Load Data" to reload
- If using Cache API, you can modify the contract address before loading

### Creating a New Data Source

To add a new data source implementation:

1. Create a new class that extends `DataSource`
2. Implement the `fetchState()` method
3. Add the option to the data source selector in `index.html`
4. Update `handleLoadData()` in `app.js` to instantiate your source

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
