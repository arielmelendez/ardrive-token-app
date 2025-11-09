import { DataSource } from './data-source.js';

/**
 * DataSource implementation that fetches state from an API endpoint
 * This is an example implementation for future use
 */
export class ApiSource extends DataSource {
    /**
     * @param {string} apiEndpoint - URL of the API endpoint
     * @param {Object} options - Optional fetch configuration
     */
    constructor(apiEndpoint, options = {}) {
        super();
        this.apiEndpoint = apiEndpoint;
        this.options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };
        this.cachedState = null;
        this.cacheExpiry = null;
        this.cacheDuration = options.cacheDuration || 60000; // 1 minute default
    }

    /**
     * Fetches the token state from an API endpoint
     * @returns {Promise<Object>} Promise resolving to the token state object
     * @throws {Error} If API request fails
     */
    async fetchState() {
        // Check if we have a valid cached state
        if (this.cachedState && this.cacheExpiry && Date.now() < this.cacheExpiry) {
            return this.cachedState;
        }

        try {
            const response = await fetch(this.apiEndpoint, this.options);

            if (!response.ok) {
                throw new Error(
                    `API request failed: ${response.status} ${response.statusText}`
                );
            }

            const data = await response.json();

            // Validate the data structure
            if (!data.state || !data.state.balances) {
                throw new Error('Invalid data structure: missing state.balances');
            }

            // Cache the state
            this.cachedState = data;
            this.cacheExpiry = Date.now() + this.cacheDuration;

            return data;
        } catch (error) {
            // If it's a network error, check if we have stale cache
            if (this.cachedState) {
                console.warn('Using stale cache due to API error:', error.message);
                return this.cachedState;
            }

            throw new Error(`Error fetching from API: ${error.message}`);
        }
    }

    /**
     * Clear the cached state and force a fresh fetch on next request
     */
    clearCache() {
        this.cachedState = null;
        this.cacheExpiry = null;
    }

    /**
     * Set the cache duration
     * @param {number} duration - Cache duration in milliseconds
     */
    setCacheDuration(duration) {
        this.cacheDuration = duration;
    }
}

// Example usage:
// const dataSource = new ApiSource('https://api.example.com/token-state', {
//     cacheDuration: 120000 // 2 minutes
// });
