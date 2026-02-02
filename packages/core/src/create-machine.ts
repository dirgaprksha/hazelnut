import { freeze, filter, merge, sort } from '@pistachiojs/core'

export type MachineSchema = {
  context: Record<string, unknown>
  props: Record<string, unknown>
  event: { type: string }
  state: string
  action?: string
  guard?: string
}

export type MachineConfig<T extends MachineSchema> = {
  id?: string
  context?: T['context']
  props?: T['props']
  initial: T['state']
  transitions: MachineTransition<T>[]
  actions?: MachineActions<T>
  guards?: MachineGuards<T>
}

export type MachineTransition<T extends MachineSchema> = {
  from: T['state'] | '*'
  event: T['event']['type']
  to: T['state']
  action?: T['action']
  guard?: T['guard']
  priority?: number
}

export type MachineActions<T extends MachineSchema> = Partial<{
  [K in NonNullable<T['action']>]: (params: MachineParams<T>) => Partial<T['context']> | void
}>

export type MachineGuards<T extends MachineSchema> = Partial<{
  [K in NonNullable<T['guard']>]: (params: MachineParams<T>) => boolean
}>

export interface MachineParams<T extends MachineSchema> {
  context: Readonly<T['context']>
  event: T['event']
  props: Readonly<T['props']>
}

export type MachineReturn<T extends MachineSchema> = {
  id?: string
  start: () => void
  stop: () => void
  send: (event: T['event']) => void
  subscribe: (
    listener: (state: T['state'], context: Readonly<T['context']>, props: Readonly<T['props']>) => void,
    options?: { immediate?: boolean },
  ) => () => void
  matches: (...states: T['state'][]) => boolean
  syncProps: (props: Readonly<T['props']>) => void
  getState: () => T['state']
  getContext: () => Readonly<T['context']>
  getProps: () => Readonly<T['props']>
}

/**
 * Creates a runtime machine instance.
 * @param config - Machine configuration.
 * @returns Machine instance.
 */
export function createMachine<T extends MachineSchema>(config: MachineConfig<T>): MachineReturn<T> {
  let state = config.initial
  let context = config.context ?? ({} as T['context'])
  let props = (config.props ?? {}) as T['props']
  const listeners = new Set<(state: T['state'], context: Readonly<T['context']>, props: Readonly<T['props']>) => void>()
  let running = false
  let processing = false

  const start = () => {
    if (running) return
    running = true
  }

  const stop = () => {
    if (!running) return
    running = false
  }

  const send = (event: T['event']) => {
    if (!running) return
    if (processing) return
    processing = true

    try {
      const matches = filter(config.transitions, (transition) => {
        if (!(transition.from === '*' || transition.from === state) || !(transition.event === event.type)) return false
        if (transition.guard) {
          const handler = config.guards?.[transition.guard]
          if (!handler) {
            throw new Error(`Guard "${transition.guard}" not found.`)
          }

          return handler({ context: getContext(), event, props: getProps() })
        }

        return true
      })

      if (matches.length === 0) return
      const transition = sort(matches, (a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0]

      state = transition.to

      if (transition.action) {
        const handler = config.actions?.[transition.action]
        if (!handler) {
          throw new Error(`Action "${transition.action}" not found.`)
        }

        const result = handler({ context: getContext(), event, props: getProps() })
        if (result) {
          context = { ...context, ...result }
        }
      }

      notify()
    } finally {
      processing = false
    }
  }

  const subscribe = (
    listener: (state: T['state'], context: Readonly<T['context']>, props: Readonly<T['props']>) => void,
    options: { immediate?: boolean } = {},
  ) => {
    const { immediate = true } = options
    listeners.add(listener)

    if (immediate) {
      listener(state, getContext(), getProps())
    }

    return () => listeners.delete(listener)
  }

  const notify = () => {
    for (const listener of listeners) {
      try {
        listener(state, getContext(), getProps())
      } catch (error) {
        console.error('Listener error:', error)
      }
    }
  }

  const syncProps = (newProps: Readonly<T['props']>) => {
    props = merge(props, newProps)

    notify()
  }

  const getContext = (): Readonly<T['context']> => {
    return freeze({ ...context })
  }

  const getProps = (): Readonly<T['props']> => {
    return freeze({ ...props })
  }

  return {
    id: config.id,
    start,
    stop,
    send,
    subscribe,
    matches: (...states) => states.includes(state),
    syncProps,
    getState: () => state,
    getContext,
    getProps,
  }
}
