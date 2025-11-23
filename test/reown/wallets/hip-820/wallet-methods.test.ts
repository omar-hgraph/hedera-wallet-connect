/*
 *
 * Hedera Wallet Connect
 *
 * Copyright (C) 2025 Hedera Hashgraph, LLC
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

import { Buffer } from 'buffer'
import {
  TopicCreateTransaction,
  AccountInfoQuery,
  PrecheckStatusError,
  Status,
  AccountInfo,
  TransactionResponse,
  PrivateKey,
} from '@hashgraph/sdk'
import {
  GetNodeAddresesResponse,
  HederaChainId,
  HIP820Wallet,
  SignAndExecuteTransactionResponse,
  SignMessageResult,
  SignTransactionResult,
  transactionToTransactionBody,
} from '../../../../src'
import { formatJsonRpcError, formatJsonRpcResult } from '@walletconnect/jsonrpc-utils'
import {
  testPrivateKeyECDSA,
  testUserAccountId,
  prepareTestTransaction,
  useJsonFixture,
  requestId,
  testNodeAccountId,
  testPrivateKeyED25519,
} from '../../../_helpers'
import { proto } from '@hashgraph/proto'

describe('HIP820Wallet Methods', () => {
  let hip820Wallet: HIP820Wallet
  const chainId = HederaChainId.Testnet
  const accountId = testUserAccountId.toString()

  beforeEach(() => {
    hip820Wallet = HIP820Wallet.init({
      chainId,
      accountId,
      privateKey: PrivateKey.fromStringECDSA(testPrivateKeyECDSA),
    })
  })

  describe('hedera_getNodeAddresses', () => {
    it('should return node addresses', async () => {
      const expected: GetNodeAddresesResponse = useJsonFixture(
        'methods/getNodeAddressesSuccess',
      )

      const result = await hip820Wallet.hedera_getNodeAddresses(requestId, null)

      result.result.nodes.sort()
      expected.response.result.nodes.sort()

      expect(result).toEqual(expected.response)
    }, 15_000)
  })

  describe('hedera_executeTransaction', () => {
    it('should execute signed transaction', async () => {
      try {
        const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
          freeze: true,
        })
        const mockResponse: SignAndExecuteTransactionResponse = useJsonFixture(
          'methods/executeTransactionSuccess',
        )

        const signerCallMock = jest.spyOn(hip820Wallet.wallet, 'call')
        signerCallMock.mockImplementation(async () => {}) // Mocking the 'call' method to do nothing

        const signTransaction = await hip820Wallet.wallet.signTransaction(transaction)

        const result = await hip820Wallet.hedera_executeTransaction(requestId, signTransaction)

        expect(result).toEqual(mockResponse.response)
      } catch (err) {}
    })

    it('should handle PrecheckStatusError', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction())

      const error = new PrecheckStatusError({
        status: Status.InvalidTransaction,
        transactionId: transaction.transactionId,
        nodeId: testNodeAccountId,
        contractFunctionResult: null,
      })
      error.message = 'Test error message'

      jest.spyOn(hip820Wallet.wallet, 'call').mockRejectedValue(error)

      const result = await hip820Wallet.hedera_executeTransaction(requestId, transaction)
      const expected = formatJsonRpcError(requestId, {
        code: 9000,
        message: error.message,
        data: error.status._code.toString(),
      })

      expect(result).toEqual(expected)
    })
  })

  describe('hedera_signMessage', () => {
    const testCases = [
      [
        'ECDSA',
        PrivateKey.fromStringECDSA(testPrivateKeyECDSA),
        'CmUKIQJ4J53yGuPNMGEGJ7HkI+u3QFxUuAOa9VLEtFj7Y6qNMzJAp3vxT7kRPE9HFFm/bbArGYDQ+psNWZC70rdW2bE1L85u79GOlQSTlaog5lmE6TiaX6r8Bk70dU7ZIwcHgnAkCw==',
      ],
      [
        'ED25519',
        PrivateKey.fromStringED25519(testPrivateKeyED25519),
        'CmQKIKLvE3YbZEplGhpKxmbq+6xBnJcoL4r1wz9Y1zLnPlpVGkBtfDTfBZGf/MUbovYyLUjORErDGhDYbzPFoAbkMwRrpw2ouDRmn6Dd6A06k6yM/FhZ/VjdHVhQUd+fxv1cZqUM',
      ],
    ]
    test.each(testCases)(
      'should decode message bytes and sign with: %p',
      async (_, privateKey, expected) => {
        const testWallet = HIP820Wallet.init({
          chainId,
          accountId,
          privateKey,
        })

        const id = 1

        const result = await testWallet.hedera_signMessage(id, 'Hello Future')

        const mockResponse: SignMessageResult = {
          jsonrpc: '2.0',
          id,
          result: {
            signatureMap: expected,
          },
        }

        expect(result).toEqual(mockResponse)
      },
    )
  })

  describe('hedera_signAndExecuteQuery', () => {
    it('should execute query successfully', async () => {
      const query = new AccountInfoQuery().setAccountId(testUserAccountId)
      const mockResponse = useJsonFixture('methods/signAndExecuteQuerySuccess')

      jest.spyOn(query, 'executeWithSigner').mockResolvedValue({
        toBytes: () => Buffer.from(JSON.stringify(mockResponse)),
      } as unknown as AccountInfo)

      const result = await hip820Wallet.hedera_signAndExecuteQuery(requestId, query)

      expect(result).toEqual(
        formatJsonRpcResult(requestId, {
          response: Buffer.from(JSON.stringify(mockResponse)).toString('base64'),
        }),
      )
    })
  })

  describe('hedera_signAndExecuteTransaction', () => {
    it('should sign and execute unfreeze transaction', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: false,
      })
      const freezeWithSignerSpy = jest.spyOn(transaction, 'freezeWithSigner')
      const signWithSignerSpy = jest.spyOn(transaction, 'signWithSigner')
      const mockResponse: SignAndExecuteTransactionResponse = useJsonFixture(
        'methods/signAndExecuteTransactionSuccess',
      )

      jest.spyOn(transaction, 'executeWithSigner').mockResolvedValue({
        toJSON: () => mockResponse.response.result,
      } as unknown as TransactionResponse)

      const result = await hip820Wallet.hedera_signAndExecuteTransaction(requestId, transaction)

      expect(result).toEqual(mockResponse.response)
      expect(freezeWithSignerSpy).toHaveBeenCalled()
      expect(signWithSignerSpy).toHaveBeenCalled()
    })
    it('should sign and execute freeze transaction', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })
      const freezeWithSignerSpy = jest.spyOn(transaction, 'freezeWithSigner')
      const signWithSignerSpy = jest.spyOn(transaction, 'signWithSigner')
      const mockResponse: SignAndExecuteTransactionResponse = useJsonFixture(
        'methods/signAndExecuteTransactionSuccess',
      )

      jest.spyOn(transaction, 'executeWithSigner').mockResolvedValue({
        toJSON: () => mockResponse.response.result,
      } as unknown as TransactionResponse)

      const result = await hip820Wallet.hedera_signAndExecuteTransaction(requestId, transaction)

      expect(result).toEqual(mockResponse.response)
      expect(freezeWithSignerSpy).toHaveBeenCalledTimes(0)
      expect(signWithSignerSpy).toHaveBeenCalled()
    })
  })

  describe('hedera_signTransaction', () => {
    it('should sign transaction body', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const transactionBody = transactionToTransactionBody(transaction)
      const uint8ArrayBody = proto.TransactionBody.encode(transactionBody).finish()

      const result = await hip820Wallet.hedera_signTransaction(requestId, uint8ArrayBody)

      const mockResponse: SignTransactionResult = {
        id: requestId,
        jsonrpc: '2.0',
        result: {
          signatureMap:
            'CmUKIQJ4J53yGuPNMGEGJ7HkI+u3QFxUuAOa9VLEtFj7Y6qNMzJAWvfY3/rze02Lel+X7MW3mHXDMwoaq9tQbD3aVLiXtDgvmB8J9gCumRq30CzZcq4ceMuaJpEs8UOAfGJSU87ORQ==',
        },
      }

      expect(result).toEqual(mockResponse)
    })
  })

  describe('hedera_signTransactions', () => {
    it('should sign transaction body for multiple nodes and return nodeAccountIds', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const transactionBody = transactionToTransactionBody(transaction, null)
      const uint8ArrayBody = proto.TransactionBody.encode(transactionBody).finish()

      const result = await hip820Wallet.hedera_signTransactions(requestId, uint8ArrayBody, 3)

      expect(result).toHaveProperty('jsonrpc', '2.0')
      expect(result).toHaveProperty('id', requestId)
      expect(result).toHaveProperty('result')
      
      const resultData = (result as any).result
      expect(resultData).toHaveProperty('signatureMaps')
      expect(resultData).toHaveProperty('nodeAccountIds')
      expect(Array.isArray(resultData.signatureMaps)).toBe(true)
      expect(Array.isArray(resultData.nodeAccountIds)).toBe(true)
      expect(resultData.signatureMaps.length).toBe(3)
      expect(resultData.nodeAccountIds.length).toBe(3)

      resultData.signatureMaps.forEach((sigMap: string) => {
        expect(typeof sigMap).toBe('string')
        expect(sigMap.length).toBeGreaterThan(0)
      })

      resultData.nodeAccountIds.forEach((nodeId: string) => {
        expect(typeof nodeId).toBe('string')
        expect(nodeId).toMatch(/^0\.0\.\d+$/)
      })
    })

    it('should use default nodeCount of 5 when not specified', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const transactionBody = transactionToTransactionBody(transaction, null)
      const uint8ArrayBody = proto.TransactionBody.encode(transactionBody).finish()

      const result = await hip820Wallet.hedera_signTransactions(requestId, uint8ArrayBody)

      const resultData = (result as any).result
      expect(resultData.signatureMaps.length).toBe(5)
      expect(resultData.nodeAccountIds.length).toBe(5)
    })

    it('should reject transaction body with nodeAccountId already set', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const transactionBody = transactionToTransactionBody(transaction, testNodeAccountId)
      const uint8ArrayBody = proto.TransactionBody.encode(transactionBody).finish()

      const result = await hip820Wallet.hedera_signTransactions(requestId, uint8ArrayBody, 3)

      expect(result).toHaveProperty('error')
      const errorResult = (result as any).error
      expect(errorResult.code).toBe(-32602)
      expect(errorResult.message).toBe('Invalid params')
    })

    it('should handle invalid transaction body', async () => {
      const invalidBody = new Uint8Array([1, 2, 3, 4, 5])

      const result = await hip820Wallet.hedera_signTransactions(requestId, invalidBody, 3)

      expect(result).toHaveProperty('error')
      const errorResult = (result as any).error
      expect(errorResult.code).toBe(-32602)
      expect(errorResult.message).toBe('Invalid params')
    })

    it('should sign transaction for single node (nodeCount=1)', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const transactionBody = transactionToTransactionBody(transaction, null)
      const uint8ArrayBody = proto.TransactionBody.encode(transactionBody).finish()

      const result = await hip820Wallet.hedera_signTransactions(requestId, uint8ArrayBody, 1)

      const resultData = (result as any).result
      expect(resultData.signatureMaps.length).toBe(1)
      expect(resultData.nodeAccountIds.length).toBe(1)
    })

    it('should handle multiple signing requests in sequence', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const transactionBody = transactionToTransactionBody(transaction, null)
      const uint8ArrayBody = proto.TransactionBody.encode(transactionBody).finish()

      const result1 = await hip820Wallet.hedera_signTransactions(requestId, uint8ArrayBody, 2)
      const result2 = await hip820Wallet.hedera_signTransactions(requestId + 1, uint8ArrayBody, 2)
      const result3 = await hip820Wallet.hedera_signTransactions(requestId + 2, uint8ArrayBody, 2)

      expect((result1 as any).result.signatureMaps.length).toBe(2)
      expect((result2 as any).result.signatureMaps.length).toBe(2)
      expect((result3 as any).result.signatureMaps.length).toBe(2)
    })

    it('should never select duplicate nodes for same request', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const transactionBody = transactionToTransactionBody(transaction, null)
      const uint8ArrayBody = proto.TransactionBody.encode(transactionBody).finish()

      const network = hip820Wallet.getHederaWallet().getNetwork()
      const availableNodeCount = Object.keys(network).length
      const requestNodeCount = Math.min(3, availableNodeCount)

      const result = await hip820Wallet.hedera_signTransactions(requestId, uint8ArrayBody, requestNodeCount)

      const resultData = (result as any).result
      const nodeIds = resultData.nodeAccountIds
      const uniqueNodeIds = new Set(nodeIds)

      expect(uniqueNodeIds.size).toBe(nodeIds.length)
      expect(uniqueNodeIds.size).toBe(requestNodeCount)
    })

    it('should verify all node IDs are from available network', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const transactionBody = transactionToTransactionBody(transaction, null)
      const uint8ArrayBody = proto.TransactionBody.encode(transactionBody).finish()

      const result = await hip820Wallet.hedera_signTransactions(requestId, uint8ArrayBody, 3)

      const resultData = (result as any).result
      const network = hip820Wallet.getHederaWallet().getNetwork()
      const availableNodeIds = Object.values(network).map((node: any) => 
        node.toString ? node.toString() : String(node)
      )

      resultData.nodeAccountIds.forEach((nodeId: string) => {
        expect(availableNodeIds).toContain(nodeId)
      })
    })

    it('should return arrays with matching lengths', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const transactionBody = transactionToTransactionBody(transaction, null)
      const uint8ArrayBody = proto.TransactionBody.encode(transactionBody).finish()

      const result = await hip820Wallet.hedera_signTransactions(requestId, uint8ArrayBody, 4)

      const resultData = (result as any).result
      expect(resultData.signatureMaps.length).toBe(resultData.nodeAccountIds.length)
      expect(resultData.signatureMaps.length).toBe(4)
    })

    it('should decode each signature map successfully', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const transactionBody = transactionToTransactionBody(transaction, null)
      const uint8ArrayBody = proto.TransactionBody.encode(transactionBody).finish()

      const result = await hip820Wallet.hedera_signTransactions(requestId, uint8ArrayBody, 3)

      const resultData = (result as any).result
      
      resultData.signatureMaps.forEach((sigMapBase64: string) => {
        expect(() => {
          const sigMapBytes = Buffer.from(sigMapBase64, 'base64')
          const sigMap = proto.SignatureMap.decode(sigMapBytes)
          expect(sigMap.sigPair).toBeDefined()
          expect(Array.isArray(sigMap.sigPair)).toBe(true)
        }).not.toThrow()
      })
    })
  })
})
