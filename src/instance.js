import { makeLogger, defaultImport } from './utils'
const { info } = makeLogger('instance')

/**
 * Higher-order function to make a `dispatch` function given a network name,
 * `listeners` object and a `getHandler` function, which returns a handler that
 * will handle calling events sent to the protocol.
 *
 * @private
 * @param  {String} networkName
 * @param  {Object} listeners
 * @param  {Function} getHandler
 * @return {Function} dispatch
 */
const makeDispatch = (networkName, listeners, getHandler) => (event) => {
  if (!event || !event.type) throw new Error('event does not have the required `type` property')

  const handler = getHandler()
  const reply = handler

  const { type } = event
  info(`Dispatching "${type}" event.`)

  event.network = networkName

  // always dispatch `event` (wildcard) event
  if (listeners.hasOwnProperty('event')) {
    for (let callback of listeners['event']) {
      callback(event, reply)
    }
  }

  // dispatch certain event type
  if (listeners.hasOwnProperty(type)) {
    for (let callback of listeners[type]) {
      callback(event, reply)
    }
  }
}

/**
 * Higher-order function to make an `on` function given a `listeners` object.
 *
 * @private
 * @param  {Object} listeners
 * @return {Function} on
 */
const makeOn = (listeners) => (name, callback) => {
  info(`Listener being subscribed with the name "${name}".`)

  if (listeners[name] === undefined) {
    listeners[name] = [callback]
  } else {
    listeners[name].push(callback)
  }

  return function unsubscribe () {
    const i = listeners[name].indexOf(callback)
    listeners[name].splice(i, 1)
    info(`Unsubscribed listener for "${name}": ${callback.toString()}`)
  }
}

/**
 * Load a coffea protocol (`coffea-PROTOCOLNAME` npm package) via `require()`.
 *
 * @private
 * @param  {String} name
 * @return {Object} protocol instance
 * @throws {Error} if the protocol couldn't be `require`'d
 */
const loadProtocol = (name) => {
  try {
    info(`Attempting to load the protocol coffea-${name}`)
    return defaultImport(require('coffea-' + name))
  } catch (e) {
    throw new Error(`The protocol coffea-${name} isn't installed. Try running: npm install --save coffea-${name}`)
  }
}

/**
 * Get the name of a protocol.
 *
 * @private
 * @param  {String|Function} protocol
 * @return {String} protocol name
 */
const protocolName = (protocol) =>
  (typeof protocol === 'string') ? protocol : protocol.name

/**
 * Return a random name (with the specified length).
 *
 * @private
 * @param  {Number} length
 * @return {String} random name
 */
const randomName = (length = 5) =>
  Math.random().toString(36).substr(2, length)

/**
 * Create an instance of coffea which loads a protocol, uses it to connect to a
 * service and then provides events.
 *
 * @param  {Object} config
 * @return {Object}
 */
export default function instance (config) {
  if (!config.protocol || !(typeof config.protocol === 'string' || typeof config.protocol === 'function')) {
    throw new Error('Please pass a string or function as the protocol parameter.')
  }

  let name = config.name || (protocolName(config.protocol) + '_' + randomName())

  let listeners = {}

  let protocol
  if (typeof config.protocol === 'function') protocol = config.protocol
  else protocol = loadProtocol(config.protocol)

  let handler
  const dispatch = makeDispatch(name, listeners, () => handler)
  handler = protocol(config, dispatch)

  return {
    on: makeOn(listeners),
    send: handler,
    dispatch: dispatch
  }
}
