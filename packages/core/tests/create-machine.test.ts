import { describe, it, expect, vi } from 'vitest'
import { createMachine } from '../src/create-machine'
import type { MachineSchema } from '../src/create-machine'

type LightSchema = MachineSchema & {
  context: { count: number }
  props: { maxCount: number }
  event: { type: 'TOGGLE' } | { type: 'RESET' }
  state: 'green' | 'red'
  action: 'increment' | 'reset'
  guard: 'canIncrement'
}

describe('createMachine', () => {
  describe('basic functionality', () => {
    it('should create machine with initial state', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [],
      })

      expect(machine.getState()).toBe('green')
    })

    it('should create machine with initial context', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 5 },
        transitions: [],
      })

      expect(machine.getContext()).toEqual({ count: 5 })
    })

    it('should create machine with initial props', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        props: { maxCount: 10 },
        transitions: [],
      })

      expect(machine.getProps()).toEqual({ maxCount: 10 })
    })

    it('should create machine with id', () => {
      const machine = createMachine<LightSchema>({
        id: 'traffic-light',
        initial: 'green',
        transitions: [],
      })

      expect(machine.id).toBe('traffic-light')
    })
  })

  describe('state transitions', () => {
    it('should transition to new state on matching event', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red' }],
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('red')
    })

    it('should not transition when event does not match', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red' }],
      })

      machine.start()
      machine.send({ type: 'RESET' })

      expect(machine.getState()).toBe('green')
    })

    it('should not transition when from state does not match', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: 'red', event: 'TOGGLE', to: 'green' }],
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('green')
    })

    it('should handle multiple transitions', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [
          { from: 'green', event: 'TOGGLE', to: 'red' },
          { from: 'red', event: 'TOGGLE', to: 'green' },
        ],
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })
      expect(machine.getState()).toBe('red')

      machine.send({ type: 'TOGGLE' })
      expect(machine.getState()).toBe('green')
    })
  })

  describe('wildcard transitions', () => {
    it('should match wildcard from any state', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: '*', event: 'RESET', to: 'green' }],
      })

      machine.start()
      machine.send({ type: 'RESET' })
      expect(machine.getState()).toBe('green')
    })

    it('should match wildcard from different states', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [
          { from: 'green', event: 'TOGGLE', to: 'red' },
          { from: '*', event: 'RESET', to: 'green' },
        ],
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })
      expect(machine.getState()).toBe('red')

      machine.send({ type: 'RESET' })
      expect(machine.getState()).toBe('green')
    })
  })

  describe('priority', () => {
    it('should use higher priority transition when multiple match', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [
          { from: 'green', event: 'TOGGLE', to: 'red', priority: 1 },
          { from: '*', event: 'TOGGLE', to: 'green', priority: 10 },
        ],
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('green')
    })

    it('should sort and use highest priority from multiple matching transitions', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [
          { from: 'green', event: 'TOGGLE', to: 'red', priority: 5 },
          { from: '*', event: 'TOGGLE', to: 'green', priority: 10 },
          { from: 'green', event: 'TOGGLE', to: 'green', priority: 3 },
        ],
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('green')
    })

    it('should use first transition when priorities are equal', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [
          { from: 'green', event: 'TOGGLE', to: 'red', priority: 5 },
          { from: '*', event: 'TOGGLE', to: 'green', priority: 5 },
        ],
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('red')
    })

    it('should default priority to 0 when not specified', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [
          { from: 'green', event: 'TOGGLE', to: 'red' },
          { from: '*', event: 'TOGGLE', to: 'green', priority: 1 },
        ],
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('green')
    })

    it('should handle multiple transitions with no priority specified', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [
          { from: 'green', event: 'TOGGLE', to: 'red' },
          { from: '*', event: 'TOGGLE', to: 'green' },
        ],
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('red')
    })
  })

  describe('actions', () => {
    it('should execute action on transition', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 0 },
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red', action: 'increment' }],
        actions: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getContext()).toEqual({ count: 1 })
    })

    it('should not mutate context when action returns void', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 0 },
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red', action: 'increment' }],
        actions: {
          increment: () => {},
        },
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getContext()).toEqual({ count: 0 })
    })

    it('should pass event to action handler', () => {
      const incrementSpy = vi.fn(() => ({ count: 1 }))
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 0 },
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red', action: 'increment' }],
        actions: {
          increment: incrementSpy,
        },
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(incrementSpy).toHaveBeenCalledWith({
        context: { count: 0 },
        event: { type: 'TOGGLE' },
        props: {},
      })
    })

    it('should throw error when action handler not found', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red', action: 'increment' }],
        actions: {},
      })

      machine.start()

      expect(() => machine.send({ type: 'TOGGLE' })).toThrow('Action "increment" not found.')
    })

    it('should merge action result with existing context', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 5 },
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red', action: 'increment' }],
        actions: {
          increment: ({ context }) => ({ count: context.count + 10 }),
        },
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getContext()).toEqual({ count: 15 })
    })
  })

  describe('guards', () => {
    it('should allow transition when guard returns true', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 0 },
        props: { maxCount: 5 },
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red', guard: 'canIncrement' }],
        guards: {
          canIncrement: ({ context, props }) => context.count < props.maxCount,
        },
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('red')
    })

    it('should prevent transition when guard returns false', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 10 },
        props: { maxCount: 5 },
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red', guard: 'canIncrement' }],
        guards: {
          canIncrement: ({ context, props }) => context.count < props.maxCount,
        },
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('green')
    })

    it('should pass event to guard handler', () => {
      const guardSpy = vi.fn(() => true)
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 0 },
        props: { maxCount: 5 },
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red', guard: 'canIncrement' }],
        guards: {
          canIncrement: guardSpy,
        },
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(guardSpy).toHaveBeenCalledWith({
        context: { count: 0 },
        event: { type: 'TOGGLE' },
        props: { maxCount: 5 },
      })
    })

    it('should throw error when guard handler not found', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red', guard: 'canIncrement' }],
        guards: {},
      })

      machine.start()

      expect(() => machine.send({ type: 'TOGGLE' })).toThrow('Guard "canIncrement" not found.')
    })

    it('should evaluate guards before actions', () => {
      const actionSpy = vi.fn(() => ({ count: 1 }))
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 0 },
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red', guard: 'canIncrement', action: 'increment' }],
        guards: {
          canIncrement: () => false,
        },
        actions: {
          increment: actionSpy,
        },
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(actionSpy).not.toHaveBeenCalled()
      expect(machine.getContext()).toEqual({ count: 0 })
    })
  })

  describe('subscribe', () => {
    it('should notify listener on state change', () => {
      const listener = vi.fn()
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red' }],
      })

      machine.subscribe(listener, { immediate: false })
      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(listener).toHaveBeenCalledWith('red', {}, {})
    })

    it('should notify immediately when immediate is true', () => {
      const listener = vi.fn()
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 5 },
        props: { maxCount: 10 },
        transitions: [],
      })

      machine.subscribe(listener, { immediate: true })

      expect(listener).toHaveBeenCalledWith('green', { count: 5 }, { maxCount: 10 })
    })

    it('should notify immediately by default', () => {
      const listener = vi.fn()
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [],
      })

      machine.subscribe(listener)

      expect(listener).toHaveBeenCalledWith('green', {}, {})
    })

    it('should not notify when unsubscribed', () => {
      const listener = vi.fn()
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red' }],
      })

      const unsubscribe = machine.subscribe(listener, { immediate: false })
      unsubscribe()

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(listener).not.toHaveBeenCalled()
    })

    it('should notify multiple listeners', () => {
      const listenerA = vi.fn()
      const listenerB = vi.fn()
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red' }],
      })

      machine.subscribe(listenerA, { immediate: false })
      machine.subscribe(listenerB, { immediate: false })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(listenerA).toHaveBeenCalledWith('red', {}, {})
      expect(listenerB).toHaveBeenCalledWith('red', {}, {})
    })

    it('should continue notifying other listeners when one throws error', () => {
      const listenerA = vi.fn(() => {
        throw new Error('Listener error')
      })
      const listenerB = vi.fn()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red' }],
      })

      machine.subscribe(listenerA, { immediate: false })
      machine.subscribe(listenerB, { immediate: false })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(listenerA).toHaveBeenCalled()
      expect(listenerB).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('start and stop', () => {
    it('should not process events before start', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red' }],
      })

      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('green')
    })

    it('should process events after start', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red' }],
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('red')
    })

    it('should not process events after stop', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [
          { from: 'green', event: 'TOGGLE', to: 'red' },
          { from: 'red', event: 'TOGGLE', to: 'green' },
        ],
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })
      expect(machine.getState()).toBe('red')

      machine.stop()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('red')
    })

    it('should not start twice', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [],
      })

      machine.start()
      machine.start()

      expect(machine.getState()).toBe('green')
    })

    it('should not stop twice', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [],
      })

      machine.start()
      machine.stop()
      machine.stop()

      expect(machine.getState()).toBe('green')
    })
  })

  describe('matches', () => {
    it('should return true when state matches', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [],
      })

      expect(machine.matches('green')).toBe(true)
    })

    it('should return false when state does not match', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [],
      })

      expect(machine.matches('red')).toBe(false)
    })

    it('should match multiple states', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        transitions: [],
      })

      expect(machine.matches('green', 'red')).toBe(true)
      expect(machine.matches('red')).toBe(false)
    })
  })

  describe('syncProps', () => {
    it('should update props', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        props: { maxCount: 5 },
        transitions: [],
      })

      machine.syncProps({ maxCount: 10 })

      expect(machine.getProps()).toEqual({ maxCount: 10 })
    })

    it('should merge props with existing values', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        props: { maxCount: 5 },
        transitions: [],
      })

      machine.syncProps({ maxCount: 10 })

      expect(machine.getProps()).toEqual({ maxCount: 10 })
    })

    it('should notify listeners when props change', () => {
      const listener = vi.fn()
      const machine = createMachine<LightSchema>({
        initial: 'green',
        props: { maxCount: 5 },
        transitions: [],
      })

      machine.subscribe(listener)
      listener.mockClear()

      machine.syncProps({ maxCount: 10 })

      expect(listener).toHaveBeenCalledWith('green', {}, { maxCount: 10 })
    })
  })

  describe('immutability', () => {
    it('should return frozen context', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 0 },
        transitions: [],
      })

      const context = machine.getContext()

      expect(() => {
        // @ts-expect-error - testing runtime immutability
        context.count = 10
      }).toThrow()
    })

    it('should return frozen props', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        props: { maxCount: 5 },
        transitions: [],
      })

      const props = machine.getProps()

      expect(() => {
        // @ts-expect-error - testing runtime immutability
        props.maxCount = 10
      }).toThrow()
    })

    it('should not allow context mutation from action handler', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 0 },
        transitions: [{ from: 'green', event: 'TOGGLE', to: 'red', action: 'increment' }],
        actions: {
          increment: ({ context }) => {
            expect(() => {
              // @ts-expect-error - testing runtime immutability
              context.count = 10
            }).toThrow()

            return { count: context.count + 1 }
          },
        },
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })
    })
  })

  describe('re-entrancy protection', () => {
    it('should prevent re-entrant event sends during processing', () => {
      const machine = createMachine<LightSchema>({
        initial: 'green',
        context: { count: 0 },
        transitions: [
          { from: 'green', event: 'TOGGLE', to: 'red', action: 'increment' },
          { from: 'red', event: 'RESET', to: 'green', action: 'reset' },
        ],
        actions: {
          increment: ({ context }) => {
            machine.send({ type: 'RESET' })

            return { count: context.count + 1 }
          },
          reset: () => ({ count: 0 }),
        },
      })

      machine.start()
      machine.send({ type: 'TOGGLE' })

      expect(machine.getState()).toBe('red')
      expect(machine.getContext()).toEqual({ count: 1 })
    })
  })
})
