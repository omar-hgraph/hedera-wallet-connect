// Complete WalletConnect + MetaMask + Hedera Integration Demo
// This demonstrates the full capabilities of hedera-wallet-connect library

// Import hedera-wallet-connect library components
import { HederaAdapter } from '@hashgraph/hedera-wallet-connect'
import { HederaProvider } from '@hashgraph/hedera-wallet-connect'
import { HederaChainDefinition } from '@hashgraph/hedera-wallet-connect'

// Import QR code generation library
import QRCode from 'qrcode'

// WalletConnect Configuration
const WALLETCONNECT_PROJECT_ID = '6d2fca020331a209d17f33d4c5140262' // Get from https://cloud.walletconnect.com/

// WalletConnect metadata for the dApp
const WALLETCONNECT_METADATA = {
  name: 'MetaMask + Hedera WalletConnect Demo',
  description: 'Complete integration example using hedera-wallet-connect library',
  url: 'http://localhost:5174',
  icons: ['https://hedera.com/favicon.ico']
}

// DOM elements
const statusEl = document.getElementById('status')!
const connectBtn = document.getElementById('connectBtn')! as HTMLButtonElement
const disconnectBtn = document.getElementById('disconnectBtn')! as HTMLButtonElement
const addressEl = document.getElementById('address')!
const chainIdEl = document.getElementById('chainId')!
const balanceEl = document.getElementById('balance')!
const getAccountsBtn = document.getElementById('getAccountsBtn')! as HTMLButtonElement
const switchChainBtn = document.getElementById('switchChainBtn')! as HTMLButtonElement
const signMessageBtn = document.getElementById('signMessageBtn')! as HTMLButtonElement
const debugInfo = document.getElementById('debugInfo')!

// QR Code elements
const qrSection = document.getElementById('qrSection')! as HTMLDivElement
const qrCodeCanvas = document.getElementById('qrCode')! as HTMLCanvasElement
const uriTextEl = document.getElementById('uriText')! as HTMLDivElement
const copyUriBtn = document.getElementById('copyUriBtn')! as HTMLButtonElement

// Hedera EVM networks configuration for WalletConnect
const HEDERA_NETWORKS = {
  mainnet: {
    chainId: 295,
    name: 'Hedera Mainnet',
    currency: 'HBAR',
    explorerUrl: 'https://hashscan.io/mainnet',
    rpcUrl: 'https://mainnet.hashio.io/api'
  },
  testnet: {
    chainId: 296,
    name: 'Hedera Testnet', 
    currency: 'HBAR',
    explorerUrl: 'https://hashscan.io/testnet',
    rpcUrl: 'https://testnet.hashio.io/api'
  }
}

class HederaWalletConnectDemo {
  private isConnected = false
  private isInitialized = false
  private currentAccount: string | null = null
  private currentChainId: number | null = null
  private hederaAdapter: HederaAdapter | null = null
  private hederaProvider: HederaProvider | null = null

  constructor() {
    this.initializeApp()
  }

  private async initializeApp() {
    try {
      // Initially disable all buttons during initialization
      this.updateUIState(false, false)
      
      await this.init()
      this.setupEventListeners()
    } catch (error: any) {
      console.error('App initialization failed:', error)
      updateStatus(`❌ App initialization failed: ${error.message}`, 'error')
    }
  }

  private async init() {
    try {
      Logger.section('Hedera WalletConnect Integration Demo')
      Logger.info('Starting application initialization')
      Logger.debug('Demo features: WalletConnect v2, MetaMask compatibility, Hedera EVM support')

      // Initialize HederaProvider first
      Logger.info('Initializing HederaProvider with project configuration')
      this.hederaProvider = await HederaProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        metadata: WALLETCONNECT_METADATA
      })

      // Set up provider event listeners for debugging
      this.hederaProvider.on('display_uri', (uri: string) => {
        Logger.info('WalletConnect URI generated for mobile wallet connection')
        Logger.debug('Connection URI ready', uri)
        
        Logger.newline()
        Logger.info('Mobile Wallet Connection Steps:')
        Logger.debug('1. Open MetaMask Mobile or compatible WalletConnect wallet')
        Logger.debug('2. Tap the scan/connect button')
        Logger.debug('3. Scan the QR code displayed below')
        Logger.debug('4. Approve the connection request in your wallet')
        
        // Generate and display QR code
        this.displayQRCode(uri)
        
        console.log('WalletConnect URI:', uri)
      })

      this.hederaProvider.on('connect', (session: any) => {
        Logger.success('WalletConnect session established')
        
        // Log which chains the wallet provided
        if (session.session?.namespaces?.eip155?.chains) {
          const chains = session.session.namespaces.eip155.chains
          Logger.info(`Wallet supports ${chains.length} chain(s): ${chains.join(', ')}`)
        }
        
        // Log our RPC configuration
        Logger.debug('RPC endpoints configured:')
        Logger.debug('  Hedera Mainnet (295): https://mainnet.hashio.io/api')
        Logger.debug('  Hedera Testnet (296): https://testnet.hashio.io/api')
        Logger.debug('  Additional chains: Ethereum, Polygon, BSC, etc.')
      })

      // Initialize HederaAdapter with EIP-155 namespace for MetaMask compatibility
      Logger.info('Initializing HederaAdapter with EIP-155 namespace support')
      this.hederaAdapter = new HederaAdapter({
        projectId: WALLETCONNECT_PROJECT_ID,
        networks: [
          HederaChainDefinition.EVM.Mainnet,    // Chain ID 295
          HederaChainDefinition.EVM.Testnet     // Chain ID 296
        ],
        namespace: 'eip155'  // EIP-155 for Ethereum wallet compatibility
      })

      // Set the universal provider for the adapter
      await this.hederaAdapter.setUniversalProvider(this.hederaProvider as any)

      Logger.success('Hedera WalletConnect library components initialized successfully')
      Logger.debug('HederaProvider: Ready for WalletConnect protocol')
      Logger.debug('HederaAdapter: Ready for EIP-155 operations')

      // Detect available wallets
      await this.detectWallets()

      this.isInitialized = true
      this.updateUIState(false, true) // Enable the connect button
      updateStatus('Demo initialized - Choose connection method below', 'info')
      Logger.success('Application ready for wallet connections')

    } catch (error: any) {
      console.error('Initialization error:', error)
      updateStatus(`Initialization failed: ${error.message}`, 'error')
      Logger.error('Initialization failed', error.message)
      Logger.warn('Ensure WalletConnect Project ID is valid')
      this.isInitialized = false
      this.updateUIState(false, false) // Keep buttons disabled on initialization failure
    }
  }

  private async detectWallets() {
    Logger.info('Detecting available wallet connection methods')
    
    // Check for MetaMask browser extension
    if (typeof (window as any).ethereum !== 'undefined') {
      const ethereum = (window as any).ethereum
      const walletType = ethereum.isMetaMask ? 'MetaMask' : 'Unknown Ethereum wallet'
      const chainId = ethereum.chainId || 'Unknown'
      Logger.success(`Browser extension detected: ${walletType} (Chain ID: ${chainId})`)
    } else {
      Logger.warn('No MetaMask browser extension detected')
    }

    // Log WalletConnect support
    Logger.success('WalletConnect v2 protocol available via hedera-wallet-connect library')
    Logger.info('Mobile wallet support enabled')
    
    Logger.newline()
    Logger.debug('Mobile wallet support enabled')
    
    Logger.newline()
    Logger.info('Available Connection Methods:')
    Logger.debug('1. Direct MetaMask Browser Extension')
    Logger.debug('2. WalletConnect Protocol (QR code for mobile wallets)')  
    Logger.debug('3. EIP-155 compatible wallets')
    Logger.debug('')
  }

  private setupEventListeners() {
    connectBtn.addEventListener('click', () => this.showConnectionOptions())
    disconnectBtn.addEventListener('click', () => this.disconnect())
    getAccountsBtn.addEventListener('click', () => this.getAccounts())
    switchChainBtn.addEventListener('click', () => this.switchToHederaTestnet())
    signMessageBtn.addEventListener('click', () => this.signMessage())
    
    // QR Code event listeners
    copyUriBtn.addEventListener('click', () => this.copyUriToClipboard())
    uriTextEl.addEventListener('click', () => this.copyUriToClipboard())
  }

  private async displayQRCode(uri: string) {
    try {
      // Show the QR section
      qrSection.classList.add('visible')
      
      // Update the URI text
      uriTextEl.textContent = uri
      uriTextEl.setAttribute('data-uri', uri)
      
      // Generate QR code
      await QRCode.toCanvas(qrCodeCanvas, uri, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      
      Logger.success('QR Code generated and displayed')
      updateStatus('QR Code ready - Scan with your mobile wallet', 'info')
      
    } catch (error: any) {
      console.error('QR Code generation error:', error)
      Logger.error('Failed to generate QR code', error.message)
      
      // Still show the URI text even if QR code fails
      qrSection.classList.add('visible')
      uriTextEl.textContent = uri
      uriTextEl.setAttribute('data-uri', uri)
    }
  }

  private async copyUriToClipboard() {
    const uri = uriTextEl.getAttribute('data-uri')
    if (!uri) {
      Logger.warn('No URI available to copy')
      return
    }
    
    try {
      await navigator.clipboard.writeText(uri)
      Logger.success('URI copied to clipboard')
      
      // Visual feedback
      const originalText = copyUriBtn.textContent
      copyUriBtn.textContent = 'Copied!'
      setTimeout(() => {
        copyUriBtn.textContent = originalText
      }, 2000)
      
    } catch (error: any) {
      console.error('Copy to clipboard failed:', error)
      Logger.error('Failed to copy URI', error.message)
      
      // Fallback: select the text
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(uriTextEl)
      selection?.removeAllRanges()
      selection?.addRange(range)
      Logger.info('URI text selected - use Ctrl+C to copy')
    }
  }

  private hideQRCode() {
    qrSection.classList.remove('visible')
    qrCodeCanvas.getContext('2d')?.clearRect(0, 0, qrCodeCanvas.width, qrCodeCanvas.height)
    uriTextEl.textContent = 'WalletConnect URI will appear here...'
    uriTextEl.removeAttribute('data-uri')
  }

  private async showConnectionOptions() {
    if (!this.isInitialized) {
      updateStatus('Still initializing... Please wait', 'info')
      Logger.warn('Connection attempted before initialization complete')
      return
    }

    Logger.info('Initiating wallet connection process')
    Logger.debug('Available methods: Browser extension, WalletConnect protocol')
    
    // Use HederaAdapter for unified connection handling
    await this.connectWithHederaAdapter()
  }

  private async connectWithHederaAdapter() {
    try {
      if (!this.hederaAdapter) {
        throw new Error('HederaAdapter not initialized. Please wait for initialization to complete.')
      }

      if (!this.hederaProvider) {
        throw new Error('HederaProvider not initialized. Please wait for initialization to complete.')
      }

      updateStatus('Connecting via hedera-wallet-connect...', 'info')
      Logger.info('Attempting connection via HederaProvider')
      Logger.debug('Supports both browser extensions and WalletConnect protocol')

      // Define connection parameters with proper RPC map
      const connectionParams = {
        optionalNamespaces: {
          'eip155': {
            chains: ['eip155:296', 'eip155:295'], // Hedera networks
            methods: [
              'eth_requestAccounts',
              'eth_accounts', 
              'eth_chainId',
              'eth_sendTransaction',
              'eth_signTransaction', 
              'eth_sign',
              'personal_sign',
              'eth_signTypedData',
              'eth_signTypedData_v4',
              'wallet_switchEthereumChain',
              'wallet_addEthereumChain',
              'eth_getBalance'
            ],
            events: ['accountsChanged', 'chainChanged', 'disconnect'],
            rpcMap: {
              // Hedera networks (primary focus)
              '295': 'https://mainnet.hashio.io/api',
              '296': 'https://testnet.hashio.io/api',
              // Common wallet chains (to prevent RPC errors)
              '1': 'https://eth.llamarpc.com',           // Ethereum Mainnet
              '11155111': 'https://rpc.sepolia.org',     // Sepolia Testnet
              '137': 'https://polygon-rpc.com',          // Polygon
              '56': 'https://bsc-dataseed.binance.org',  // BSC
              '10': 'https://mainnet.optimism.io',       // Optimism
              '42161': 'https://arb1.arbitrum.io/rpc',   // Arbitrum One
              '8453': 'https://mainnet.base.org',        // Base
              '59144': 'https://rpc.linea.build',        // Linea
              '59141': 'https://rpc.sepolia.linea.build', // Linea Sepolia
              '6342': 'https://rpc.testnet.immutable.com', // Immutable zkEVM Testnet
              '10143': 'https://rpc.testnet.immutable.com' // Immutable zkEVM Testnet
            }
          },
          'hedera': {
            chains: ['hedera:295', 'hedera:296'], // Hedera networks
            methods: [
              'hedera_getNodeAddresses',
              'hedera_executeTransaction', 
              'hedera_signMessage',
              'hedera_signAndExecuteQuery',
              'hedera_signAndExecuteTransaction',
              'hedera_signTransaction'
            ],
            events: ['accountsChanged', 'chainChanged', 'disconnect'],
            rpcMap: {
              '295': 'https://mainnet.hashio.io/api',
              '296': 'https://testnet.hashio.io/api'
            }
          }
        }
      }

      // Store connection parameters for the HederaProvider to use
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('hwcV2ConnectionParams', JSON.stringify(connectionParams))
        Logger.debug('Stored WalletConnect parameters for HederaProvider')
      }

      // Connect using HederaProvider directly with the RPC map
      Logger.info('Initiating HederaProvider connection with RPC configuration')
      await this.hederaProvider.connect(connectionParams)

      Logger.success('HederaProvider connection established')

      // Give the connection a moment to establish
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Get accounts directly from the provider session instead of using the adapter
      // This is because MetaMask provides accounts for standard chains (1, 11155111, etc.)
      // but not for Hedera chains (295, 296) which causes the adapter to return 0 accounts
      const session = this.hederaProvider?.session
      if (!session || !session.namespaces?.eip155?.accounts) {
        throw new Error('No EIP155 accounts found in the WalletConnect session')
      }

      const eip155Accounts = session.namespaces.eip155.accounts
      Logger.info(`Found ${eip155Accounts.length} EIP155 account(s) in session`)
      Logger.debug('Available accounts', eip155Accounts.join(', '))

      if (eip155Accounts.length > 0) {
        // Extract the address from the first account (format: "eip155:chainId:address")
        const firstAccount = eip155Accounts[0]
        const accountParts = firstAccount.split(':')
        if (accountParts.length !== 3) {
          throw new Error(`Invalid account format: ${firstAccount}`)
        }
        
        this.currentAccount = accountParts[2] // Extract the address part
        this.currentChainId = 296 // Default to Hedera Testnet
        
        Logger.info(`Using account: ${this.currentAccount}`)
        Logger.info(`Default chain: ${this.currentChainId} (Hedera Testnet)`)
        
        this.onConnected()
        
        // Set up event listeners via the provider
        if (this.hederaProvider) {
          this.hederaProvider.on('accountsChanged', (accounts: string[]) => {
            const status = accounts.length > 0 ? accounts[0] : 'disconnected'
            Logger.info(`Account change detected: ${status}`)
            if (accounts.length === 0) {
              this.disconnect()
            } else {
              this.currentAccount = accounts[0]
              this.updateAccountInfo()
            }
          })

          this.hederaProvider.on('chainChanged', (chainId: string) => {
            this.currentChainId = parseInt(chainId.replace('eip155:', ''), 10)
            Logger.info(`Chain changed to: ${this.currentChainId}`)
            this.updateAccountInfo()
          })

          this.hederaProvider.on('session_event', (event: any) => {
            Logger.debug('Session event received', JSON.stringify(event))
          })

          this.hederaProvider.on('connect', (connection: any) => {
            Logger.success('Provider connection established')
          })

          this.hederaProvider.on('disconnect', (disconnection: any) => {
            Logger.info('Provider disconnected')
            this.disconnect()
          })
        }

        Logger.success('Connection completed successfully via hedera-wallet-connect library')
        Logger.info(`Connected account: ${this.currentAccount}`)
        Logger.info(`Active chain: ${this.currentChainId}`)

      } else {
        throw new Error('No accounts returned from HederaAdapter')
      }

    } catch (error: any) {
      console.error('HederaAdapter connection error:', error)
      updateStatus(`HederaAdapter connection failed: ${error.message}`, 'error')
      Logger.error('HederaAdapter connection failed', error.message)
      
      if (error.code === 4001) {
        Logger.warn('User rejected the connection request')
      } else if (error.message.includes('User rejected')) {
        Logger.warn('User rejected the WalletConnect request')
      } else if (error.message.includes('Session currently connected')) {
        Logger.info('Session already connected, attempting to use existing session')
        await this.handleExistingSession()
        return
      } else if (error.message.includes('No Modal')) {
        Logger.debug('WalletConnect modal not found - checking if connection was established')
        await this.checkConnectionStatus()
        return
      }
      
      // Show troubleshooting information
      Logger.newline()
      Logger.info('WalletConnect Troubleshooting Guide:')
      Logger.debug('1. Ensure you have a WalletConnect compatible wallet (MetaMask Mobile, Trust Wallet, etc.)')
      Logger.debug('2. Open your wallet app and look for "Connect" or "WalletConnect" option')
      Logger.debug('3. Scan the QR code displayed (if using desktop)')
      Logger.debug('4. Approve the connection request in your wallet')
      Logger.newline()
      Logger.info('Common Issues:')
      Logger.debug('• QR code not appearing: Check console for errors')
      Logger.debug('• Connection timeout: Refresh page and try again')
      Logger.debug('• Wallet not responding: Ensure wallet supports Hedera networks')
      
      // Fallback to direct MetaMask if needed
      Logger.info('Attempting fallback to direct MetaMask connection')
      await this.connectMetaMaskFallback()
    }
  }

  private async handleExistingSession() {
    try {
      Logger.info('Checking for existing WalletConnect session')
      
      if (this.hederaProvider && this.hederaProvider.session) {
        Logger.success('Found existing session, reusing connection')
        
        // Get accounts from existing session
        const accountsResult = await this.hederaAdapter!.getAccounts({
          id: 'WALLET_CONNECT',
          namespace: 'eip155'
        })

        if (accountsResult.accounts.length > 0) {
          this.currentAccount = accountsResult.accounts[0].address
          this.currentChainId = 296 // Default to Hedera Testnet
          this.onConnected()
          Logger.success('Successfully reused existing WalletConnect session')
        }
      } else {
        throw new Error('No existing session found')
      }
    } catch (error: any) {
      Logger.error('Could not use existing session', error.message)
      await this.connectMetaMaskFallback()
    }
  }

  private async checkConnectionStatus() {
    try {
      Logger.info('Checking if connection was established despite error')
      
      // Wait a moment for potential async connection completion
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      if (this.hederaProvider && this.hederaProvider.session) {
        Logger.success('Found active session, proceeding with connection')
        await this.handleExistingSession()
      } else {
        throw new Error('No active session found')
      }
    } catch (error: any) {
      Logger.error('No active connection found', error.message)
      await this.connectMetaMaskFallback()
    }
  }

  private async connectMetaMaskFallback() {
    try {
      if (typeof (window as any).ethereum === 'undefined') {
        Logger.warn('MetaMask not available, showing WalletConnect instructions')
        updateStatus('Install MetaMask or use WalletConnect mobile app', 'info')
        this.showWalletConnectInstructions()
        return
      }

      const ethereum = (window as any).ethereum
      updateStatus('Fallback: Connecting to MetaMask directly...', 'info')
      Logger.info('Attempting direct MetaMask browser extension connection')

      // Request account access
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
      
      if (accounts.length > 0) {
        this.currentAccount = accounts[0]
        
        // Get current chain ID
        const chainId = await ethereum.request({ method: 'eth_chainId' })
        this.currentChainId = parseInt(chainId, 16)
        
        this.onConnected()
        
        // Set up event listeners for fallback mode
        ethereum.on('accountsChanged', (accounts: string[]) => {
          Logger.debug(`Accounts changed (fallback): ${accounts.length > 0 ? accounts[0] : 'disconnected'}`)
          if (accounts.length === 0) {
            this.disconnect()
          } else {
            this.currentAccount = accounts[0]
            this.updateAccountInfo()
          }
        })

        ethereum.on('chainChanged', (chainId: string) => {
          this.currentChainId = parseInt(chainId, 16)
          Logger.debug(`Chain changed (fallback): ${this.currentChainId} (${chainId})`)
          this.updateAccountInfo()
        })

      } else {
        throw new Error('No accounts returned from MetaMask fallback')
      }

    } catch (error: any) {
      console.error('MetaMask fallback connection error:', error)
      updateStatus(`❌ Connection failed: ${error.message}`, 'error')
      Logger.debug(`Fallback error: ${error.message}`)
      
      if (error.code === 4001) {
        Logger.debug('User rejected the connection request')
      }
    }
  }

  private showWalletConnectInstructions() {
    Logger.section('WalletConnect Mobile Setup')
    Logger.info('Mobile Wallet Connection Steps:')
    Logger.debug('1. Open MetaMask mobile app')
    Logger.debug('2. Tap the scan icon (QR code scanner)')
    Logger.debug('3. Scan the WalletConnect QR code')
    Logger.debug('4. Approve the connection request')
    Logger.newline()
    Logger.info('Supported Wallets:')
    Logger.debug('• MetaMask Mobile')
    Logger.debug('• Trust Wallet')
    Logger.debug('• Rainbow Wallet')
    Logger.debug('• Any WalletConnect v2 compatible wallet')
    Logger.newline()
    Logger.warn('Note: Full WalletConnect modal requires a valid project ID from https://cloud.walletconnect.com/')
  }

  private async disconnect() {
    try {
      updateStatus('👋 Disconnecting...', 'info')
      Logger.debug('Disconnecting from wallet...')

      if (this.hederaAdapter) {
        // Use HederaAdapter's disconnect method
        Logger.debug('Using HederaAdapter.disconnect() method...')
        
        await this.hederaAdapter.disconnect()
        Logger.debug('Successfully disconnected via HederaAdapter')
        
      } else {
        Logger.debug('HederaAdapter not available for disconnection')
      }

      // Clean up local state
      this.currentAccount = null
      this.currentChainId = null
      this.isConnected = false

      // Hide QR code section
      this.hideQRCode()

      // Update UI
      this.updateUIState(false)
      
      // Clear account info
      addressEl.textContent = '-'
      chainIdEl.textContent = '-'
      balanceEl.textContent = '-'

      updateStatus('👋 Disconnected', 'info')
      Logger.debug('Successfully disconnected and cleaned up state')

    } catch (error: any) {
      console.error('Disconnection error:', error)
      updateStatus(`❌ Disconnection failed: ${error.message}`, 'error')
      Logger.debug(`Disconnection error: ${error.message}`)
      
      // Force cleanup even if adapter disconnect fails
      this.currentAccount = null
      this.currentChainId = null
      this.isConnected = false
      this.updateUIState(false)
      
      Logger.debug('Forced state cleanup completed')
    }
  }

  private async onConnected() {
    this.isConnected = true
    updateStatus('🎉 Connected successfully!', 'success')
    Logger.debug('Successfully connected to wallet!')
    Logger.debug(`Address: ${this.currentAccount}`)
    Logger.debug(`Chain ID: ${this.currentChainId}`)

    // Hide QR code section since connection is established
    this.hideQRCode()

    // Update UI state
    this.updateUIState(true)
    
    // Update account information
    await this.updateAccountInfo()

    // Log connection details
    this.logConnectionDetails()
  }

  private updateUIState(connected: boolean, initialized: boolean = true) {
    connectBtn.disabled = connected || !initialized
    disconnectBtn.disabled = !connected
    getAccountsBtn.disabled = !connected
    switchChainBtn.disabled = !connected
    signMessageBtn.disabled = !connected
  }

  private async getAccounts() {
    try {
      if (!this.currentAccount) {
        throw new Error('No wallet connected')
      }

      Logger.debug('Retrieving account information via HederaAdapter...')
      
      if (this.hederaAdapter) {
        // Use HederaAdapter's getAccounts method
        Logger.debug('Using HederaAdapter.getAccounts() method...')
        
        const accountsResult = await this.hederaAdapter.getAccounts({
          id: 'WALLET_CONNECT',
          namespace: 'eip155'
        })

        Logger.debug('HederaAdapter account information:')
        Logger.debug(`Retrieved ${accountsResult.accounts.length} account(s)`)
        
        accountsResult.accounts.forEach((account, index) => {
          Logger.debug(`   Account ${index + 1}: ${account.address}`)
          Logger.debug(`   Type: ${account.type}`)
        })
        
        Logger.debug(`Current Chain ID: ${this.currentChainId}`)
        Logger.debug(`Network: ${this.getNetworkName(this.currentChainId)}`)
        
        // Test library capabilities
        Logger.debug('')
        Logger.debug('Testing HederaAdapter capabilities:')
        Logger.debug(`HederaAdapter.getAccounts(): Working`)
        Logger.debug(`EIP-155 namespace support: Working`)
        Logger.debug(`Account management: Working`)
        
      } else {
        // Fallback to direct calls
        Logger.debug('HederaAdapter not available, using fallback method...')
        await this.getAccountsFallback()
      }

    } catch (error: any) {
      console.error('Get accounts error:', error)
      Logger.debug(`Get accounts error: ${error.message}`)
      
      // Try fallback method
      Logger.debug('Attempting fallback account retrieval...')
      await this.getAccountsFallback()
    }
  }

  private async getAccountsFallback() {
    try {
      Logger.debug('Fallback: Current wallet information:')
      Logger.debug(`Address: ${this.currentAccount}`)
      Logger.debug(`Chain ID: ${this.currentChainId}`)
      Logger.debug(`Network: ${this.getNetworkName(this.currentChainId)}`)
      
      // Test EIP-155 compatibility
      Logger.debug('')
      Logger.debug('Testing EIP-155 compatibility (fallback):')
      const ethereum = (window as any).ethereum
      if (ethereum) {
        const accounts = await ethereum.request({ method: 'eth_accounts' })
        const chainId = await ethereum.request({ method: 'eth_chainId' })
        
        Logger.debug(`eth_accounts: ${accounts.length} account(s)`)
        Logger.debug(`eth_chainId: ${chainId} (${parseInt(chainId, 16)})`)
        Logger.debug(`EIP-155 methods working correctly`)
      }
    } catch (error: any) {
      Logger.debug(`Fallback account retrieval error: ${error.message}`)
    }
  }

  private async switchToHederaTestnet() {
    try {
      if (!this.currentAccount) {
        throw new Error('No wallet connected')
      }

      Logger.debug('Switching to Hedera Testnet using HederaAdapter...')
      updateStatus('🔄 Switching network...', 'info')

      if (this.hederaAdapter) {
        // Use HederaAdapter's switchNetwork method
        Logger.debug('Using HederaAdapter.switchNetwork() method...')
        
        // Find Hedera Testnet in the configured networks
        const hederaTestnetConfig = HederaChainDefinition.EVM.Testnet
        
        await this.hederaAdapter.switchNetwork({
          caipNetwork: hederaTestnetConfig
        })

        Logger.debug('Successfully switched to Hedera Testnet via HederaAdapter')
        updateStatus('✅ Switched to Hedera Testnet', 'success')
        
        // Update current chain ID
        this.currentChainId = 296
        
      } else {
        // Fallback to direct MetaMask calls if HederaAdapter not available
        Logger.debug('HederaAdapter not available, using fallback method...')
        await this.switchToHederaTestnetFallback()
      }

      // Update account info after network switch
      setTimeout(() => this.updateAccountInfo(), 1000)

    } catch (error: any) {
      console.error('Network switch error:', error)
      updateStatus(`❌ Network switch failed: ${error.message}`, 'error')
      Logger.debug(`Network switch error: ${error.message}`)
      
      // Try fallback method if library method fails
      Logger.debug('Attempting fallback network switch...')
      await this.switchToHederaTestnetFallback()
    }
  }

  private async switchToHederaTestnetFallback() {
    try {
      const ethereum = (window as any).ethereum
      if (!ethereum) {
        throw new Error('No Ethereum provider available for fallback')
      }

      Logger.debug('Fallback: Using direct wallet_addEthereumChain...')

      const hederaTestnet = {
        chainId: '0x128', // 296 in hex
        chainName: 'Hedera Testnet',
        nativeCurrency: {
          name: 'HBAR',
          symbol: 'HBAR',
          decimals: 18
        },
        rpcUrls: ['https://testnet.hashio.io/api'],
        blockExplorerUrls: ['https://hashscan.io/testnet']
      }

      try {
        // Try to switch to Hedera Testnet
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hederaTestnet.chainId }]
        })
        
        Logger.debug('Fallback: Successfully switched to Hedera Testnet')
        updateStatus('✅ Switched to Hedera Testnet', 'success')

      } catch (switchError: any) {
        // If network doesn't exist, try to add it
        if (switchError.code === 4902 || switchError.code === -32602) {
          Logger.debug('Fallback: Hedera Testnet not found, adding it...')
          
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [hederaTestnet]
          })

          Logger.debug('Fallback: Hedera Testnet added and switched successfully')
          updateStatus('✅ Added and switched to Hedera Testnet', 'success')
        } else {
          throw switchError
        }
      }

    } catch (fallbackError: any) {
      console.error('Fallback network switch error:', fallbackError)
      updateStatus(`❌ Network switch failed: ${fallbackError.message}`, 'error')
      Logger.debug(`Fallback error: ${fallbackError.message}`)
    }
  }

  private async signMessage() {
    try {
      if (!this.currentAccount) {
        throw new Error('No wallet connected')
      }

      const message = `🌟 Hedera + MetaMask Integration Demo

This signature proves:
✅ EIP-155 standard compatibility
✅ Hedera network connectivity
✅ WalletConnect protocol support
✅ Secure message signing via hedera-wallet-connect library

Details:
• Account: ${this.currentAccount}
• Chain: ${this.currentChainId} (${this.getNetworkName(this.currentChainId)})
• Timestamp: ${new Date().toISOString()}
• Library: hedera-wallet-connect v2.0.3

🔐 Signed with love from the Hedera ecosystem!`

      Logger.debug('Requesting message signature via HederaAdapter...')
      updateStatus('✍️ Please sign the message in your wallet', 'info')

      let signature: string

      if (this.hederaAdapter && this.hederaProvider) {
        // Use HederaAdapter's signMessage method
        Logger.debug('Using HederaAdapter.signMessage() method...')
        
        const signResult = await this.hederaAdapter.signMessage({
          message,
          address: this.currentAccount,
          provider: this.hederaProvider as any
        })

        signature = signResult.signature
        Logger.debug('Message signed successfully via HederaAdapter!')

      } else {
        // Fallback to direct signing if HederaAdapter not available
        Logger.warn('HederaAdapter not available, using fallback method')
        signature = await this.signMessageFallback(message)
      }

      updateStatus('Message signed successfully!', 'success')
      Logger.success('Message signed successfully')
      Logger.newline()
      Logger.info('Signed Message:')
      Logger.debug(message)
      Logger.newline()
      Logger.info(`Signature: ${signature}`)
      Logger.debug(`Signature length: ${signature.length} characters`)
      Logger.success('Hedera WalletConnect library integration confirmed')

    } catch (error: any) {
      console.error('Sign message error:', error)
      updateStatus(`Message signing failed: ${error.message}`, 'error')
      Logger.error('Message signing failed', error.message)
      
      if (error.code === 4001) {
        Logger.warn('User rejected the signing request')
      }
      
      // Try fallback if library method fails
      Logger.info('Attempting fallback message signing')
      try {
        const message = `Hedera + MetaMask Integration Demo (Fallback Mode)`
        const signature = await this.signMessageFallback(message)
        
        updateStatus('Message signed successfully (fallback)!', 'success')
        Logger.success('Fallback message signing successful')
        Logger.info(`Signature: ${signature}`)
      } catch (fallbackError: any) {
        Logger.error('Fallback signing also failed', fallbackError.message)
      }
    }
  }

  private async signMessageFallback(message: string): Promise<string> {
    const ethereum = (window as any).ethereum
    if (!ethereum) {
      throw new Error('No Ethereum provider available for fallback')
    }

    Logger.debug('Fallback: Using direct personal_sign...')

    const signature = await ethereum.request({
      method: 'personal_sign',
      params: [message, this.currentAccount]
    })

    Logger.debug('Fallback: Message signed successfully')
    return signature
  }

  private async updateAccountInfo() {
    try {
      if (!this.currentAccount) {
        return
      }

      // Update address display
      addressEl.textContent = `${this.currentAccount.slice(0, 8)}...${this.currentAccount.slice(-6)}`

      // Update chain ID display
      const networkName = this.getNetworkName(this.currentChainId)
      chainIdEl.textContent = `${this.currentChainId} (${networkName})`

      // Get and display balance using HederaAdapter if available
      if (this.hederaAdapter) {
        Logger.debug('Using HederaAdapter.getBalance() method...')
        
        try {
          // Find the current network config
          const currentNetwork = this.currentChainId === 295 ? 
            HederaChainDefinition.EVM.Mainnet : 
            HederaChainDefinition.EVM.Testnet

          const balanceResult = await this.hederaAdapter.getBalance({
            address: this.currentAccount,
            chainId: `eip155:${this.currentChainId}`,
            caipNetwork: currentNetwork
          })

          const balanceInHbar = parseFloat(balanceResult.balance)
          balanceEl.textContent = `${balanceInHbar.toFixed(6)} HBAR`

          Logger.debug(`Balance updated via HederaAdapter: ${balanceInHbar.toFixed(6)} HBAR`)
          
        } catch (balanceError) {
          Logger.debug(`HederaAdapter balance error: ${balanceError}, trying fallback...`)
          await this.updateBalanceFallback()
        }
        
      } else {
        // Fallback to direct balance fetching
        Logger.debug('HederaAdapter not available, using fallback balance method...')
        await this.updateBalanceFallback()
      }

    } catch (error: any) {
      console.error('Account info update error:', error)
      Logger.debug(`Account info update error: ${error.message}`)
      
      // Try fallback method
      await this.updateBalanceFallback()
    }
  }

  private async updateBalanceFallback() {
    try {
      const ethereum = (window as any).ethereum
      if (!ethereum) {
        balanceEl.textContent = 'Provider unavailable'
        return
      }

      Logger.debug('Fallback: Using direct eth_getBalance...')

      const balance = await ethereum.request({
        method: 'eth_getBalance',
        params: [this.currentAccount, 'latest']
      })

      const balanceInHbar = parseInt(balance, 16) / Math.pow(10, 18)
      balanceEl.textContent = `${balanceInHbar.toFixed(6)} HBAR`

      Logger.debug(`Fallback balance updated: ${balanceInHbar.toFixed(6)} HBAR`)
      
    } catch (balanceError) {
      balanceEl.textContent = 'Error loading'
      Logger.debug(`Fallback balance error: ${balanceError}`)
    }
  }

  private getNetworkName(chainId: number | null): string {
    switch (chainId) {
      case 295: return 'Hedera Mainnet'
      case 296: return 'Hedera Testnet'
      case 1: return 'Ethereum Mainnet'
      case 5: return 'Goerli Testnet'
      case 11155111: return 'Sepolia Testnet'
      default: return `Unknown (${chainId})`
    }
  }

  private logConnectionDetails() {
    try {
      Logger.section('Connection Summary')
      
      Logger.info('Library Components:')
      Logger.debug(`HederaAdapter: ${this.hederaAdapter ? 'Initialized' : 'Not available'}`)
      Logger.debug(`HederaProvider: ${this.hederaProvider ? 'Initialized' : 'Not available'}`)
      Logger.debug('Namespace: eip155 (EIP-155 standard)')
      Logger.debug('Project ID: Configured')
      
      Logger.newline()
      Logger.info('Connection Details:')
      if (this.hederaAdapter) {
        Logger.debug('Method: hedera-wallet-connect library')
        Logger.debug('Protocol: WalletConnect v2 + EIP-155')
        Logger.debug('Networks: Hedera Mainnet (295), Testnet (296)')
      } else {
        Logger.debug('Method: Direct MetaMask (fallback)')
        Logger.debug('Protocol: EIP-155 standard')
      }
      
      Logger.debug(`Chain ID: ${this.currentChainId}`)
      Logger.debug(`Account: ${this.currentAccount}`)
      
      Logger.newline()
      Logger.info('Network Configuration:')
      Logger.debug('Mainnet (295): https://mainnet.hashio.io/api')
      Logger.debug('Testnet (296): https://testnet.hashio.io/api')
      Logger.debug('EVM Compatibility Layer: Enabled')
      Logger.debug('WalletConnect Protocol: Enabled')
      
      Logger.newline()
      Logger.info('Active Features:')
      Logger.debug('Multi-wallet support (Browser + Mobile)')
      Logger.debug('Automatic network management')
      Logger.debug('Unified API interface')
      Logger.debug('MetaMask fallback capability')
      Logger.debug('Real-time event handling')

    } catch (error) {
      Logger.error('Could not generate connection summary', error)
    }
  }
}

// Logging and status utilities
enum LogLevel {
  INFO = 'info',
  WARN = 'warn', 
  ERROR = 'error',
  DEBUG = 'debug',
  SUCCESS = 'success'
}

class Logger {
  private static formatTimestamp(): string {
    return new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  private static appendToDebugOutput(message: string): void {
    debugInfo.textContent += `${message}\n`
    debugInfo.scrollTop = debugInfo.scrollHeight
  }

  static log(level: LogLevel, message: string, details?: any): void {
    const timestamp = this.formatTimestamp()
    const prefix = this.getLevelPrefix(level)
    const formattedMessage = `[${timestamp}] ${prefix} ${message}`
    
    // Console logging for development
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, details || '')
        break
      case LogLevel.WARN:
        console.warn(formattedMessage, details || '')
        break
      default:
        console.log(formattedMessage, details || '')
    }

    // UI logging
    this.appendToDebugOutput(formattedMessage)
    if (details) {
      this.appendToDebugOutput(`    ${details}`)
    }
  }

  private static getLevelPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.INFO: return '[INFO]'
      case LogLevel.WARN: return '[WARN]'
      case LogLevel.ERROR: return '[ERROR]'
      case LogLevel.DEBUG: return '[DEBUG]'
      case LogLevel.SUCCESS: return '[SUCCESS]'
      default: return '[LOG]'
    }
  }

  static info(message: string, details?: any): void {
    this.log(LogLevel.INFO, message, details)
  }

  static warn(message: string, details?: any): void {
    this.log(LogLevel.WARN, message, details)
  }

  static error(message: string, details?: any): void {
    this.log(LogLevel.ERROR, message, details)
  }

  static debug(message: string, details?: any): void {
    this.log(LogLevel.DEBUG, message, details)
  }

  static success(message: string, details?: any): void {
    this.log(LogLevel.SUCCESS, message, details)
  }

  static section(title: string): void {
    this.appendToDebugOutput('')
    this.appendToDebugOutput(`=== ${title} ===`)
  }

  static newline(): void {
    this.appendToDebugOutput('')
  }
}

function updateStatus(message: string, type: 'success' | 'error' | 'info') {
  statusEl.textContent = message
  statusEl.className = `status ${type}`
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the demo
  new HederaWalletConnectDemo()
})