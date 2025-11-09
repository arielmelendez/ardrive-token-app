import { LocalFileSource } from './local-file-source.js';

class TokenStateViewer {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.state = null;
        this.balancesData = [];
        this.vaultsData = [];
        this.filteredBalances = [];
        this.filteredVaults = [];

        // Sort state tracking
        this.balanceSortState = { column: null, direction: null };
        this.vaultSortState = { column: null, direction: null };

        this.init();
    }

    async init() {
        try {
            // Check if running via HTTP
            if (window.location.protocol === 'file:') {
                throw new Error(
                    'This app must be served via HTTP. Please run a local server:\n' +
                    'python3 -m http.server 8000\n' +
                    'Then open http://localhost:8000'
                );
            }

            await this.loadData();
            this.setupEventListeners();
            this.renderBalances();
            this.hideLoading();
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError(error.message);
            this.hideLoading();
        }
    }

    async loadData() {
        // Load the complete state
        this.state = await this.dataSource.fetchState();

        // Display contract ID
        document.getElementById('contractId').textContent =
            `Contract: ${this.state.contractTxId}`;

        // Process balances
        const balances = this.state.state.balances;
        this.balancesData = Object.entries(balances).map(([address, balance]) => ({
            address,
            balance
        }));
        this.filteredBalances = [...this.balancesData];

        // Process vaults
        const vaults = this.state.state.vault || {};
        this.vaultsData = Object.entries(vaults).map(([address, entries]) => {
            const total = entries.reduce((sum, entry) => sum + entry.balance, 0);
            return {
                address,
                entries,
                total
            };
        });
        this.filteredVaults = [...this.vaultsData];
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Balance table column headers
        document.querySelectorAll('#balances-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                this.handleColumnSort(th, 'balance');
            });
        });

        // Balance controls
        document.getElementById('balance-search').addEventListener('input', (e) => {
            this.filterBalances(e.target.value);
        });

        // Vault controls
        document.getElementById('vault-search').addEventListener('input', (e) => {
            this.filterVaults(e.target.value);
        });
    }

    handleColumnSort(th, tableType) {
        const column = th.dataset.column;
        const dataType = th.dataset.type;
        const sortState = tableType === 'balance' ? this.balanceSortState : this.vaultSortState;

        // Determine next sort direction
        if (sortState.column !== column) {
            // Clicked a different column, start with ascending
            sortState.column = column;
            sortState.direction = 'asc';
        } else {
            // Cycle through: asc -> desc -> none
            if (sortState.direction === 'asc') {
                sortState.direction = 'desc';
            } else if (sortState.direction === 'desc') {
                sortState.column = null;
                sortState.direction = null;
            } else {
                sortState.direction = 'asc';
            }
        }

        // Update visual indicators
        const tableSelector = tableType === 'balance' ? '#balances-table' : '#vaults-table';
        this.updateSortIndicators(tableSelector);

        // Sort the data
        if (sortState.column && sortState.direction) {
            this.sortByColumn(column, sortState.direction, dataType, tableType);
        } else {
            // Reset to original order
            if (tableType === 'balance') {
                this.filteredBalances = [...this.balancesData].filter(item =>
                    this.filteredBalances.find(f => f.address === item.address)
                );
                this.renderBalances();
            }
        }
    }

    updateSortIndicators(tableSelector) {
        const table = document.querySelector(tableSelector);
        if (!table) return;

        const sortState = tableSelector.includes('balance') ? this.balanceSortState : this.vaultSortState;

        table.querySelectorAll('th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
            if (sortState.column === th.dataset.column && sortState.direction) {
                th.classList.add(sortState.direction);
            }
        });
    }

    sortByColumn(column, direction, dataType, tableType) {
        const data = tableType === 'balance' ? this.filteredBalances : this.filteredVaults;

        data.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            if (dataType === 'number') {
                aVal = Number(aVal);
                bVal = Number(bVal);
            } else {
                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        if (tableType === 'balance') {
            this.renderBalances();
        } else {
            this.renderVaults();
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        // Render appropriate content
        if (tabName === 'balances') {
            this.renderBalances();
        } else if (tabName === 'vaults') {
            this.renderVaults();
        }
    }

    filterBalances(searchTerm) {
        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            this.filteredBalances = [...this.balancesData];
        } else {
            this.filteredBalances = this.balancesData.filter(item =>
                item.address.toLowerCase().includes(term)
            );
        }

        this.renderBalances();
    }

    renderBalances() {
        const tbody = document.getElementById('balances-tbody');
        tbody.innerHTML = '';

        // Update stats
        const totalSupply = this.balancesData.reduce((sum, item) => sum + item.balance, 0);
        document.getElementById('total-addresses').textContent =
            this.balancesData.length.toLocaleString();
        document.getElementById('total-supply').textContent =
            this.formatNumber(totalSupply);
        document.getElementById('filtered-count').textContent =
            this.filteredBalances.length.toLocaleString();

        // Render rows
        this.filteredBalances.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="address-cell">${item.address}</td>
                <td class="balance-cell">${this.formatNumber(item.balance)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    filterVaults(searchTerm) {
        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            this.filteredVaults = [...this.vaultsData];
        } else {
            this.filteredVaults = this.vaultsData.filter(item =>
                item.address.toLowerCase().includes(term)
            );
        }

        this.renderVaults();
    }

    renderVaults() {
        const container = document.getElementById('vaults-container');
        container.innerHTML = '';

        // Update stats
        const totalLocked = this.vaultsData.reduce((sum, item) => sum + item.total, 0);
        document.getElementById('total-vaults').textContent =
            this.vaultsData.length.toLocaleString();
        document.getElementById('total-locked').textContent =
            this.formatNumber(totalLocked);
        document.getElementById('filtered-vaults-count').textContent =
            this.filteredVaults.length.toLocaleString();

        // Render vault cards
        this.filteredVaults.forEach(vault => {
            const card = document.createElement('div');
            card.className = 'vault-card';

            const entriesHtml = vault.entries.map(entry => `
                <div class="vault-entry">
                    <div class="vault-entry-item">
                        <span class="vault-entry-label">Balance</span>
                        <span class="vault-entry-value">${this.formatNumber(entry.balance)}</span>
                    </div>
                    <div class="vault-entry-item">
                        <span class="vault-entry-label">Start</span>
                        <span class="vault-entry-value">${this.formatNumber(entry.start)}</span>
                    </div>
                    <div class="vault-entry-item">
                        <span class="vault-entry-label">End</span>
                        <span class="vault-entry-value">${this.formatNumber(entry.end)}</span>
                    </div>
                </div>
            `).join('');

            card.innerHTML = `
                <div class="vault-header">
                    <span class="vault-address">${vault.address}</span>
                    <span class="vault-total">${this.formatNumber(vault.total)} Total</span>
                </div>
                <div class="vault-entries">
                    ${entriesHtml}
                </div>
            `;

            container.appendChild(card);
        });
    }

    formatNumber(value) {
        // Format number with up to 6 decimal places, removing trailing zeros
        if (Number.isInteger(value)) {
            return value.toLocaleString();
        }

        // Format with up to 6 decimals, then remove trailing zeros
        const formatted = value.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6
        });
        return formatted;
    }

    truncateAddress(address, start = 10, end = 10) {
        if (address.length <= start + end) return address;
        return `${address.slice(0, start)}...${address.slice(-end)}`;
    }

    showError(message) {
        const errorEl = document.getElementById('error');
        errorEl.style.whiteSpace = 'pre-wrap';
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
}

// Initialize the app with local file data source
const dataSource = new LocalFileSource('./ardrive_token_state.json');
new TokenStateViewer(dataSource);
