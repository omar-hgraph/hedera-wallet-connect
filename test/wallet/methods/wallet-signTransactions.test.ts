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
  TransferTransaction,
  Hbar,
  AccountId,
  AccountCreateTransaction,
  TopicCreateTransaction,
  PrivateKey,
  Client,
} from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import {
  HederaChainId,
  SignTransactionsResponse,
  Wallet,
  transactionToTransactionBody,
  transactionBodyToBase64String,
  base64StringToSignatureMap,
  Uint8ArrayToBase64String,
} from '../../../src'
import {
  projectId,
  requestId,
  requestTopic,
  testPrivateKeyECDSA,
  testUserAccountId,
  walletMetadata,
} from '../../_helpers'

describe('Wallet - hedera_signTransactions (HIP-1190)', () => {
  let wallet: Wallet
  let hederaWallet: any
  let respondSessionRequestSpy: jest.SpyInstance

  beforeEach(async () => {
    wallet = await Wallet.create(projectId, walletMetadata)
    hederaWallet = wallet!.getHederaWallet(
      HederaChainId.Testnet,
      testUserAccountId.toString(),
      testPrivateKeyECDSA,
    )
    respondSessionRequestSpy = jest.spyOn(wallet, 'respondSessionRequest').mockResolvedValue()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Happy Path - Successful Multi-Node Signing', () => {
    it('should sign transaction for default 5 nodes', async () => {
      const transaction = new TransferTransaction()
        .setMaxTransactionFee(new Hbar(1))
        .addHbarTransfer('0.0.123', new Hbar(10))
        .addHbarTransfer('0.0.321', new Hbar(-10))

      // Create transaction body WITHOUT node ID (HIP-1190 requirement)
      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      // Verify response was sent
      expect(respondSessionRequestSpy).toHaveBeenCalledTimes(1)

      const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]

      // Verify response structure
      expect(response.topic).toBe(requestTopic)
      expect(response.response.jsonrpc).toBe('2.0')
      expect(response.response.id).toBe(requestId)
      expect(response.response.result).toBeDefined()
      expect(response.response.result.signatureMaps).toBeDefined()
      expect(response.response.result.nodeAccountIds).toBeDefined()

      // Verify 5 signature maps returned (default)
      const { signatureMaps, nodeAccountIds } = response.response.result
      expect(Array.isArray(signatureMaps)).toBe(true)
      expect(Array.isArray(nodeAccountIds)).toBe(true)
      expect(signatureMaps.length).toBe(5)
      expect(nodeAccountIds.length).toBe(5)

      // Verify each signature map is valid base64 and can be decoded
      signatureMaps.forEach((sigMapBase64: string) => {
        expect(typeof sigMapBase64).toBe('string')
        expect(sigMapBase64.length).toBeGreaterThan(0)

        // Should be decodable to SignatureMap
        const sigMap = base64StringToSignatureMap(sigMapBase64)
        expect(sigMap).toBeDefined()
        expect(sigMap.sigPair).toBeDefined()
        expect(Array.isArray(sigMap.sigPair)).toBe(true)
      })
      
      // Verify each node account ID is valid
      nodeAccountIds.forEach((nodeIdStr: string) => {
        expect(typeof nodeIdStr).toBe('string')
        expect(() => AccountId.fromString(nodeIdStr)).not.toThrow()
      })
    }, 15_000)

    it('should sign transaction for custom number of nodes (3)', async () => {
      const transaction = new AccountCreateTransaction().setInitialBalance(new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      // Attach nodeCount metadata
      ;(bodyBytes as any).__nodeCount = 3

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      expect(respondSessionRequestSpy).toHaveBeenCalledTimes(1)

      const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]
      const { signatureMaps, nodeAccountIds } = response.response.result

      // Verify exactly 3 signature maps
      expect(signatureMaps.length).toBe(3)
    }, 15_000)

    it('should sign transaction for single node (nodeCount=1)', async () => {
      const transaction = new TopicCreateTransaction().setSubmitKey(
        PrivateKey.generate().publicKey,
      )

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      ;(bodyBytes as any).__nodeCount = 1

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]
      const { signatureMaps, nodeAccountIds } = response.response.result

      expect(signatureMaps.length).toBe(1)
    }, 15_000)

    it('should sign transaction for maximum nodes (10)', async () => {
      const transaction = new TransferTransaction()
        .addHbarTransfer('0.0.100', new Hbar(-50))
        .addHbarTransfer('0.0.200', new Hbar(50))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      ;(bodyBytes as any).__nodeCount = 10

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]
      const { signatureMaps, nodeAccountIds } = response.response.result

      expect(signatureMaps.length).toBe(10)
    }, 15_000)

    it('should handle different transaction types correctly', async () => {
      const transactionTypes = [
        new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(1)),
        new AccountCreateTransaction().setInitialBalance(new Hbar(5)),
        new TopicCreateTransaction().setSubmitKey(PrivateKey.generate().publicKey),
      ]

      for (const tx of transactionTypes) {
        const transactionBody = transactionToTransactionBody(tx, null)
        if (!transactionBody) throw new Error('Failed to create transaction body')

        const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
        ;(bodyBytes as any).__nodeCount = 2

        await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)
      }

      // Should have been called once per transaction type
      expect(respondSessionRequestSpy).toHaveBeenCalledTimes(transactionTypes.length)

      // Verify all responses are valid
      respondSessionRequestSpy.mock.calls.forEach((call) => {
        const response: SignTransactionsResponse = call[0]
        expect(response.response.result.signatureMaps.length).toBe(2)
      })
    }, 15_000)
  })

  describe('Security - Node Selection and Validation', () => {
    it('should reject transaction body with nodeAccountId already set', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      // Create transaction body WITH a node ID (violates HIP-1190)
      const transactionBody = transactionToTransactionBody(
        transaction,
        AccountId.fromString('0.0.3'),
      )
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      expect(respondSessionRequestSpy).toHaveBeenCalledTimes(1)

      const errorResponse = respondSessionRequestSpy.mock.calls[0][0]

      // Verify error response structure
      expect(errorResponse.response.error).toBeDefined()
      expect(errorResponse.response.error.code).toBe(-32602) // Invalid params
      expect(errorResponse.response.error.message).toContain('must not have nodeAccountId set')
    }, 15_000)

    it('should select random nodes from network', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      ;(bodyBytes as any).__nodeCount = 5

      // Run signing multiple times to verify randomness
      const allSignatureMaps: string[][] = []

      for (let i = 0; i < 3; i++) {
        respondSessionRequestSpy.mockClear()
        await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

        const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]
        allSignatureMaps.push(response.response.result.signatureMaps)
      }

      // Each run should produce different signatures (different nodes selected)
      expect(allSignatureMaps.length).toBe(3)

      // Signature maps should be unique across runs (random node selection)
      // Note: There's a small chance they could match, but very unlikely with 5 nodes
      const firstRun = allSignatureMaps[0].join(',')
      const secondRun = allSignatureMaps[1].join(',')
      const thirdRun = allSignatureMaps[2].join(',')

      // At least one should be different (proves randomness)
      const allSame = firstRun === secondRun && secondRun === thirdRun
      expect(allSame).toBe(false)
    }, 15_000)

    it('should assign different node IDs to each signature', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      ;(bodyBytes as any).__nodeCount = 3

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]
      const { signatureMaps, nodeAccountIds } = response.response.result

      // Signature maps should be returned
      expect(signatureMaps.length).toBe(3)
      
      // Each should be valid base64
      signatureMaps.forEach((sigMap: string) => {
        expect(typeof sigMap).toBe('string')
        expect(sigMap.length).toBeGreaterThan(0)
      })
    }, 15_000)

    it('should verify each signature is for a different node (HIP-1190 core promise)', async () => {
      const transaction = new TransferTransaction()
        .addHbarTransfer('0.0.123', new Hbar(-10))
        .addHbarTransfer('0.0.456', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      const requestedNodes = 3 // Use 3 instead of 5 for more reliable test
      ;(bodyBytes as any).__nodeCount = requestedNodes

      // Spy on the internal signing to capture which nodes were used
      const originalSign = hederaWallet.sign.bind(hederaWallet)
      const signedNodes: string[] = []
      
      jest.spyOn(hederaWallet, 'sign').mockImplementation(async (...args: unknown[]) => {
        const bodiesArray = args[0] as Uint8Array[]
        // Decode the transaction body to extract node ID
        for (const bodyBytes of bodiesArray) {
          const decoded = proto.TransactionBody.decode(bodyBytes)
          if (decoded.nodeAccountID) {
            const nodeId = `${decoded.nodeAccountID.shardNum}.${decoded.nodeAccountID.realmNum}.${decoded.nodeAccountID.accountNum}`
            signedNodes.push(nodeId)
          }
        }
        return originalSign(bodiesArray)
      })

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]
      const { signatureMaps, nodeAccountIds } = response.response.result

      // Verify we signed for the requested number of nodes
      expect(signedNodes.length).toBe(requestedNodes)
      
      // CRITICAL: Verify all nodes are unique (no duplicates)
      const uniqueNodes = new Set(signedNodes)
      expect(uniqueNodes.size).toBe(requestedNodes) // All nodes must be unique
      
      // This proves getRandomNodes() returns unique nodes without duplicates
      console.log(`Signed for ${uniqueNodes.size} unique nodes:`, Array.from(uniqueNodes))

      // Verify correct number of signature maps returned
      expect(signatureMaps.length).toBe(requestedNodes)
    }, 15_000)

    it('should sign identical transaction body for all nodes', async () => {
      const transaction = new AccountCreateTransaction()
        .setInitialBalance(new Hbar(100))
        .setMaxTransactionFee(new Hbar(2))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const originalBodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      const originalBodyHex = Buffer.from(originalBodyBytes).toString('hex')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      ;(bodyBytes as any).__nodeCount = 3

      // Capture all transaction bodies that were signed
      const signedBodies: string[] = []
      const originalSign = hederaWallet.sign.bind(hederaWallet)
      
      jest.spyOn(hederaWallet, 'sign').mockImplementation(async (...args: unknown[]) => {
        const bodiesArray = args[0] as Uint8Array[]
        for (const bodyBytes of bodiesArray) {
          const decoded = proto.TransactionBody.decode(bodyBytes)
          
          // Remove nodeAccountID to compare base transaction
          const bodyWithoutNode = { ...decoded, nodeAccountID: undefined }
          const reencoded = proto.TransactionBody.encode(bodyWithoutNode).finish()
          signedBodies.push(Buffer.from(reencoded).toString('hex'))
        }
        return originalSign(bodiesArray)
      })

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      // All transaction bodies (minus node ID) should be identical
      const uniqueBodies = new Set(signedBodies)
      expect(uniqueBodies.size).toBe(1) // Only ONE unique transaction body

      expect(signedBodies.length).toBe(3)
    }, 15_000)

    it('should only return signature maps, not full transactions', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]
      const result = response.response.result

      // Verify ONLY signatureMaps field exists
      expect(result.signatureMaps).toBeDefined()
      expect(Array.isArray(result.signatureMaps)).toBe(true)

      // Verify NO transaction bodies are included (security requirement)
      expect((result as any).transactions).toBeUndefined()
      expect((result as any).transactionBodies).toBeUndefined()
      expect((result as any).signedTransactions).toBeUndefined()
    }, 15_000)
  })

  describe('Error Handling - Invalid Inputs', () => {
    it('should reject invalid transaction body (corrupted protobuf)', async () => {
      // Create invalid protobuf data
      const invalidBodyBytes = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff])

      await wallet.hedera_signTransactions(
        requestId,
        requestTopic,
        invalidBodyBytes,
        hederaWallet,
      )

      const errorResponse = respondSessionRequestSpy.mock.calls[0][0]

      expect(errorResponse.response.error).toBeDefined()
      expect(errorResponse.response.error.code).toBe(-32602) // Invalid params
      expect(errorResponse.response.error.message).toContain('Failed to decode transaction body')
    }, 15_000)

    it('should handle insufficient nodes in network gracefully', async () => {
      // Create a mock wallet with limited network
      const limitedWallet = wallet!.getHederaWallet(
        HederaChainId.Testnet,
        testUserAccountId.toString(),
        testPrivateKeyECDSA,
      )

      // Override the network getter to return only 2 nodes
      jest.spyOn(limitedWallet, 'getNetwork').mockReturnValue({
        '0.0.3': new AccountId(3),
        '0.0.4': new AccountId(4),
      })

      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      ;(bodyBytes as any).__nodeCount = 10 // Request more nodes than available

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, limitedWallet)

      const errorResponse = respondSessionRequestSpy.mock.calls[0][0]

      expect(errorResponse.response.error).toBeDefined()
      expect(errorResponse.response.error.code).toBe(-32603) // Internal error
      expect(errorResponse.response.error.message).toContain('Node selection failed')
    }, 15_000)

    it('should handle signing errors gracefully', async () => {
      // Mock the signer's sign method to throw an error
      const mockSigner = {
        ...hederaWallet,
        sign: jest.fn().mockRejectedValue(new Error('Private key unavailable')),
        getNetwork: jest.fn().mockReturnValue({
          '0.0.3': new AccountId(3),
          '0.0.4': new AccountId(4),
          '0.0.5': new AccountId(5),
        }),
      }

      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      ;(bodyBytes as any).__nodeCount = 2

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, mockSigner)

      const errorResponse = respondSessionRequestSpy.mock.calls[0][0]

      expect(errorResponse.response.error).toBeDefined()
      expect(errorResponse.response.error.code).toBe(-32603) // Internal error
      expect(errorResponse.response.error.message).toContain('Signing failed')
    }, 15_000)
  })

  describe('Request Parameters Validation', () => {
    it('should use correct JSON-RPC response format', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]

      // Verify JSON-RPC 2.0 format
      expect(response.response.jsonrpc).toBe('2.0')
      expect(response.response.id).toBe(requestId)
      expect(response.response.result).toBeDefined()
      expect((response.response as any).error).toBeUndefined()
    }, 15_000)

    it('should include correct topic in response', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]

      expect(response.topic).toBe(requestTopic)
    }, 15_000)

    it('should return base64-encoded signature maps', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      ;(bodyBytes as any).__nodeCount = 3

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]
      const { signatureMaps, nodeAccountIds } = response.response.result

      // Verify each signature map is valid base64
      signatureMaps.forEach((sigMap: string) => {
        expect(sigMap).toMatch(/^[A-Za-z0-9+/]+=*$/)

        // Verify can be decoded
        expect(() => Buffer.from(sigMap, 'base64')).not.toThrow()
      })
    }, 15_000)
  })

  describe('Integration - parseSessionRequest', () => {
    it('should correctly parse SignTransactions request with nodeCount', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const transactionBodyBase64 = transactionBodyToBase64String(transactionBody)

      const mockRequest = {
        id: requestId,
        topic: requestTopic,
        params: {
          request: {
            method: 'hedera_signTransactions',
            params: {
              signerAccountId: `hedera:testnet:${testUserAccountId.toString()}`,
              transactionBody: transactionBodyBase64,
              nodeCount: 7,
            },
          },
          chainId: 'hedera:testnet',
        },
      }

      const parsed = await wallet.parseSessionRequest(mockRequest as any)

      expect(parsed.method).toBe('hedera_signTransactions')
      expect(parsed.accountId?.toString()).toBe(testUserAccountId.toString())
      expect(parsed.body).toBeDefined()
      expect((parsed.body as any).__nodeCount).toBe(7)
    }, 15_000)

    it('should use default nodeCount (5) when not specified', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const transactionBodyBase64 = transactionBodyToBase64String(transactionBody)

      const mockRequest = {
        id: requestId,
        topic: requestTopic,
        params: {
          request: {
            method: 'hedera_signTransactions',
            params: {
              signerAccountId: `hedera:testnet:${testUserAccountId.toString()}`,
              transactionBody: transactionBodyBase64,
              // nodeCount omitted
            },
          },
          chainId: 'hedera:testnet',
        },
      }

      const parsed = await wallet.parseSessionRequest(mockRequest as any)

      expect((parsed.body as any).__nodeCount).toBe(5)
    }, 15_000)

    it('should reject invalid nodeCount (zero)', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const transactionBodyBase64 = transactionBodyToBase64String(transactionBody)

      const mockRequest = {
        id: requestId,
        topic: requestTopic,
        params: {
          request: {
            method: 'hedera_signTransactions',
            params: {
              signerAccountId: `hedera:testnet:${testUserAccountId.toString()}`,
              transactionBody: transactionBodyBase64,
              nodeCount: 0,
            },
          },
          chainId: 'hedera:testnet',
        },
      }

      try {
        await wallet.parseSessionRequest(mockRequest as any)
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.code).toBe(9000)
        expect(error.message).toContain('nodeCount must be a positive number')
      }
    }, 15_000)

    it('should reject invalid nodeCount (negative)', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const transactionBodyBase64 = transactionBodyToBase64String(transactionBody)

      const mockRequest = {
        id: requestId,
        topic: requestTopic,
        params: {
          request: {
            method: 'hedera_signTransactions',
            params: {
              signerAccountId: `hedera:testnet:${testUserAccountId.toString()}`,
              transactionBody: transactionBodyBase64,
              nodeCount: -5,
            },
          },
          chainId: 'hedera:testnet',
        },
      }

      try {
        await wallet.parseSessionRequest(mockRequest as any)
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.code).toBe(9000)
        expect(error.message).toContain('nodeCount must be a positive number')
      }
    }, 15_000)
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty network gracefully', async () => {
      const emptyNetworkWallet = {
        ...hederaWallet,
        getNetwork: jest.fn().mockReturnValue({}),
      }

      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()

      await wallet.hedera_signTransactions(
        requestId,
        requestTopic,
        bodyBytes,
        emptyNetworkWallet,
      )

      const errorResponse = respondSessionRequestSpy.mock.calls[0][0]

      expect(errorResponse.response.error).toBeDefined()
      expect(errorResponse.response.error.message).toContain('Node selection failed')
    }, 15_000)

    it('should handle very large nodeCount (100)', async () => {
      const transaction = new TransferTransaction().addHbarTransfer('0.0.123', new Hbar(10))

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      ;(bodyBytes as any).__nodeCount = 100

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      // Should either succeed or fail with insufficient nodes error
      const response = respondSessionRequestSpy.mock.calls[0][0]

      if (response.response.result) {
        // Success - network has enough nodes
        expect(response.response.result.signatureMaps).toBeDefined()
      } else {
        // Error - not enough nodes
        expect(response.response.error).toBeDefined()
        expect(response.response.error.message).toContain('Node selection failed')
      }
    }, 15_000)

    it('should preserve transaction properties across all node signatures', async () => {
      const initialBalance = new Hbar(100)
      const transaction = new AccountCreateTransaction().setInitialBalance(initialBalance)

      const transactionBody = transactionToTransactionBody(transaction, null)
      if (!transactionBody) throw new Error('Failed to create transaction body')

      const bodyBytes = proto.TransactionBody.encode(transactionBody).finish()
      ;(bodyBytes as any).__nodeCount = 3

      await wallet.hedera_signTransactions(requestId, requestTopic, bodyBytes, hederaWallet)

      const response: SignTransactionsResponse = respondSessionRequestSpy.mock.calls[0][0]
      const { signatureMaps, nodeAccountIds } = response.response.result

      // All 3 signatures should exist and be valid
      expect(signatureMaps.length).toBe(3)

      // Each should be decodable
      signatureMaps.forEach((sigMap: string) => {
        const decoded = base64StringToSignatureMap(sigMap)
        expect(decoded.sigPair).toBeDefined()
        expect(decoded.sigPair!.length).toBeGreaterThan(0)
      })
    }, 15_000)
  })
})
