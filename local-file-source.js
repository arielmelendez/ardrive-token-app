import { DataSource } from './data-source.js';

/**
 * DataSource implementation that loads state from a local JSON file
 */
export class LocalFileSource extends DataSource {
    /**
     * @param {string} filePath - Path to the JSON file
     */
    constructor(filePath) {
        super();
        this.filePath = filePath;
        this.cachedState = null;
    }

    /**
     * Fetches the token state from a local JSON file
     * @returns {Promise<Object>} Promise resolving to the token state object
     * @throws {Error} If file cannot be loaded or parsed
     */
    async fetchState() {
        // Return cached state if available
        if (this.cachedState) {
            return this.cachedState;
        }

        try {
            console.log('Fetching state from:', this.filePath);
            const response = await fetch(this.filePath);

            if (!response.ok) {
                throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
            }

            console.log('File loaded successfully, parsing JSON...');
            const data = await response.json();

            // Validate the data structure
            if (!data.state || !data.state.balances) {
                throw new Error('Invalid data structure: missing state.balances');
            }

            console.log('Data validated successfully');
            // Cache the state
            this.cachedState = data;
            return data;
        } catch (error) {
            console.error('Error in fetchState:', error);
            throw new Error(`Error loading local file: ${error.message}`);
        }
    }

    /**
     * Clear the cached state (useful for refreshing data)
     */
    clearCache() {
        this.cachedState = null;
    }
}
