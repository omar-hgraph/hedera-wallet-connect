# Hedera WalletConnect Integration Example

A **comprehensive WalletConnect v2 integration example** demonstrating how to connect Hedera networks with modern wallets using the `@hashgraph/hedera-wallet-connect` library. This example showcases both direct MetaMask integration and full WalletConnect protocol support for mobile and desktop wallets.

## 🌟 What This Example Demonstrates

✅ **WalletConnect v2 Protocol** - Modern wallet connectivity standard  
✅ **Dual Integration Strategy** - Both browser extension and mobile wallet support  
✅ **EIP-155 Compliance** - Ethereum wallet compatibility with Hedera networks  
✅ **Hedera Network Support** - Mainnet (295) and Testnet (296) integration  
✅ **Production-Ready Architecture** - Real wallet operations with comprehensive error handling  

---

## 🏗️ WalletConnect Integration Architecture

### **Core Components**

#### **1. HederaProvider**
- **Purpose**: Core WalletConnect v2 provider for wallet communication
- **Responsibility**: Protocol management, session handling, QR code generation
- **Supports**: Mobile wallets, desktop wallets, cross-platform connectivity

#### **2. HederaAdapter** 
- **Purpose**: EIP-155 compatible adapter for Ethereum-style wallet interactions
- **Responsibility**: Transaction formatting, method translation, network management
- **Supports**: MetaMask, browser extensions, standard Ethereum operations

#### **3. EIP-155 Namespace**
- **Purpose**: Ethereum wallet compatibility layer
- **Responsibility**: Standard method mapping, chain ID management
- **Supports**: eth_requestAccounts, personal_sign, wallet_switchEthereumChain

---

## 🚀 Quick Start Guide

### **Prerequisites**
1. **WalletConnect Project ID** - Get from [cloud.reown.com](https://cloud.reown.com/)
2. **Node.js 18+** - For development environment
3. **Compatible Wallet** - MetaMask, WalletConnect-compatible mobile wallet

### **Installation & Setup**

1. **Clone and install dependencies:**
   ```bash
   npm install
   npm run dev
   ```

2. **Configure WalletConnect Project ID:**
   ```typescript
   // In src/main.ts
   const WALLETCONNECT_PROJECT_ID = 'your-project-id-here'
   ```

3. **Launch the demo:**
   ```bash
   npm run dev
   # Open browser at http://localhost:5173
   ```

---

## 📱 Connection Methods

### **Method 1: WalletConnect Protocol (Recommended)**

**Best for:** Mobile wallets, cross-platform support, maximum compatibility

```typescript
// Initialize HederaProvider with WalletConnect v2
const hederaProvider = await HederaProvider.init({
  projectId: WALLETCONNECT_PROJECT_ID,
  metadata: {
    name: 'Your dApp Name',
    description: 'Your dApp Description',
    url: 'https://your-dapp.com',
    icons: ['https://your-dapp.com/icon.png']
  }
})

// Set up connection events
hederaProvider.on('display_uri', (uri: string) => {
  // Generate QR code for mobile wallet scanning
  generateQRCode(uri)
})

hederaProvider.on('connect', (session) => {
  // Handle successful connection
  console.log('Connected:', session)
})
```

**Features:**
- ✅ QR code scanning for mobile wallets
- ✅ Deep linking support
- ✅ Multi-chain support (Hedera + Ethereum chains)
- ✅ Session persistence
- ✅ Real-time connection status

### **Method 2: Direct Browser Extension**

**Best for:** Desktop development, MetaMask integration, rapid testing

```typescript
// Initialize HederaAdapter for EIP-155 compatibility
const hederaAdapter = new HederaAdapter({
  projectId: WALLETCONNECT_PROJECT_ID,
  networks: [
    HederaChainDefinition.EVM.Mainnet,    // Chain ID 295
    HederaChainDefinition.EVM.Testnet     // Chain ID 296
  ],
  namespace: 'eip155'  // Ethereum wallet compatibility
})

// Set the universal provider
await hederaAdapter.setUniversalProvider(hederaProvider)

// Direct MetaMask connection
if (window.ethereum) {
  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts'
  })
}
```

**Features:**
- ✅ Instant connection (no QR scanning)
- ✅ Native browser integration
- ✅ Standard Ethereum methods
- ✅ Network switching capabilities

---

## 🔧 Implementation Deep Dive

### **1. Project Configuration**

**Essential Dependencies:**
```json
{
  "dependencies": {
    "@hashgraph/hedera-wallet-connect": "^2.0.3",
    "@reown/appkit": "^1.3.0",
    "@reown/appkit-adapter-ethers": "^1.3.0",
    "ethers": "^6.13.5",
    "qrcode": "^1.5.3"
  }
}
```

**WalletConnect Metadata Configuration:**
```typescript
const WALLETCONNECT_METADATA = {
  name: 'Hedera WalletConnect Demo',
  description: 'Complete integration example',
  url: 'http://localhost:5173',
  icons: ['https://hedera.com/favicon.ico']
}
```

### **2. Network Configuration**

**Hedera EVM Networks:**
```typescript
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
```

**RPC Endpoint Mapping:**
```typescript
const rpcMap = {
  // Hedera networks (primary)
  '295': 'https://mainnet.hashio.io/api',
  '296': 'https://testnet.hashio.io/api',
  // Common chains (compatibility)
  '1': 'https://eth.llamarpc.com',
  '137': 'https://polygon-rpc.com',
  '56': 'https://bsc-dataseed.binance.org'
}
```

### **3. Connection Parameters**

**EIP-155 Namespace Configuration:**
```typescript
const connectionParams = {
  optionalNamespaces: {
    'eip155': {
      chains: ['eip155:296', 'eip155:295'],
      methods: [
        'eth_requestAccounts',
        'eth_accounts', 
        'eth_chainId',
        'eth_sendTransaction',
        'personal_sign',
        'eth_signTypedData_v4',
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain'
      ],
      events: ['accountsChanged', 'chainChanged', 'disconnect'],
      rpcMap: rpcMap
    }
  }
}
```

**Hedera Native Namespace (Optional):**
```typescript
'hedera': {
  chains: ['hedera:295', 'hedera:296'],
  methods: [
    'hedera_getNodeAddresses',
    'hedera_executeTransaction', 
    'hedera_signMessage'
  ],
  events: ['hedera_accountsChanged', 'hedera_chainChanged']
}
```

### **4. Connection Flow Implementation**

**Complete Connection Sequence:**
```typescript
class HederaWalletConnectDemo {
  private hederaProvider: HederaProvider | null = null
  private hederaAdapter: HederaAdapter | null = null

  async init() {
    // Step 1: Initialize HederaProvider
    this.hederaProvider = await HederaProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: WALLETCONNECT_METADATA
    })

    // Step 2: Set up event listeners
    this.hederaProvider.on('display_uri', (uri) => {
      this.displayQRCode(uri)
    })

    this.hederaProvider.on('connect', (session) => {
      this.handleConnection(session)
    })

    // Step 3: Initialize HederaAdapter
    this.hederaAdapter = new HederaAdapter({
      projectId: WALLETCONNECT_PROJECT_ID,
      networks: [
        HederaChainDefinition.EVM.Mainnet,
        HederaChainDefinition.EVM.Testnet
      ],
      namespace: 'eip155'
    })

    // Step 4: Link adapter to provider
    await this.hederaAdapter.setUniversalProvider(this.hederaProvider)
  }

  async connect() {
    const session = await this.hederaProvider.connect(connectionParams)
    return session
  }
}
```

---

## 🌐 Supported Networks & Methods

### **Hedera Networks**

| Network | Chain ID | RPC Endpoint | Explorer |
|---------|----------|--------------|----------|
| **Hedera Mainnet** | 295 | https://mainnet.hashio.io/api | https://hashscan.io/mainnet |
| **Hedera Testnet** | 296 | https://testnet.hashio.io/api | https://hashscan.io/testnet |

### **Supported Methods**

#### **EIP-155 Standard Methods:**
- `eth_requestAccounts` - Request wallet connection
- `eth_accounts` - Get connected accounts
- `eth_chainId` - Get current chain ID
- `eth_sendTransaction` - Send transactions
- `personal_sign` - Sign messages
- `eth_signTypedData_v4` - Sign structured data
- `wallet_switchEthereumChain` - Switch networks
- `wallet_addEthereumChain` - Add custom networks

#### **Hedera Native Methods (Advanced):**
- `hedera_getNodeAddresses` - Get Hedera node addresses
- `hedera_executeTransaction` - Execute Hedera transactions
- `hedera_signMessage` - Sign Hedera-specific messages

### **Supported Events:**
- `accountsChanged` - Account switching
- `chainChanged` - Network switching
- `disconnect` - Wallet disconnection

---

## 💻 Code Examples

### **Basic Connection**
```typescript
import { HederaProvider, HederaAdapter } from '@hashgraph/hedera-wallet-connect'

// Initialize and connect
const provider = await HederaProvider.init({
  projectId: 'your-project-id',
  metadata: { name: 'Your dApp' }
})

const session = await provider.connect({
  optionalNamespaces: {
    eip155: {
      chains: ['eip155:296'],
      methods: ['eth_requestAccounts', 'personal_sign']
    }
  }
})
```

### **Network Switching**
```typescript
// Switch to Hedera Testnet
await window.ethereum.request({
  method: 'wallet_switchEthereumChain',
  params: [{ chainId: '0x128' }] // 296 in hex
})

// Add Hedera network if not present
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x128',
    chainName: 'Hedera Testnet',
    nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
    rpcUrls: ['https://testnet.hashio.io/api'],
    blockExplorerUrls: ['https://hashscan.io/testnet']
  }]
})
```

### **Message Signing**
```typescript
// Sign a message
const message = 'Hello Hedera WalletConnect!'
const signature = await window.ethereum.request({
  method: 'personal_sign',
  params: [message, account]
})
```

### **QR Code Generation**
```typescript
import QRCode from 'qrcode'

// Generate QR code for mobile wallets
provider.on('display_uri', async (uri: string) => {
  const canvas = document.getElementById('qrCode')
  await QRCode.toCanvas(canvas, uri, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  })
})
```

---

## 🔍 Debugging & Troubleshooting

### **Common Issues & Solutions**

#### **1. Connection Failures**
```typescript
// Issue: "No wallet found"
// Solution: Check Project ID and network configuration
if (!WALLETCONNECT_PROJECT_ID || WALLETCONNECT_PROJECT_ID === 'your-project-id-here') {
  console.error('WalletConnect Project ID not configured')
}
```

#### **2. Network Not Supported**
```typescript
// Issue: Wallet doesn't support Hedera networks
// Solution: Add network programmatically
try {
  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [HEDERA_NETWORKS.testnet]
  })
} catch (error) {
  console.error('Failed to add network:', error)
}
```

#### **3. RPC Errors**
```typescript
// Issue: RPC endpoint not responding
// Solution: Verify RPC URLs and provide fallbacks
const rpcMap = {
  '296': [
    'https://testnet.hashio.io/api',           // Primary
    'https://testnet.mirrornode.hedera.com',   // Fallback
    'https://hedera-testnet.blockpi.network'   // Alternative
  ]
}
```

### **Debug Logging**
```typescript
// Enable comprehensive logging
const logger = {
  info: (msg: string) => console.log(`ℹ️ ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`),
  debug: (msg: string) => console.debug(`🔧 ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`)
}

// Log connection events
provider.on('connect', (session) => {
  logger.success('WalletConnect session established')
  logger.debug('Session details:', session)
})
```

---

## 📁 Project Structure

```
metamask-dapp/
├── src/
│   ├── main.ts                  # Complete WalletConnect integration
│   └── types/                   # TypeScript definitions
├── index.html                   # Demo UI with QR code support
├── package.json                 # Dependencies and scripts
├── vite.config.ts              # Development server config
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This comprehensive guide
```

### **Key Files:**

#### **src/main.ts** - Main Integration Logic
- HederaProvider initialization
- HederaAdapter configuration  
- Connection handling
- Event management
- QR code generation

#### **index.html** - Demo Interface
- Connection buttons
- QR code display
- Real-time debugging
- Network information

#### **package.json** - Dependencies
- @hashgraph/hedera-wallet-connect v2.0.3
- @reown/appkit v1.3.0 (WalletConnect v2 evolution)
- ethers v6.13.5
- TypeScript v5.0+

---

## 📖 Resources & Documentation

### **Official Documentation**
- 📘 [Hedera Documentation](https://docs.hedera.com/)
- 🔗 [WalletConnect v2 Specs](https://docs.walletconnect.com/)
- 🦊 [MetaMask Developer Docs](https://docs.metamask.io/)
- ⚡ [EIP-155 Standard](https://eips.ethereum.org/EIPS/eip-155)

### **Hedera Resources**
- 🏗️ [Hedera EVM Documentation](https://docs.hedera.com/hedera/core-concepts/smart-contracts)
- 🌐 [Hedera JSON-RPC Relay](https://docs.hedera.com/hedera/core-concepts/smart-contracts/json-rpc-relay)
- 🔍 [Hashscan Explorer](https://hashscan.io/)
- 💰 [Hedera Faucet](https://portal.hedera.com/faucet)

### **Development Tools**
- 📦 [Hedera JavaScript SDK](https://www.npmjs.com/package/@hashgraph/sdk)
- 🛠️ [ethers.js v6 Documentation](https://docs.ethers.org/v6/)
- 🎨 [Reown AppKit](https://docs.reown.com/appkit/overview)
- 🔧 [Vite Documentation](https://vitejs.dev/)

---
