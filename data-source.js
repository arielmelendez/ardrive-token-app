/**
 * Interface for retrieving token state data
 * Implementations can fetch from API, local files, or compute the state
 */
export class DataSource {
    /**
     * Fetches the complete token state
     * @returns {Promise<Object>} Promise resolving to the token state object
     * @throws {Error} If data cannot be fetched
     */
    async fetchState() {
        throw new Error('fetchState() must be implemented by subclass');
    }

    /**
     * Get the contract transaction ID
     * @returns {Promise<string>} Promise resolving to the contract ID
     */
    async getContractId() {
        const state = await this.fetchState();
        return state.contractTxId;
    }

    /**
     * Get all balances
     * @returns {Promise<Object>} Promise resolving to balances object
     */
    async getBalances() {
        const state = await this.fetchState();
        return state.state.balances;
    }

    /**
     * Get all vaults
     * @returns {Promise<Object>} Promise resolving to vaults object
     */
    async getVaults() {
        const state = await this.fetchState();
        return state.state.vault;
    }

    /**
     * Get token name
     * @returns {Promise<string>} Promise resolving to token name
     */
    async getTokenName() {
        const state = await this.fetchState();
        return state.state.name;
    }

    /**
     * Get token ticker
     * @returns {Promise<string>} Promise resolving to token ticker
     */
    async getTokenTicker() {
        const state = await this.fetchState();
        return state.state.ticker;
    }
}
