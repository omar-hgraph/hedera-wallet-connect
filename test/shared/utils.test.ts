import { AccountId } from '@hashgraph/sdk'
import { getRandomNodes } from '../../src/lib/shared/utils'

describe('getRandomNodes (HIP-1190)', () => {
  describe('Basic Functionality', () => {
    it('should select N random nodes from network', () => {
      const network = {
        '0.0.3': AccountId.fromString('0.0.3'),
        '0.0.4': AccountId.fromString('0.0.4'),
        '0.0.5': AccountId.fromString('0.0.5'),
        '0.0.6': AccountId.fromString('0.0.6'),
        '0.0.7': AccountId.fromString('0.0.7'),
        '0.0.8': AccountId.fromString('0.0.8'),
        '0.0.9': AccountId.fromString('0.0.9'),
        '0.0.10': AccountId.fromString('0.0.10'),
      }

      const selected = getRandomNodes(network, 5)

      expect(selected).toHaveLength(5)
      expect(selected.every(node => node instanceof AccountId)).toBe(true)
      
      const networkIds = Object.values(network).map(n => n.toString())
      selected.forEach(node => {
        expect(networkIds).toContain(node.toString())
      })
    })

    it('should handle string node values', () => {
      const network = {
        '0.0.3': '0.0.3',
        '0.0.4': '0.0.4',
        '0.0.5': '0.0.5',
      }

      const selected = getRandomNodes(network, 2)

      expect(selected).toHaveLength(2)
      expect(selected.every(node => node instanceof AccountId)).toBe(true)
    })

    it('should default to 5 nodes when count not specified', () => {
      const network = createNetworkWithNodes(10)

      const selected = getRandomNodes(network)

      expect(selected).toHaveLength(5)
    })
  })

  describe('Error Handling', () => {
    it('should throw error if not enough nodes available', () => {
      const network = {
        '0.0.3': AccountId.fromString('0.0.3'),
        '0.0.4': AccountId.fromString('0.0.4'),
      }

      expect(() => getRandomNodes(network, 5)).toThrow('Insufficient nodes available')
    })

    it('should handle empty network', () => {
      const network = {}

      expect(() => getRandomNodes(network, 1)).toThrow('Insufficient nodes available')
    })
  })

  describe('Randomization', () => {
    it('should return different selections on multiple calls', () => {
      const network = createNetworkWithNodes(20)

      const selections = []
      for (let i = 0; i < 10; i++) {
        selections.push(getRandomNodes(network, 5))
      }

      const firstSelection = selections[0].map(n => n.toString()).sort().join(',')
      const allIdentical = selections.every(
        sel => sel.map(n => n.toString()).sort().join(',') === firstSelection
      )

      expect(allIdentical).toBe(false)
    })

    it('should not return duplicate nodes in single selection', () => {
      const network = createNetworkWithNodes(10)

      const selected = getRandomNodes(network, 5)
      const nodeStrings = selected.map(n => n.toString())
      const uniqueNodes = new Set(nodeStrings)

      expect(uniqueNodes.size).toBe(5)
    })
  })

  describe('Edge Cases', () => {
    it('should work with exactly matching node count', () => {
      const network = createNetworkWithNodes(5)

      const selected = getRandomNodes(network, 5)

      expect(selected).toHaveLength(5)
    })

    it('should work with single node selection', () => {
      const network = createNetworkWithNodes(5)

      const selected = getRandomNodes(network, 1)

      expect(selected).toHaveLength(1)
      expect(selected[0]).toBeInstanceOf(AccountId)
    })
  })
})

function createNetworkWithNodes(count: number): { [key: string]: AccountId } {
  const network: { [key: string]: AccountId } = {}
  for (let i = 0; i < count; i++) {
    const nodeId = `0.0.${i + 3}`
    network[nodeId] = AccountId.fromString(nodeId)
  }
  return network
}