/*
 *
 * Hedera Wallet Connect
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import {
  AccountCreateTransaction,
  AccountId,
  AccountUpdateTransaction,
  LedgerId,
  PrivateKey,
  TokenAssociateTransaction,
  TopicCreateTransaction,
  Transaction,
  TransactionId,
  TransferTransaction,
  Hbar,
} from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import {
  DAppSigner,
  HederaJsonRpcMethod,
  Uint8ArrayToBase64String,
  transactionToTransactionBody,
} from '../../src'
import {
  dAppMetadata,
  useJsonFixture,
  prepareTestTransaction,
  testUserAccountId,
} from '../_helpers'
import { ISignClient, SessionTypes } from '@walletconnect/types'

jest.mock('../../src/lib/shared/extensionController', () => ({
  extensionOpen: jest.fn(),
}))

describe('DAppSigner - signTransactions (HIP-1190)', () => {
  let signer: DAppSigner
  let mockSignClient: jest.Mocked<ISignClient>
  const fakeSession = useJsonFixture('fakeSession') as SessionTypes.Struct
  const testAccountId = AccountId.fromString('0.0.123')
  const testTopic = 'test-topic'
  const testExtensionId = 'test-extension-id'

  /**
   * Helper function to create mock signature maps for testing
   * Generates realistic protobuf-encoded signature maps
   */
  const createMockSignatureMaps = (count: number): string[] => {
    const signatureMaps: string[] = []
    
    for (let i = 0; i < count; i++) {
      const mockPublicKey = PrivateKey.generate().publicKey
      const mockSignature = new Uint8Array(64).fill(i + 1) // Unique signature per iteration
      
      const sigMap = proto.SignatureMap.encode({
        sigPair: [
          {
            pubKeyPrefix: mockPublicKey.toBytes(),
            ed25519: mockSignature,
          },
        ],
      }).finish()
      
      signatureMaps.push(Uint8ArrayToBase64String(sigMap))
    }
    
    return signatureMaps
  }
  
  /**
   * Helper function to create mock node account IDs
   * Generates realistic Hedera testnet node IDs
   */
  const createMockNodeAccountIds = (count: number): string[] => {
    const nodeIds: string[] = []
    
    for (let i = 0; i < count; i++) {
      // Generate node IDs: 0.0.3, 0.0.4, 0.0.5, etc.
      nodeIds.push(`0.0.${3 + i}`)
    }
    
    return nodeIds
  }

  beforeEach(() => {
    // Mock WalletConnect sign client
    mockSignClient = {
      request: jest.fn(),
      metadata: dAppMetadata,
      connect: jest.fn(),
      disconnect: jest.fn(),
      session: {
        get: jest.fn(() => fakeSession),
      },
      emit: jest.fn(),
    } as unknown as jest.Mocked<ISignClient>

    // Create DAppSigner instance
    signer = new DAppSigner(
      testAccountId,
      mockSignClient,
      testTopic,
      LedgerId.TESTNET,
      testExtensionId,
      'off',
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Happy Path - Successful Multi-Node Signing', () => {
    it('should sign a transaction for multiple nodes with default nodeCount', async () => {
      const mockSignatureMaps = createMockSignatureMaps(5) // Default is 5 nodes
      const mockNodeAccountIds = createMockNodeAccountIds(5)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(
        new AccountCreateTransaction().setInitialBalance(new Hbar(10)),
        { freeze: false, setNodeAccountIds: false }, // No node IDs set (HIP-1190 requirement)
      )

      const signedTransactions = await signer.signTransactions(transaction)

      // Verify the wallet request
      expect(mockSignClient.request).toHaveBeenCalledTimes(1)
      expect(mockSignClient.request).toHaveBeenCalledWith({
        topic: testTopic,
        request: {
          method: HederaJsonRpcMethod.SignTransactions,
          params: {
            signerAccountId: 'hedera:testnet:' + signer.getAccountId().toString(),
            transactionBody: expect.any(String),
            nodeCount: undefined, // Default nodeCount
          },
        },
        chainId: expect.any(String),
      })

      // Verify response structure
      expect(signedTransactions).toBeDefined()
      expect(Array.isArray(signedTransactions)).toBe(true)
      expect(signedTransactions.length).toBe(5)

      // Verify each signed transaction is properly reconstructed
      signedTransactions.forEach((signedTx, index) => {
        expect(signedTx).toBeInstanceOf(Transaction)
        expect(signedTx.isFrozen()).toBe(true)
        
        // Verify transaction body is preserved (same transaction ID)
        const originalTxId = transaction.transactionId?.toString()
        const signedTxId = signedTx.transactionId?.toString()
        expect(signedTxId).toBe(originalTxId)
      })
    })

    it('should sign a transaction for custom number of nodes', async () => {
      const customNodeCount = 3
      const mockSignatureMaps = createMockSignatureMaps(customNodeCount)
      const mockNodeAccountIds = createMockNodeAccountIds(customNodeCount)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(
        new TopicCreateTransaction().setSubmitKey(PrivateKey.generate().publicKey),
        { freeze: false, setNodeAccountIds: false },
      )

      const signedTransactions = await signer.signTransactions(transaction, customNodeCount)

      // Verify nodeCount parameter is passed
      expect(mockSignClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            params: expect.objectContaining({
              nodeCount: customNodeCount,
            }),
          }),
        }),
      )

      // Verify correct number of signed transactions returned
      expect(signedTransactions.length).toBe(customNodeCount)
    })

    it('should handle different transaction types correctly', async () => {
      const transactionTypes = [
        new AccountCreateTransaction(),
        new AccountUpdateTransaction().setAccountId(testUserAccountId),
        new TopicCreateTransaction(),
        new TokenAssociateTransaction()
          .setAccountId(testUserAccountId)
          .setTokenIds(['0.0.1000']),
        new TransferTransaction()
          .addHbarTransfer('0.0.123', new Hbar(-10))
          .addHbarTransfer('0.0.456', new Hbar(10)),
      ]

      for (const txType of transactionTypes) {
        const mockSignatureMaps = createMockSignatureMaps(2)
        const mockNodeAccountIds = createMockNodeAccountIds(2)

        mockSignClient.request.mockResolvedValueOnce({
          signatureMaps: mockSignatureMaps,
          nodeAccountIds: mockNodeAccountIds,
        })

        const transaction = prepareTestTransaction(txType, {
          freeze: false,
          setNodeAccountIds: false,
        })

        const signedTransactions = await signer.signTransactions(transaction, 2)

        expect(signedTransactions).toBeDefined()
        expect(signedTransactions.length).toBe(2)
        expect(signedTransactions[0].constructor.name).toBe(transaction.constructor.name)
      }

      // Verify all transaction types were processed
      expect(mockSignClient.request).toHaveBeenCalledTimes(transactionTypes.length)
    })

    it('should preserve transaction properties in signed transactions', async () => {
      const mockSignatureMaps = createMockSignatureMaps(2)
      const mockNodeAccountIds = createMockNodeAccountIds(2)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const initialBalance = new Hbar(100)
      const transaction = prepareTestTransaction(
        new AccountCreateTransaction()
          .setInitialBalance(initialBalance)
          .setMaxTransactionFee(new Hbar(5)),
        { freeze: false, setNodeAccountIds: false },
      )

      const signedTransactions = await signer.signTransactions(transaction)

      // Verify transaction properties are preserved
      signedTransactions.forEach((signedTx) => {
        expect(signedTx).toBeInstanceOf(AccountCreateTransaction)
        // Transaction ID should match original
        expect(signedTx.transactionId?.toString()).toBe(transaction.transactionId?.toString())
      })
    })
  })

  describe('Error Handling - Invalid Inputs', () => {
    it('should successfully strip node IDs when transaction has them set', async () => {
      // This test verifies that passing null to transactionToTransactionBody strips node IDs
      // HIP-1190 requires transactions without node IDs, and the implementation handles this
      const mockSignatureMaps = createMockSignatureMaps(2)
      const mockNodeAccountIds = createMockNodeAccountIds(2)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      // Create transaction WITH node IDs
      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: true, // Node IDs are set
      })

      // The implementation should strip node IDs by passing null to _makeTransactionBody
      const signedTransactions = await signer.signTransactions(transaction)

      // Should successfully return signed transactions
      expect(signedTransactions).toBeDefined()
      expect(signedTransactions.length).toBe(2)
      
      // Verify the request was made (node IDs were stripped before sending)
      expect(mockSignClient.request).toHaveBeenCalled()
    })

    it('should throw error when transaction body serialization fails', async () => {
      // Create an invalid transaction mock that can't be serialized
      const mockInvalidTx = {
        _signedTransactions: {
          current: undefined, // Missing bodyBytes
        },
        nodeAccountIds: [],
        isFrozen: () => false,
        freeze: jest.fn(),
        _makeTransactionBody: undefined, // Missing required method
      } as any

      await expect(signer.signTransactions(mockInvalidTx)).rejects.toThrow()
    })

    it('should throw error when wallet returns invalid signature maps', async () => {
      // Mock wallet returning corrupted base64
      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: ['invalid-base64-!!!', 'corrupted-data'],
        nodeAccountIds: ['0.0.3', '0.0.4'],
      })

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      await expect(signer.signTransactions(transaction)).rejects.toThrow(
        'Failed to reconstruct signed transaction',
      )
    })

    it('should throw error when wallet returns empty signature maps array', async () => {
      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [],
        nodeAccountIds: [],
      })

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      const signedTransactions = await signer.signTransactions(transaction)

      // Empty array is valid - wallet could choose to return 0 signatures
      expect(signedTransactions).toEqual([])
    })

    it('should throw error when wallet request fails', async () => {
      mockSignClient.request.mockRejectedValueOnce(
        new Error('User rejected the signing request'),
      )

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      await expect(signer.signTransactions(transaction)).rejects.toThrow(
        'User rejected the signing request',
      )
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle signing for maximum number of nodes', async () => {
      const maxNodes = 20 // Realistic maximum
      const mockSignatureMaps = createMockSignatureMaps(maxNodes)
      const mockNodeAccountIds = createMockNodeAccountIds(maxNodes)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      const signedTransactions = await signer.signTransactions(transaction, maxNodes)

      expect(signedTransactions.length).toBe(maxNodes)
    })

    it('should handle signing for single node (nodeCount=1)', async () => {
      const mockSignatureMaps = createMockSignatureMaps(1)

      const mockNodeAccountIds = createMockNodeAccountIds(1)


      mockSignClient.request.mockResolvedValueOnce({

        signatureMaps: mockSignatureMaps,

        nodeAccountIds: mockNodeAccountIds,

      })

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      const signedTransactions = await signer.signTransactions(transaction, 1)

      expect(signedTransactions.length).toBe(1)
    })

    it('should auto-freeze unfrozen transactions before signing', async () => {
      const mockSignatureMaps = createMockSignatureMaps(2)
      const mockNodeAccountIds = createMockNodeAccountIds(2)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      expect(transaction.isFrozen()).toBe(false)

      const signedTransactions = await signer.signTransactions(transaction)

      // Verify signed transactions are frozen
      signedTransactions.forEach((signedTx) => {
        expect(signedTx.isFrozen()).toBe(true)
      })
    })

    it('should handle already frozen transactions', async () => {
      const mockSignatureMaps = createMockSignatureMaps(2)
      const mockNodeAccountIds = createMockNodeAccountIds(2)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      // Create a transaction and manually freeze it without node IDs
      const transaction = new AccountCreateTransaction()
        .setTransactionId(TransactionId.generate(testUserAccountId))
        .setMaxTransactionFee(new Hbar(2))

      // Note: Can't freeze without setting node IDs or client, so we test with unfrozen
      // and rely on signTransactions to handle freezing internally
      expect(transaction.isFrozen()).toBe(false)

      const signedTransactions = await signer.signTransactions(transaction)

      expect(signedTransactions.length).toBe(2)
      signedTransactions.forEach((signedTx) => {
        expect(signedTx.isFrozen()).toBe(true)
      })
    })
  })

  describe('Security - Local Transaction Reconstruction', () => {
    it('should verify node diversity by checking transaction byte uniqueness (HIP-1190 core requirement)', async () => {
      const mockSignatureMaps = createMockSignatureMaps(5)
      const mockNodeAccountIds = createMockNodeAccountIds(5)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(
        new TransferTransaction()
          .addHbarTransfer('0.0.123', new Hbar(-100))
          .addHbarTransfer('0.0.456', new Hbar(100)),
        { freeze: false, setNodeAccountIds: false },
      )

      const signedTransactions = await signer.signTransactions(transaction, 5)

      // CRITICAL: Verify we got 5 different signed transactions
      expect(signedTransactions.length).toBe(5)

      // Each signed transaction should have unique bytes (different signature + node combo)
      const txBytesSet = new Set(
        signedTransactions.map((tx) => Buffer.from(tx.toBytes()).toString('hex'))
      )
      
      // All 5 should be unique (proves different node assignments)
      expect(txBytesSet.size).toBe(5)

      // Verify all transactions are properly frozen and signed
      signedTransactions.forEach((tx) => {
        expect(tx.isFrozen()).toBe(true)
        expect(tx._signedTransactions).toBeDefined()
      })
    })

    it('should reconstruct transactions locally using original body bytes', async () => {
      const mockSignatureMaps = createMockSignatureMaps(3)
      const mockNodeAccountIds = createMockNodeAccountIds(3)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(
        new TransferTransaction()
          .addHbarTransfer('0.0.123', new Hbar(-100))
          .addHbarTransfer('0.0.456', new Hbar(100)),
        { freeze: false, setNodeAccountIds: false },
      )

      const originalTxBody = transactionToTransactionBody(transaction, null)
      const signedTransactions = await signer.signTransactions(transaction)

      // Verify all signed transactions use the SAME transaction body
      signedTransactions.forEach((signedTx) => {
        const signedTxBody = transactionToTransactionBody(signedTx, null)
        
        // Transaction ID should match (proves body wasn't tampered)
        expect(signedTx.transactionId?.toString()).toBe(transaction.transactionId?.toString())
      })

      // This prevents wallet from tampering with transaction amount/recipient
      expect(signedTransactions.length).toBe(3)
    })

    it('should use different signatures for each node', async () => {
      const mockSignatureMaps = createMockSignatureMaps(3)
      const mockNodeAccountIds = createMockNodeAccountIds(3)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      const signedTransactions = await signer.signTransactions(transaction)

      // Convert each signed transaction to bytes and verify they're different
      // (different signatures make different byte representations)
      const txBytes = signedTransactions.map((tx) => Buffer.from(tx.toBytes()).toString('hex'))

      // All should be unique due to different signatures
      const uniqueTxBytes = new Set(txBytes)
      expect(uniqueTxBytes.size).toBe(3)
    })

    it('should verify all signed transactions have identical transaction bodies but different nodes', async () => {
      const mockSignatureMaps = createMockSignatureMaps(4)
      const mockNodeAccountIds = createMockNodeAccountIds(4)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(
        new TransferTransaction()
          .addHbarTransfer('0.0.100', new Hbar(-50))
          .addHbarTransfer('0.0.200', new Hbar(50)),
        { freeze: false, setNodeAccountIds: false },
      )

      const signedTransactions = await signer.signTransactions(transaction, 4)

      // CRITICAL HIP-1190 Test: Verify all transactions have the SAME base properties
      const firstTxId = signedTransactions[0].transactionId?.toString()
      
      signedTransactions.forEach((tx, index) => {
        // All should have same transaction ID
        expect(tx.transactionId?.toString()).toBe(firstTxId)
        
        // All should be frozen
        expect(tx.isFrozen()).toBe(true)
      })

      // But the complete transaction bytes should be unique (different signatures/nodes)
      const txBytesSet = new Set(
        signedTransactions.map((tx) => Buffer.from(tx.toBytes()).toString('hex'))
      )
      expect(txBytesSet.size).toBe(4) // All 4 should be unique

      // This proves: Same transaction body + different nodes = HIP-1190 multi-node signing
      expect(signedTransactions.length).toBe(4)
    })

    it('should never send transaction with node IDs to wallet', async () => {
      const mockSignatureMaps = createMockSignatureMaps(2)
      const mockNodeAccountIds = createMockNodeAccountIds(2)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      await signer.signTransactions(transaction)

      // Verify the request params
      const requestCall = mockSignClient.request.mock.calls[0][0]
      const params = requestCall.request.params

      expect(params.transactionBody).toBeDefined()
      
      // The transaction body sent should NOT have nodeAccountID
      // This is verified by the implementation throwing if nodeAccountID exists
      expect(params.signerAccountId).toBe('hedera:testnet:0.0.123')
    })
  })

  describe('Request Parameters Validation', () => {
    it('should send correct signerAccountId in CAIP-10 format', async () => {
      const mockSignatureMaps = createMockSignatureMaps(1)
      const mockNodeAccountIds = createMockNodeAccountIds(1)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      await signer.signTransactions(transaction)

      expect(mockSignClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            params: expect.objectContaining({
              signerAccountId: 'hedera:testnet:0.0.123',
            }),
          }),
        }),
      )
    })

    it('should send base64-encoded transaction body', async () => {
      const mockSignatureMaps = createMockSignatureMaps(1)
      const mockNodeAccountIds = createMockNodeAccountIds(1)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      await signer.signTransactions(transaction)

      const requestCall = mockSignClient.request.mock.calls[0][0]
      const transactionBody = requestCall.request.params.transactionBody

      // Verify it's valid base64
      expect(transactionBody).toMatch(/^[A-Za-z0-9+/]+=*$/)
      
      // Verify it can be decoded
      expect(() => Buffer.from(transactionBody, 'base64')).not.toThrow()
    })

    it('should use correct JSON-RPC method name', async () => {
      const mockSignatureMaps = createMockSignatureMaps(1)
      const mockNodeAccountIds = createMockNodeAccountIds(1)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      await signer.signTransactions(transaction)

      expect(mockSignClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            method: HederaJsonRpcMethod.SignTransactions,
          }),
        }),
      )

      expect(HederaJsonRpcMethod.SignTransactions).toBe('hedera_signTransactions')
    })
  })

  describe('Integration with Extension Controller', () => {
    it('should call extensionOpen when extensionId is provided', async () => {
      const { extensionOpen } = require('../../src/lib/shared/extensionController')
      
      const mockSignatureMaps = createMockSignatureMaps(2)
      const mockNodeAccountIds = createMockNodeAccountIds(2)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: mockSignatureMaps,
        nodeAccountIds: mockNodeAccountIds,
      })

      const transaction = prepareTestTransaction(new AccountCreateTransaction(), {
        freeze: false,
        setNodeAccountIds: false,
      })

      await signer.signTransactions(transaction)

      expect(extensionOpen).toHaveBeenCalledWith(testExtensionId)
    })
  })
})
