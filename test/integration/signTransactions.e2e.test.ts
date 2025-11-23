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
  AccountId,
  LedgerId,
  PrivateKey,
  TransferTransaction,
  Hbar,
  Transaction,
  TransactionId,
  AccountCreateTransaction,
} from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import { ISignClient, SessionTypes } from '@walletconnect/types'
import { DAppSigner, Uint8ArrayToBase64String, transactionToTransactionBody } from '../../src'
import { dAppMetadata, useJsonFixture } from '../_helpers'
import { HederaJsonRpcMethod } from '../../src/lib/shared/methods'

jest.mock('../../src/lib/shared/extensionController', () => ({
  extensionOpen: jest.fn(),
}))

/*
 * Integration tests for HIP-1190 signTransactions method
 *
 * Tests the complete transaction signing flow from DApp to wallet and back,
 * verifying multi-node signature generation and transaction reconstruction.
 *
 * @see https://hips.hedera.com/hip/hip-1190
 */
describe('HIP-1190 signTransactions - End-to-End Integration', () => {
  let signer: DAppSigner
  let mockSignClient: jest.Mocked<ISignClient>
  const fakeSession = useJsonFixture('fakeSession') as SessionTypes.Struct
  const testAccountId = AccountId.fromString('0.0.123')
  const testTopic = 'test-topic'
  const testExtensionId = 'test-extension-id'

  /*
   * Creates mock signature maps for specified node accounts
   *
   * @param nodeIds - Array of node account IDs to create signatures for
   * @param signerKey - Private key used to generate public key for signature pairs
   * @returns Object containing base64-encoded signature maps and corresponding node account IDs
   */
  const createSignatureMapsForNodes = (nodeIds: AccountId[], signerKey: PrivateKey): { signatureMaps: string[], nodeAccountIds: string[] } => {
    const signatureMaps: string[] = []
    const nodeAccountIds: string[] = []
    
    nodeIds.forEach((nodeId) => {
      const mockSignature = new Uint8Array(64).fill(parseInt(nodeId.num.toString()) % 256)
      
      const sigMap = proto.SignatureMap.encode({
        sigPair: [
          {
            pubKeyPrefix: signerKey.publicKey.toBytes(),
            ed25519: mockSignature,
          },
        ],
      }).finish()

      signatureMaps.push(Uint8ArrayToBase64String(sigMap))
      nodeAccountIds.push(nodeId.toString())
    })
    
    return { signatureMaps, nodeAccountIds }
  }

  beforeEach(() => {
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

    signer = new DAppSigner(
      testAccountId,
      mockSignClient,
      testTopic,
      LedgerId.TESTNET,
      testExtensionId,
    )
  })

  describe('Complete flow: DApp → Mock Wallet → DApp', () => {
    it('should successfully complete end-to-end transaction signing with multiple nodes', async () => {
      // Arrange - DApp creates a transaction
      const transaction = new TransferTransaction()
        .setTransactionId(TransactionId.generate(testAccountId))
        .addHbarTransfer(testAccountId, new Hbar(-10))
        .addHbarTransfer(AccountId.fromString('0.0.99999'), new Hbar(10))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze()

      const requestedNodeCount = 3
      
      // Arrange - Mock wallet response with signatures for 3 nodes
      const selectedNodes = [
        AccountId.fromString('0.0.3'),
        AccountId.fromString('0.0.5'),
        AccountId.fromString('0.0.7'),
      ]
      
      const walletPrivateKey = PrivateKey.generate()
      const { signatureMaps, nodeAccountIds } = createSignatureMapsForNodes(selectedNodes, walletPrivateKey)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps,
        nodeAccountIds,
      })

      // Act - DApp requests transaction signing
      const signedTransactions = await signer.signTransactions(
        transaction,
        requestedNodeCount,
      )

      // Assert - Verify request sent to wallet
      expect(mockSignClient.request).toHaveBeenCalledTimes(1)
      const requestCall = mockSignClient.request.mock.calls[0]
      
      expect(requestCall[0].topic).toBe(testTopic)
      expect(requestCall[0].request.method).toBe(HederaJsonRpcMethod.SignTransactions)
      expect(requestCall[0].request.params).toHaveProperty('transactionBody')
      expect(requestCall[0].request.params).toHaveProperty('nodeCount', requestedNodeCount)
      expect(requestCall[0].chainId).toBe('hedera:testnet')

      // Assert - Verify response contains expected number of transactions
      expect(signedTransactions).toHaveLength(requestedNodeCount)

      // Assert - Verify transaction reconstruction
      const uniqueNodeIds = new Set<string>()
      
      for (let i = 0; i < signedTransactions.length; i++) {
        const signedTx = signedTransactions[i]
        
        expect(signedTx.nodeAccountIds).not.toBeNull()
        expect(signedTx.nodeAccountIds).toHaveLength(1)
        
        const nodeId = signedTx.nodeAccountIds![0]
        uniqueNodeIds.add(nodeId.toString())
        
        expect(signedTx.transactionId?.toString()).toBe(transaction.transactionId?.toString())
      }

      // Assert - Verify node diversity
      expect(uniqueNodeIds.size).toBe(requestedNodeCount)

      // Assert - Verify transactions are ready for network submission
      for (const signedTx of signedTransactions) {
        expect(signedTx.isFrozen()).toBe(true)
        
        const txBytes = signedTx.toBytes()
        expect(txBytes).toBeInstanceOf(Uint8Array)
        expect(txBytes.length).toBeGreaterThan(0)
        
        const deserialized = Transaction.fromBytes(txBytes)
        expect(deserialized).toBeInstanceOf(TransferTransaction)
      }
    })

    it('should handle single node request correctly', async () => {
      const transaction = new AccountCreateTransaction()
        .setInitialBalance(new Hbar(5))
        .setTransactionId(TransactionId.generate(testAccountId))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze()

      const nodeId = AccountId.fromString('0.0.4')
      const walletPrivateKey = PrivateKey.generate()
      const { signatureMaps, nodeAccountIds } = createSignatureMapsForNodes([nodeId], walletPrivateKey)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps,
        nodeAccountIds,
      })

      const signedTransactions = await signer.signTransactions(transaction, 1)

      expect(signedTransactions).toHaveLength(1)
      expect(signedTransactions[0].nodeAccountIds).toHaveLength(1)
      expect(signedTransactions[0].nodeAccountIds![0].toString()).toBe(nodeId.toString())
    })

    it('should propagate wallet errors back to dApp', async () => {
      const transaction = new TransferTransaction()
        .setTransactionId(TransactionId.generate(testAccountId))
        .addHbarTransfer(testAccountId, new Hbar(-1))
        .addHbarTransfer(AccountId.fromString('0.0.77777'), new Hbar(1))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze()

      mockSignClient.request.mockRejectedValueOnce(new Error('User rejected the request'))

      await expect(signer.signTransactions(transaction, 3)).rejects.toThrow('User rejected the request')
    })

    it('should verify transaction bytes differ for each node', async () => {
      const transaction = new TransferTransaction()
        .setTransactionId(TransactionId.generate(testAccountId))
        .addHbarTransfer(testAccountId, new Hbar(-20))
        .addHbarTransfer(AccountId.fromString('0.0.11111'), new Hbar(20))
        .setTransactionMemo('End-to-end test')
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze()

      const selectedNodes = [
        AccountId.fromString('0.0.3'),
        AccountId.fromString('0.0.6'),
      ]
      
      const walletPrivateKey = PrivateKey.generate()
      const { signatureMaps, nodeAccountIds } = createSignatureMapsForNodes(selectedNodes, walletPrivateKey)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps,
        nodeAccountIds,
      })

      const signedTransactions = await signer.signTransactions(transaction, 2)

      // Extract transaction bytes
      const tx1Bytes = signedTransactions[0].toBytes()
      const tx2Bytes = signedTransactions[1].toBytes()

      expect(Buffer.from(tx1Bytes).toString('hex')).not.toBe(
        Buffer.from(tx2Bytes).toString('hex'),
      )

      const tx1 = signedTransactions[0] as TransferTransaction
      const tx2 = signedTransactions[1] as TransferTransaction

      expect(tx1.transactionId?.toString()).toBe(tx2.transactionId?.toString())
      expect(tx1.hbarTransfers.size).toBe(tx2.hbarTransfers.size)
      expect(tx1.nodeAccountIds![0].toString()).not.toBe(tx2.nodeAccountIds![0].toString())
    })
  })

  describe('Error handling', () => {
    it('should accept wallet returning fewer signatures than requested', async () => {
      const transaction = new TransferTransaction()
        .setTransactionId(TransactionId.generate(testAccountId))
        .addHbarTransfer(testAccountId, new Hbar(-1))
        .addHbarTransfer(AccountId.fromString('0.0.33333'), new Hbar(1))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze()

      const nodeId = AccountId.fromString('0.0.3')
      const walletPrivateKey = PrivateKey.generate()
      const { signatureMaps, nodeAccountIds } = createSignatureMapsForNodes([nodeId], walletPrivateKey)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps,
        nodeAccountIds,
      })

      const result = await signer.signTransactions(transaction, 3)
      
      expect(result).toHaveLength(1)
      expect(result[0].nodeAccountIds).toHaveLength(1)
    })

    it('should handle empty signature arrays from wallet', async () => {
      const transaction = new TransferTransaction()
        .setTransactionId(TransactionId.generate(testAccountId))
        .addHbarTransfer(testAccountId, new Hbar(-1))
        .addHbarTransfer(AccountId.fromString('0.0.22222'), new Hbar(1))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze()

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [],
        nodeAccountIds: [],
      })

      const result = await signer.signTransactions(transaction, 3)
      
      expect(result).toEqual([])
    })

    it('should reject malformed wallet response', async () => {
      const transaction = new TransferTransaction()
        .setTransactionId(TransactionId.generate(testAccountId))
        .addHbarTransfer(testAccountId, new Hbar(-1))
        .addHbarTransfer(AccountId.fromString('0.0.44444'), new Hbar(1))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze()

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps: [
          {
            signature: 'invalid-base64',
          },
        ],
      })

      await expect(signer.signTransactions(transaction, 1)).rejects.toThrow()
    })
  })

  describe('Transaction diversity verification', () => {
    it('should ensure all transactions have unique node IDs', async () => {
      const transaction = new TransferTransaction()
        .setTransactionId(TransactionId.generate(testAccountId))
        .addHbarTransfer(testAccountId, new Hbar(-15))
        .addHbarTransfer(AccountId.fromString('0.0.55555'), new Hbar(15))
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze()

      const nodes = [
        AccountId.fromString('0.0.3'),
        AccountId.fromString('0.0.4'),
        AccountId.fromString('0.0.5'),
        AccountId.fromString('0.0.6'),
        AccountId.fromString('0.0.7'),
      ]

      const walletPrivateKey = PrivateKey.generate()
      const { signatureMaps, nodeAccountIds } = createSignatureMapsForNodes(nodes, walletPrivateKey)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps,
        nodeAccountIds,
      })

      const signedTransactions = await signer.signTransactions(transaction, 5)

      const nodeIds = signedTransactions.map(tx => tx.nodeAccountIds![0].toString())
      const uniqueNodeIds = new Set(nodeIds)

      expect(uniqueNodeIds.size).toBe(5)
      expect(nodeIds.length).toBe(5)
    })

    it('should produce transactions with identical bodies except node IDs', async () => {
      const transaction = new TransferTransaction()
        .setTransactionId(TransactionId.generate(testAccountId))
        .addHbarTransfer(testAccountId, new Hbar(-25))
        .addHbarTransfer(AccountId.fromString('0.0.66666'), new Hbar(25))
        .setTransactionMemo('Diversity test')
        .setNodeAccountIds([AccountId.fromString('0.0.3')])
        .freeze()

      const nodes = [
        AccountId.fromString('0.0.3'),
        AccountId.fromString('0.0.8'),
      ]

      const walletPrivateKey = PrivateKey.generate()
      const { signatureMaps, nodeAccountIds } = createSignatureMapsForNodes(nodes, walletPrivateKey)

      mockSignClient.request.mockResolvedValueOnce({
        signatureMaps,
        nodeAccountIds,
      })

      const signedTransactions = await signer.signTransactions(transaction, 2)

      const body1 = transactionToTransactionBody(signedTransactions[0], null)
      const body2 = transactionToTransactionBody(signedTransactions[1], null)

      const body1Bytes = proto.TransactionBody.encode(body1!).finish()
      const body2Bytes = proto.TransactionBody.encode(body2!).finish()

      expect(Buffer.from(body1Bytes).toString('hex')).toBe(
        Buffer.from(body2Bytes).toString('hex'),
      )
    })
  })
})
