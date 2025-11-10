import { LocalFileSource } from './local-file-source.js';
import { ApiSource } from './api-source.js';

class TokenStateViewer {
    constructor() {
        this.dataSource = null;
        this.state = null;
        this.balancesData = [];
        this.vaultsData = [];
        this.filteredBalances = [];
        this.filteredVaults = [];
        this.sourceCode = null;
        this.sourceTxId = null;
        this.walletAddress = null;
        this.walletConnected = false;
        this.arweave = null;

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

            // Initialize Arweave
            this.arweave = window.Arweave.init({
                host: 'arweave.net',
                port: 443,
                protocol: 'https'
            });

            this.setupEventListeners();
            this.setupWallet();

            // Auto-load data with default source (Cache API)
            await this.handleLoadData();
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError(error.message);
            this.hideLoading();
        }
    }

    setupWallet() {
        // Check if Wander wallet is available
        const checkWallet = () => {
            if (window.arweaveWallet) {
                console.log(`Using ${window.arweaveWallet.walletName || 'Wander'} wallet`);
                console.log(`Version: ${window.arweaveWallet.walletVersion || 'unknown'}`);
            }
        };

        // Check immediately
        checkWallet();

        // Also listen for the wallet loaded event
        window.addEventListener('arweaveWalletLoaded', () => {
            checkWallet();
        });

        // Setup wallet button click handler
        document.getElementById('wallet-btn').addEventListener('click', () => {
            if (this.walletConnected) {
                this.showDisconnectModal();
            } else {
                this.connectWallet();
            }
        });

        // Setup modal event handlers
        document.getElementById('cancel-disconnect-btn').addEventListener('click', () => {
            this.hideDisconnectModal();
        });

        document.getElementById('confirm-disconnect-btn').addEventListener('click', () => {
            this.hideDisconnectModal();
            this.disconnectWallet();
        });

        // Close modal when clicking overlay
        document.querySelector('#disconnect-modal .modal-overlay').addEventListener('click', () => {
            this.hideDisconnectModal();
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('disconnect-modal');
                if (modal.style.display !== 'none') {
                    this.hideDisconnectModal();
                }
            }
        });
    }

    showDisconnectModal() {
        document.getElementById('disconnect-modal').style.display = 'flex';
    }

    hideDisconnectModal() {
        document.getElementById('disconnect-modal').style.display = 'none';
    }

    async connectWallet() {
        try {
            if (!window.arweaveWallet) {
                throw new Error('Wander wallet not detected. Please install the Wander extension.');
            }

            // Request permissions
            await window.arweaveWallet.connect(
                ['ACCESS_ADDRESS'],
                {
                    name: 'ArDrive Token State Viewer',
                }
            );

            // Get the active address
            this.walletAddress = await window.arweaveWallet.getActiveAddress();
            this.walletConnected = true;

            this.updateWalletUI();
            this.updateWalletBalances();
        } catch (error) {
            console.error('Error connecting wallet:', error);
            this.showError(`Failed to connect wallet: ${error.message}`);
        }
    }

    async disconnectWallet() {
        try {
            // Actually disconnect from Wander
            if (window.arweaveWallet) {
                await window.arweaveWallet.disconnect();
            }

            this.walletAddress = null;
            this.walletConnected = false;
            this.updateWalletUI();
        } catch (error) {
            console.error('Error disconnecting wallet:', error);
            // Still update UI even if disconnect fails
            this.walletAddress = null;
            this.walletConnected = false;
            this.updateWalletUI();
        }
    }

    updateWalletUI() {
        const walletBtn = document.getElementById('wallet-btn');
        const walletBtnText = document.getElementById('wallet-btn-text');
        const walletInfo = document.getElementById('wallet-info');

        if (this.walletConnected && this.walletAddress) {
            walletBtn.classList.add('connected');
            walletBtnText.textContent = this.truncateAddress(this.walletAddress, 6, 4);
            walletInfo.style.display = 'flex';

            // Update address display
            document.getElementById('wallet-address').textContent = this.walletAddress;

            // Setup copy button for wallet address
            const copyWalletAddressBtn = document.getElementById('copy-wallet-address-btn');
            copyWalletAddressBtn.dataset.originalTitle = 'Copy address';
            copyWalletAddressBtn.onclick = () => this.copyToClipboard(this.walletAddress, copyWalletAddressBtn);
        } else {
            walletBtn.classList.remove('connected');
            walletBtnText.textContent = 'Connect Wallet';
            walletInfo.style.display = 'none';
        }
    }

    updateWalletBalances() {
        if (!this.walletConnected || !this.walletAddress || !this.state) {
            document.getElementById('wallet-balance').textContent = '-';
            document.getElementById('wallet-vaulted').textContent = '-';
            return;
        }

        // Get balance from state
        const balances = this.state.state.balances;
        const balance = balances[this.walletAddress] || 0;
        document.getElementById('wallet-balance').textContent = this.formatNumber(balance);

        // Get vaulted amount from state
        const vaults = this.state.state.vault || {};
        const userVaults = vaults[this.walletAddress] || [];
        const totalVaulted = userVaults.reduce((sum, entry) => sum + entry.balance, 0);
        document.getElementById('wallet-vaulted').textContent = this.formatNumber(totalVaulted);
    }

    async loadData() {
        // Load the complete state
        this.state = await this.dataSource.fetchState();

        // Clear cached source code when loading new data
        this.sourceCode = null;
        this.sourceTxId = null;

        // Display contract ID
        const contractId = this.state.contractTxId;
        document.getElementById('contractId').textContent = `Contract: ${contractId}`;

        // Show and setup copy button for contract
        const copyContractBtn = document.getElementById('copy-contract-btn');
        copyContractBtn.style.display = 'inline-flex';
        copyContractBtn.dataset.originalTitle = 'Copy contract ID';
        copyContractBtn.onclick = () => this.copyToClipboard(contractId, copyContractBtn);

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

        // Update wallet balances if wallet is connected
        if (this.walletConnected) {
            this.updateWalletBalances();
        }
    }

    setupEventListeners() {
        // Data source selection
        document.querySelectorAll('input[name="dataSource"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleDataSourceChange(e.target.value);
            });
        });

        // Load data button
        document.getElementById('load-data-btn').addEventListener('click', () => {
            this.handleLoadData();
        });

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

        // Interact tab controls
        document.getElementById('transfer-preview-btn').addEventListener('click', () => {
            this.previewTransfer();
        });

        document.getElementById('transfer-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitTransfer();
        });

        document.getElementById('new-transfer-btn').addEventListener('click', () => {
            this.resetTransferForm();
        });
    }

    handleDataSourceChange(sourceType) {
        const contractInput = document.getElementById('contract-address');

        switch (sourceType) {
            case 'snapshot':
                contractInput.disabled = true;
                break;
            case 'api':
                contractInput.disabled = false;
                break;
            case 'compute':
                // Will be implemented later
                contractInput.disabled = true;
                break;
        }
    }

    async handleLoadData() {
        const loadBtn = document.getElementById('load-data-btn');
        const selectedSource = document.querySelector('input[name="dataSource"]:checked').value;

        try {
            // Disable button and show loading
            loadBtn.disabled = true;
            loadBtn.textContent = 'Loading...';
            this.showLoading();
            this.clearError();

            // Create the appropriate data source
            switch (selectedSource) {
                case 'snapshot':
                    this.dataSource = new LocalFileSource('./ardrive_token_state.json');
                    break;
                case 'api':
                    const contractAddress = document.getElementById('contract-address').value.trim();
                    if (!contractAddress) {
                        throw new Error('Please enter a contract address');
                    }
                    const apiEndpoint = `https://api.arns.app/v1/contract/${contractAddress}?validity=true`;
                    this.dataSource = new ApiSource(apiEndpoint);
                    break;
                case 'compute':
                    throw new Error('Compute State source not yet implemented');
                default:
                    throw new Error('Please select a data source');
            }

            // Load the data
            await this.loadData();
            this.renderBalances();
            this.hideLoading();

            loadBtn.textContent = 'Load Data';
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError(error.message);
            this.hideLoading();
            loadBtn.textContent = 'Load Data';
        } finally {
            loadBtn.disabled = false;
        }
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
        } else if (tabName === 'source') {
            this.loadAndRenderSourceCode();
        }
    }

    async loadAndRenderSourceCode() {
        if (!this.state) {
            document.getElementById('source-code-content').textContent = '// Please load contract data first';
            return;
        }

        // If we already have the source code, just render it
        if (this.sourceCode && this.sourceTxId) {
            this.renderSourceCode();
            return;
        }

        try {
            document.getElementById('source-code-content').textContent = '// Loading source code...';

            // Get contract ID
            const contractId = this.state.contractTxId;

            // Fetch source transaction ID from GraphQL
            const sourceTxId = await this.fetchSourceTxId(contractId);
            this.sourceTxId = sourceTxId;

            // Fetch the actual source code
            const sourceCode = await this.fetchSourceCode(sourceTxId);
            this.sourceCode = sourceCode;

            this.renderSourceCode();
        } catch (error) {
            console.error('Error loading source code:', error);
            document.getElementById('source-code-content').textContent =
                `// Error loading source code: ${error.message}`;
        }
    }

    async fetchSourceTxId(contractId) {
        const query = `
            {
                transactions(ids: ["${contractId}"]) {
                    edges {
                        node {
                            tags {
                                name
                                value
                            }
                        }
                    }
                }
            }
        `;

        const response = await fetch('https://arweave.net/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.errors) {
            throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
        }

        const edges = result.data.transactions.edges;
        if (!edges || edges.length === 0) {
            throw new Error('Contract transaction not found');
        }

        const tags = edges[0].node.tags;
        const contractSrcTag = tags.find(tag => tag.name === 'Contract-Src');

        if (!contractSrcTag) {
            throw new Error('Contract-Src tag not found');
        }

        return contractSrcTag.value;
    }

    async fetchSourceCode(sourceTxId) {
        const response = await fetch(`https://arweave.net/${sourceTxId}`, {
            redirect: 'follow'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch source code: ${response.status} ${response.statusText}`);
        }

        const sourceCode = await response.text();
        return sourceCode;
    }

    renderSourceCode() {
        // Update source TX ID display
        document.getElementById('source-tx-id').textContent = this.sourceTxId;

        const copySourceTxBtn = document.getElementById('copy-source-tx-btn');
        copySourceTxBtn.style.display = 'inline-flex';
        copySourceTxBtn.dataset.originalTitle = 'Copy source TX ID';
        copySourceTxBtn.onclick = () => this.copyToClipboard(this.sourceTxId, copySourceTxBtn);

        // Update code viewer
        document.getElementById('source-code-content').textContent = this.sourceCode;

        // Setup copy code button
        const copyCodeBtn = document.getElementById('copy-code-btn');
        copyCodeBtn.style.display = 'inline-flex';
        copyCodeBtn.dataset.originalTitle = 'Copy code';
        copyCodeBtn.onclick = () => this.copyToClipboard(this.sourceCode, copyCodeBtn);
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

            // Address cell (text only)
            const addressCell = document.createElement('td');
            addressCell.className = 'address-cell';
            addressCell.textContent = item.address;

            // Copy button cell
            const copyCell = document.createElement('td');
            copyCell.className = 'copy-column';
            const copyBtn = this.createCopyButton(item.address);
            copyCell.appendChild(copyBtn);

            // Balance cell
            const balanceCell = document.createElement('td');
            balanceCell.className = 'balance-cell';
            balanceCell.textContent = this.formatNumber(item.balance);

            row.appendChild(addressCell);
            row.appendChild(copyCell);
            row.appendChild(balanceCell);
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

            // Create header
            const header = document.createElement('div');
            header.className = 'vault-header';

            // Address with copy button
            const vaultAddressDiv = document.createElement('div');
            vaultAddressDiv.className = 'vault-address';

            const addressText = document.createElement('span');
            addressText.className = 'address-text';
            addressText.textContent = vault.address;

            const copyBtn = this.createCopyButton(vault.address);

            vaultAddressDiv.appendChild(addressText);
            vaultAddressDiv.appendChild(copyBtn);

            // Total
            const totalSpan = document.createElement('span');
            totalSpan.className = 'vault-total';
            totalSpan.textContent = `${this.formatNumber(vault.total)} Total`;

            header.appendChild(vaultAddressDiv);
            header.appendChild(totalSpan);

            // Create entries container
            const entriesContainer = document.createElement('div');
            entriesContainer.className = 'vault-entries';

            vault.entries.forEach(entry => {
                const entryDiv = document.createElement('div');
                entryDiv.className = 'vault-entry';
                entryDiv.innerHTML = `
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
                `;
                entriesContainer.appendChild(entryDiv);
            });

            card.appendChild(header);
            card.appendChild(entriesContainer);
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

    clearError() {
        const errorEl = document.getElementById('error');
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    createCopyButton(text) {
        const button = document.createElement('button');
        button.className = 'copy-btn';
        button.title = 'Copy address';
        button.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        button.onclick = (e) => {
            e.stopPropagation();
            this.copyToClipboard(text, button);
        };
        return button;
    }

    async copyToClipboard(text, button) {
        try {
            await navigator.clipboard.writeText(text);

            // Visual feedback
            button.classList.add('copied');
            const originalTitle = button.dataset.originalTitle || button.title;
            button.title = 'Copied!';

            // Reset after 2 seconds
            setTimeout(() => {
                button.classList.remove('copied');
                button.title = originalTitle;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            const originalTitle = button.dataset.originalTitle || button.title;
            button.title = 'Failed to copy';
            setTimeout(() => {
                button.title = originalTitle;
            }, 2000);
        }
    }

    previewTransfer() {
        const target = document.getElementById('transfer-target').value.trim();
        const qty = parseInt(document.getElementById('transfer-qty').value);

        if (!target || !qty || qty <= 0) {
            this.showError('Please fill in all required fields with valid values.');
            return;
        }

        // Hide any previous transaction ID display
        document.getElementById('transaction-id-display').style.display = 'none';

        // Update preview
        document.getElementById('preview-target').textContent = target;
        document.getElementById('preview-qty').textContent = this.formatNumber(qty);
        document.getElementById('preview-contract').textContent = this.state?.contractTxId || '-';

        // Show preview
        document.getElementById('transfer-preview').style.display = 'block';
        this.clearError();
    }

    async submitTransfer() {
        const target = document.getElementById('transfer-target').value.trim();
        const qty = parseInt(document.getElementById('transfer-qty').value);

        // Validate wallet connection
        if (!this.walletConnected || !this.walletAddress) {
            this.showError('Please connect your wallet first.');
            return;
        }

        // Validate contract state loaded
        if (!this.state || !this.state.contractTxId) {
            this.showError('Please load contract data first.');
            return;
        }

        // Validate inputs
        if (!target || !qty || qty <= 0) {
            this.showError('Please fill in all required fields with valid values.');
            return;
        }

        // Validate target is not sender
        if (target === this.walletAddress) {
            this.showError('Cannot transfer to yourself.');
            return;
        }

        // Check balance
        const balance = this.state.state.balances[this.walletAddress] || 0;
        if (balance < qty) {
            this.showError(`Insufficient balance. You have ${this.formatNumber(balance)} tokens.`);
            return;
        }

        try {
            // Disable submit button
            const submitBtn = document.getElementById('transfer-submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            this.clearError();

            // Create the SmartWeave interaction
            const result = await this.dispatchSmartWeaveInteraction(
                this.state.contractTxId,
                {
                    function: 'transfer',
                    target: target,
                    qty: qty
                }
            );

            // Show transaction ID below the form
            document.getElementById('form-tx-id').textContent = result.id;
            document.getElementById('transaction-id-display').style.display = 'flex';

            // Setup copy button for transaction ID
            const copyTxIdBtn = document.getElementById('copy-form-tx-id-btn');
            copyTxIdBtn.dataset.originalTitle = 'Copy transaction ID';
            copyTxIdBtn.onclick = () => this.copyToClipboard(result.id, copyTxIdBtn);

            console.log(`Transaction dispatched as ${result.type} transaction`);

            // Re-enable button
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
                </svg>
                Transfer Tokens
            `;

            // Reset form for next transfer
            document.getElementById('transfer-form').reset();
        } catch (error) {
            console.error('Error submitting transfer:', error);
            this.showError(`Failed to submit transfer: ${error.message}`);

            // Re-enable button
            const submitBtn = document.getElementById('transfer-submit-btn');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
                </svg>
                Transfer Tokens
            `;
        }
    }

    async dispatchSmartWeaveInteraction(contractId, input) {
        if (!window.arweaveWallet) {
            throw new Error('Wander wallet not detected.');
        }

        if (!this.arweave) {
            throw new Error('Arweave not initialized.');
        }

        // Request SIGN_TRANSACTION permission
        await window.arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION']);

        // Create an Arweave transaction with empty data for SmartWeave interactions
        const transaction = await this.arweave.createTransaction({
            data: '1984' // Dummy data to avoid empty transaction
        });

        // Add SmartWeave interaction tags
        transaction.addTag('App-Name', 'SmartWeaveAction');
        transaction.addTag('App-Version', '0.3.0');
        transaction.addTag('Contract', contractId);
        transaction.addTag('Input', JSON.stringify(input));

        // Sign the transaction using arweave-js (will delegate to Wander)
        await this.arweave.transactions.sign(transaction);

        // Post the transaction to the network
        const response = await this.arweave.transactions.post(transaction);

        if (response.status !== 200) {
            throw new Error(`Failed to post transaction: ${response.status} ${response.statusText}`);
        }

        // Return transaction ID
        return {
            id: transaction.id,
            type: 'BASE'
        };
    }

    resetTransferForm() {
        // Reset form
        document.getElementById('transfer-form').reset();

        // Hide transaction ID display
        document.getElementById('transaction-id-display').style.display = 'none';

        // Show form, hide preview and result
        document.getElementById('transfer-form').style.display = 'flex';
        document.getElementById('transfer-preview').style.display = 'none';
        document.getElementById('transfer-result').style.display = 'none';

        this.clearError();
    }
}

// Initialize the app
new TokenStateViewer();
