import { LocalFileSource } from './local-file-source.js';

class TokenStateViewer {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.state = null;
        this.balancesData = [];
        this.vaultsData = [];
        this.filteredBalances = [];
        this.filteredVaults = [];

        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.renderBalances();
            this.hideLoading();
        } catch (error) {
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

        // Balance controls
        document.getElementById('balance-search').addEventListener('input', (e) => {
            this.filterBalances(e.target.value);
        });

        document.getElementById('balance-sort').addEventListener('change', (e) => {
            this.sortBalances(e.target.value);
        });

        // Vault controls
        document.getElementById('vault-search').addEventListener('input', (e) => {
            this.filterVaults(e.target.value);
        });

        document.getElementById('vault-sort').addEventListener('change', (e) => {
            this.sortVaults(e.target.value);
        });
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

    sortBalances(sortType) {
        switch (sortType) {
            case 'balance-desc':
                this.filteredBalances.sort((a, b) => b.balance - a.balance);
                break;
            case 'balance-asc':
                this.filteredBalances.sort((a, b) => a.balance - b.balance);
                break;
            case 'address-asc':
                this.filteredBalances.sort((a, b) => a.address.localeCompare(b.address));
                break;
            case 'address-desc':
                this.filteredBalances.sort((a, b) => b.address.localeCompare(a.address));
                break;
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
            totalSupply.toLocaleString();
        document.getElementById('filtered-count').textContent =
            this.filteredBalances.length.toLocaleString();

        // Render rows
        this.filteredBalances.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.truncateAddress(item.address)}</td>
                <td>${item.balance.toLocaleString()}</td>
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

    sortVaults(sortType) {
        switch (sortType) {
            case 'total-desc':
                this.filteredVaults.sort((a, b) => b.total - a.total);
                break;
            case 'total-asc':
                this.filteredVaults.sort((a, b) => a.total - b.total);
                break;
            case 'address-asc':
                this.filteredVaults.sort((a, b) => a.address.localeCompare(b.address));
                break;
            case 'address-desc':
                this.filteredVaults.sort((a, b) => b.address.localeCompare(a.address));
                break;
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
            totalLocked.toLocaleString();
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
                        <span class="vault-entry-value">${entry.balance.toLocaleString()}</span>
                    </div>
                    <div class="vault-entry-item">
                        <span class="vault-entry-label">Start</span>
                        <span class="vault-entry-value">${entry.start.toLocaleString()}</span>
                    </div>
                    <div class="vault-entry-item">
                        <span class="vault-entry-label">End</span>
                        <span class="vault-entry-value">${entry.end.toLocaleString()}</span>
                    </div>
                </div>
            `).join('');

            card.innerHTML = `
                <div class="vault-header">
                    <span class="vault-address">${this.truncateAddress(vault.address)}</span>
                    <span class="vault-total">${vault.total.toLocaleString()} Total</span>
                </div>
                <div class="vault-entries">
                    ${entriesHtml}
                </div>
            `;

            container.appendChild(card);
        });
    }

    truncateAddress(address, start = 10, end = 10) {
        if (address.length <= start + end) return address;
        return `${address.slice(0, start)}...${address.slice(-end)}`;
    }

    showError(message) {
        const errorEl = document.getElementById('error');
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
