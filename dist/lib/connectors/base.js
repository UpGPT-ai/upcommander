/**
 * Abstract data connector interface for external data sources.
 *
 * All connectors must implement DataConnector and register themselves
 * via registerConnector() so they can be looked up by name at runtime.
 */
// ---------------------------------------------------------------------------
// Connector registry
// ---------------------------------------------------------------------------
/** Internal registry mapping connector names to their instances. */
const connectorRegistry = new Map();
/**
 * Register a connector implementation under its name.
 * Subsequent calls with the same name will overwrite the previous registration.
 *
 * @param name   Unique connector name (should match connector.name)
 * @param connector  The connector instance to register
 */
export function registerConnector(name, connector) {
    connectorRegistry.set(name, connector);
}
/**
 * Retrieve a registered connector by name.
 * Returns null if no connector is registered under that name.
 *
 * @param name The connector name used during registration
 */
export function getConnector(name) {
    return connectorRegistry.get(name) ?? null;
}
/**
 * List all currently registered connector names.
 */
export function listConnectors() {
    return Array.from(connectorRegistry.keys());
}
/**
 * Remove a connector from the registry.
 * Useful in tests or when hot-swapping connectors.
 *
 * @param name The connector name to remove
 * @returns true if a connector was removed, false if it was not registered
 */
export function unregisterConnector(name) {
    return connectorRegistry.delete(name);
}
// ---------------------------------------------------------------------------
// Base class (optional convenience implementation)
// ---------------------------------------------------------------------------
/**
 * Abstract base class that provides boilerplate for connector implementations.
 * Subclasses must implement: connect(), query(), disconnect(), and isConnected().
 * The stream() method is optional.
 */
export class BaseConnector {
    /**
     * Default stream implementation: fetches all data via query() and yields it
     * as a single chunk. Override for true streaming from large data sources.
     */
    async *stream(params) {
        yield await this.query(params);
    }
    /**
     * Assert that connect() has been called before attempting a query.
     * Call this at the start of query() and stream() in subclasses.
     */
    assertConnected() {
        if (!this.isConnected()) {
            throw new Error(`Connector "${this.name}" is not connected. Call connect() before query() or stream().`);
        }
    }
}
//# sourceMappingURL=base.js.map