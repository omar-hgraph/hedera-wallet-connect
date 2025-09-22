# Technical Documentation: Hedera WalletConnect Integration with MetaMask

## Table of Contents

- [Overview](#overview)
- [Architecture Overview](#architecture-overview)
- [Implementation Details](#implementation-details)
- [MetaMask Integration (without WalletConnect)](#application--integration-flow-without-wallet-connect-v2)
- [WalletConnect v2 Integration](#application--integration-flow-with-wallet-connect-v2)
- [State Diagram](#metamask--walletconnect-integration---state-flow)
- [Critical Issues and Solutions](#critical-issues-and-solutions)
- [Network Configuration](#network-configuration)
- [Testing and Validation](#testing-and-validation)
- [Deployment Considerations](#deployment-considerations)
- [Conclusion](#conclusion)
- [Appendix](#appendix-complete-code-changes)

## Overview

This document provides a comprehensive technical analysis of implementing WalletConnect v2 integration between MetaMask and Hedera networks using the `@hashgraph/hedera-wallet-connect` library. It covers the implementation details, critical issues encountered, their technical solutions.

## Architecture Overview

### Components
- **HederaProvider**: Core provider for Hedera network interactions
- **HederaAdapter**: Adapter for WalletConnect protocol integration
- **EIP155Provider**: Provider for EIP-155 standard compliance
- **MetaMask**: Wallet client supporting WalletConnect protocol
- **Logger**: Professional logging system for development and debugging

### Integration Flow
```
MetaMask Mobile/Desktop → WalletConnect v2 → HederaProvider → EIP155Provider → Hedera Networks
                                                    ↓
                                            Logger System
```

### Log Level Usage Guidelines

- **ERROR**: Critical failures that prevent functionality
- **WARN**: Non-critical issues that should be addressed
- **INFO**: Important application state changes
- **DEBUG**: Detailed technical information for troubleshooting
- **SUCCESS**: Confirmation of successful operations

## Implementation Details

### 1. Initial Setup

#### Library Dependencies
```json
{
  "@hashgraph/hedera-wallet-connect": "file:../../hashgraph-hedera-wallet-connect-2.0.3.tgz",
  "@reown/appkit": "^1.3.0",
  "@reown/appkit-adapter-ethers": "^1.3.0",
  "ethers": "^6.13.5",
  "qrcode": "^1.5.3"
}
```

#### Core Initialization
```typescript
import { HederaAdapter, HederaProvider, HederaChainDefinition } from '@hashgraph/hedera-wallet-connect'

// WalletConnect Configuration
const WALLETCONNECT_PROJECT_ID = '6d2fca020331a209d17f33d4c5140262'
const WALLETCONNECT_METADATA = {
  name: 'MetaMask + Hedera WalletConnect Demo',
  description: 'Complete integration example using hedera-wallet-connect library',
  url: 'http://localhost:5173',
  icons: ['https://hedera.com/favicon.ico']
}
```

### 2. Namespace Configuration

#### EIP155 Namespace
```typescript
'eip155': {
  chains: ['eip155:296', 'eip155:295'], // Hedera EVM networks
  methods: [
    'eth_requestAccounts', 'eth_accounts', 'eth_chainId',
    'eth_sendTransaction', 'eth_signTransaction', 'eth_sign',
    'personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4',
    'wallet_switchEthereumChain', 'wallet_addEthereumChain',
    'eth_getBalance'
  ],
  events: ['accountsChanged', 'chainChanged', 'disconnect'],
  rpcMap: {
    '295': 'https://mainnet.hashio.io/api',
    '296': 'https://testnet.hashio.io/api',
    // Additional RPC URLs for compatibility
    '1': 'https://eth.llamarpc.com',
    '11155111': 'https://rpc.sepolia.org',
    // ... other chains
  }
}
```

#### Hedera Native Namespace
```typescript
'hedera': {
  chains: ['hedera:295', 'hedera:296'],
  methods: [
    'hedera_getNodeAddresses', 'hedera_executeTransaction',
    'hedera_signMessage', 'hedera_signAndExecuteQuery',
    'hedera_signAndExecuteTransaction', 'hedera_signTransaction'
  ],
  events: ['accountsChanged', 'chainChanged', 'disconnect'],
  rpcMap: {
    '295': 'https://mainnet.hashio.io/api',
    '296': 'https://testnet.hashio.io/api'
  }
}
```
## Application / Integration Flow (without wallet-connect v2) 
### MetaMask Integration: Adding Hedera Testnet and Performing Operations

To validate the that metamask can use hedera network , following steps were made in browser:

1. **Add Hedera Testnet to MetaMask**
   - Open MetaMask and navigate to the network selection dropdown.
   - Click "Add Network" and enter the following details:
     - **Network Name:** Hedera Testnet
     - **RPC URL:** https://testnet.hashio.io/api
     - **Chain ID:** 296
     - **Currency Symbol:** HBAR
     - **Block Explorer URL:** https://hashscan.io/testnet
   - Save the network configuration.

   ![MetaMask Add Network](assets/Metmask%20Integration%20221341.png)

2. **Connect to Hedera Testnet**
   - Select "Hedera Testnet" from the network list in MetaMask.
   - Confirm that your wallet is now connected to the Hedera Testnet.

   ![MetaMask Connected to Hedera Testnet](assets/Metmask%20Integration%20221357.png)

3. **Perform Wallet Operations**
   - Use the demo application to initiate operations such as account retrieval, balance checks, and transaction signing.
   - MetaMask will prompt for transaction approval and signing.

   ![MetaMask Transaction Approval](assets/Metmask%20Integration%20221413.png)
   ![MetaMask Transaction Signed](assets/Metmask%20Integration%20221432.png)

## Application / Integration Flow (with wallet-connect v2) 

This section demonstrates the complete WalletConnect v2 integration flow using the hedera-wallet-connect library with MetaMask mobile wallet. The process involves cross-platform communication through QR code scanning and secure session establishment.

### Prerequisites Setup

1. **Connect MetaMask to Hedera Testnet**
   - First, ensure MetaMask is configured with Hedera Testnet network
   - Add the network configuration as shown in the previous section

   ![Connect MetaMask to Hedera Testnet](assets/1.Connect%20metamask%20to%20Hedera%20testnet.PNG)

2. **Fund the Wallet**
   - Add test HBAR to your MetaMask wallet for transaction testing
   - Use Hedera Testnet faucet or transfer funds

   ![Add 100 HBAR](assets/2.Add%20100%20Hbar.png)

3. **Verify Wallet Funds**
   - Check MetaMask wallet to confirm the HBAR balance is available
   - Ensure the wallet is ready for operations

   ![Check MetaMask Wallet for Funds](assets/3.%20Check%20metmask%20wallet%20for%20funds.PNG)

### WalletConnect v2 Integration Process

4. **Start the Demo Application**
   - Launch the MetaMask + Hedera integration demo
   - The application initializes with HederaProvider and WalletConnect v2 support

   ![Start MetaMask Application](assets/4.%20Start%20metmask%20application.png)

5. **Initiate WalletConnect Connection**
   - Click the "Connect Wallet" button in the demo application
   - A QR code is generated for mobile wallet connection
   - The QR code contains the WalletConnect v2 session proposal

   ![Initiate Connection using WalletConnect QR Code](assets/5.Intiate%20connection%20using%20wallet%20connect%20QR%20code.png)

6. **Scan QR Code with MetaMask Mobile**
   - Open MetaMask mobile application
   - Use the built-in scanner to scan the QR code
   - Review the connection request details and approve

   ![Allow Connection from MetaMask Wallet](assets/6.Allow%20connection%20from%20metmask%20wallet.PNG)

7. **Connection Established**
   - The WalletConnect session is successfully established
   - The demo application shows connection status as "Connected"
   - Account information is retrieved and displayed

   ![Connection is a Success](assets/7.Connection%20is%20a%20success.png)

### Testing Wallet Operations

8. **Initiate Message Signing**
   - Test the integration by attempting to sign a message
   - Click the "Sign Message" button in the demo application
   - This tests the EIP155 provider functionality

   ![Try Message Signing](assets/8.Try%20message%20signing%20.png)

9. **Approve Signature Request**
   - MetaMask mobile displays the signature request
   - Review the message content and approve the signing operation
   - This confirms the secure communication channel is working

   ![Accept Signature Request from MetaMask Wallet](assets/9.%20Accept%20Signature%20Request%20from%20Metamask%20wallet.PNG)

10. **Signature Success Confirmation**
    - The signing operation completes successfully
    - The demo application displays confirmation of the signed message
    - This validates the end-to-end integration

    ![Message Signing is Success](assets/10.%20Message%20sigining%20is%20success.png)

11. **Review Integration Logs**
    - Check the browser console for detailed logging information
    - The professional Logger system provides comprehensive debugging data
    - Logs show the complete WalletConnect v2 communication flow

    ![Message Signing Logs](assets/11.%20Message%20signing%20logs.png)


### MetaMask + WalletConnect Integration - State Flow
![State Diagram](assets/Diagrams/12.Application%20state%20Diagram.png)


## Critical Issues and Solutions

### Issue 1: EIP155Provider RPC URL Configuration Error

#### Problem Statement
```
❌ HederaAdapter error: No RPC url provided for chainId: 1
❌ Error stack: createHttpProvider@EIP155Provider.js:116779:13
```

#### Root Cause Analysis
The `EIP155Provider.createHttpProvider()` method was attempting to create HTTP providers for all chains that MetaMask supports, including:
- `eip155:1` (Ethereum Mainnet)
- `eip155:11155111` (Sepolia Testnet)
- `eip155:137` (Polygon)
- `eip155:56` (BSC)
- etc.

However, the provider only had RPC URL configurations for Hedera chains (295, 296), causing it to throw errors for unsupported chains.

#### Original Code (Problematic)
```typescript
private createHttpProvider(
  chainId: number,
  rpcUrl?: string | undefined,
): JsonRpcProvider | undefined {
  if (!chainId) return undefined
  const { Testnet, Mainnet } = HederaChainDefinition.EVM
  const caipNetwork = [Mainnet, Testnet].find((network) => network.id == chainId)
  const rpc = caipNetwork?.rpcUrls.default.http[0] || rpcUrl
  if (!rpc) {
    throw new Error(`No RPC url provided for chainId: ${chainId}`) // ❌ This caused the error
  }
  const http = new JsonRpcProvider(new HttpConnection(rpc, false))
  return http
}
```

#### Solution Implemented
```typescript
private createHttpProvider(
  chainId: number,
  rpcUrl?: string | undefined,
): JsonRpcProvider | undefined {
  if (!chainId) return undefined
  
  // First, check if we have an RPC URL provided
  if (rpcUrl) {
    const http = new JsonRpcProvider(new HttpConnection(rpcUrl, false))
    return http
  }
  
  // Check for Hedera EVM chains
  const { Testnet, Mainnet } = HederaChainDefinition.EVM
  const caipNetwork = [Mainnet, Testnet].find((network) => network.id == chainId)
  if (caipNetwork) {
    const rpc = caipNetwork.rpcUrls.default.http[0]
    const http = new JsonRpcProvider(new HttpConnection(rpc, false))
    return http
  }
  
  // For non-Hedera chains, return undefined instead of throwing an error
  // This allows the provider to skip creating HTTP providers for chains
  // that are not relevant to Hedera operations
  this.logger.warn(`No RPC url configured for chainId: ${chainId}, skipping HTTP provider creation`)
  return undefined
}
```

#### Key Changes
1. **Graceful degradation**: Return `undefined` instead of throwing errors for unsupported chains
2. **Priority-based RPC resolution**: Check provided RPC URL first, then Hedera chains
3. **Warning logs**: Log warnings instead of fatal errors for missing configurations
4. **Provider filtering**: Updated `createHttpProviders()` to handle `undefined` providers

#### Updated Provider Creation
```typescript
private createHttpProviders(): RpcProvidersMap {
  const http: Record<number, JsonRpcProvider> = {}
  this.namespace.chains.forEach((chain) => {
    const parsedChain = parseInt(getChainId(chain))
    const provider = this.createHttpProvider(parsedChain, this.namespace.rpcMap?.[chain])
    if (provider) { // ✅ Only add valid providers
      http[parsedChain] = provider
    }
  })
  return http
}
```

### Issue 2: Account Retrieval Failure

#### Problem Statement
```
📋 Retrieved 0 account(s)
❌ HederaAdapter error: No accounts returned from HederaAdapter
```

#### Root Cause Analysis
The `HederaAdapter.getAccounts()` method was filtering accounts based on the exact namespace chains. Since MetaMask provides accounts for standard chains (1, 11155111, etc.) but not for Hedera chains (295, 296), the adapter returned zero accounts.

#### MetaMask Session Data
```json
{
  "namespaces": {
    "eip155": {
      "accounts": [
        "eip155:1:0xb7fee00428ef2a8f642a16639c0e9912bb4443a7",
        "eip155:11155111:0xb7fee00428ef2a8f642a16639c0e9912bb4443a7",
        "eip155:137:0xb7fee00428ef2a8f642a16639c0e9912bb4443a7"
        // ... but NO eip155:295 or eip155:296 accounts
      ]
    }
  }
}
```

#### Original Code (Problematic)
```typescript
// Get accounts using the adapter
const accountsResult = await this.hederaAdapter.getAccounts({
  id: 'WALLET_CONNECT',
  namespace: 'eip155'
})

// This returned 0 accounts because MetaMask doesn't support Hedera chains natively
if (accountsResult.accounts.length > 0) {
  // This block never executed
}
```

#### HederaAdapter.getAccounts() Logic
```typescript
public async getAccounts({
  namespace,
}: AdapterBlueprint.GetAccountsParams & {
  namespace: ChainNamespace
}): Promise<AdapterBlueprint.GetAccountsResult> {
  const provider = this.provider as UniversalProvider
  const addresses = (provider?.session?.namespaces?.[namespace]?.accounts
    ?.map((account) => {
      const [, , address] = account.split(':')
      return address
    })
    .filter((address, index, self) => self.indexOf(address) === index) || []) as string[]

  return Promise.resolve({
    accounts: addresses.map((address) =>
      CoreHelperUtil.createAccount(namespace, address, 'eoa'),
    ),
  })
}
```

The issue: This method only finds accounts that exactly match the namespace configuration, but MetaMask doesn't provide accounts for Hedera chains.

#### Solution Implemented
```typescript
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
}
```

#### Key Changes
1. **Direct session access**: Bypass the adapter's filtering and access session data directly
2. **Address extraction**: Parse account strings to extract Ethereum addresses
3. **Chain-agnostic approach**: Use the same address for Hedera operations regardless of origin chain
4. **Fallback strategy**: Default to Hedera Testnet (296) for operations

## Network Configuration

### Hedera Testnet Setup for MetaMask

```javascript
// Network configuration for MetaMask
const HEDERA_TESTNET = {
  networkName: 'Hedera Testnet',
  rpcUrl: 'https://testnet.hashio.io/api',
  chainId: '0x128', // 296 in hexadecimal
  currencySymbol: 'HBAR',
  blockExplorerUrl: 'https://hashscan.io/testnet'
}

// Add network programmatically
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [HEDERA_TESTNET]
})
```

### Hedera Mainnet Setup

```javascript
const HEDERA_MAINNET = {
  networkName: 'Hedera Mainnet',
  rpcUrl: 'https://mainnet.hashio.io/api',
  chainId: '0x127', // 295 in hexadecimal
  currencySymbol: 'HBAR',
  blockExplorerUrl: 'https://hashscan.io/mainnet'
}
```

## Testing and Validation

### Unit Tests Updated
The EIP155Provider test suite required updates to reflect the new behavior:

#### Before (Expected Error)
```typescript
it('createHttpProvider handles invalid input', () => {
  const provider = createProvider()
  expect(() => provider['createHttpProvider'](999)).toThrow('No RPC url provided')
})
```

#### After (Expected Warning)
```typescript
it('createHttpProvider handles invalid input', () => {
  const provider = createProvider()
  expect(provider['createHttpProvider'](999)).toBeUndefined()
})
```

### Integration Testing Steps
1. **Library Build**: `npm run build`
2. **Package Creation**: `npm pack`
3. **Demo Installation**: `npm install ../../hashgraph-hedera-wallet-connect-2.0.3.tgz`
4. **Demo Execution**: `npm run dev`


## Deployment Considerations

### Environment Variables
```bash
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
VITE_HEDERA_NETWORK=testnet # or mainnet
```

### Build Process
```bash
# 1. Build the library
npm run build

# 2. Create package
npm pack

# 3. Install in demo
cd examples/metamask-dapp
npm install ../../hashgraph-hedera-wallet-connect-2.0.3.tgz

# 4. Start demo
npm run dev
```

## Conclusion

The integration successfully bridges MetaMask's WalletConnect capabilities with Hedera networks by:

1. **Implementing graceful error handling** for unsupported chains
2. **Extracting account data directly** from WalletConnect sessions
3. **Providing comprehensive namespace configuration** for both EIP155 and Hedera protocols

## Appendix: Complete Code Changes

### File: `/src/reown/providers/EIP155Provider.ts`
- Modified `createHttpProvider()` method for graceful chain handling
- Updated `createHttpProviders()` to filter undefined providers
- Enhanced error logging and warning systems

### File: `/examples/metamask-dapp/src/main.ts`
- Replaced adapter-based account retrieval with direct session access
- Implemented address extraction from CAIP account strings
- **Implemented professional Logger class** with structured logging levels
- **Refactored all logging** from AI-generated style to professional patterns
- **Added comprehensive debugging** information for development and production

### File: `/test/reown/providers/EIP155Provider.extra.test.ts`
- Updated test expectations to match new graceful error handling behavior

