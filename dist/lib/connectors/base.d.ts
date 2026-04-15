/**
 * Abstract data connector interface for external data sources.
 *
 * All connectors must implement DataConnector and register themselves
 * via registerConnector() so they can be looked up by name at runtime.
 */
/**
 * A DataConnector abstracts an external data source (CSV file, REST API,
 * database, message queue, etc.) behind a uniform query/stream interface.
 *
 * Lifecycle:
 *   1. connect(config) — establish connection / validate credentials
 *   2. query(params)   — fetch a snapshot of data (returns Promise)
 *   2. stream(params)  — optional: stream data incrementally (AsyncGenerator)
 *   3. disconnect()    — release resources cleanly
 */
export interface DataConnector {
    /** Unique name identifying this connector (e.g. 'sentinel-csv', 'google-ads-api'). */
    name: string;
    /**
     * Establish a connection to the data source.
     * @param config Connector-specific configuration (credentials, file paths, URLs, etc.)
     */
    connect(config: Record<string, unknown>): Promise<void>;
    /**
     * Fetch data from the source.
     * @param params Query parameters (connector-specific: date ranges, filters, limits, etc.)
     * @returns The fetched data in a connector-specific format.
     */
    query(params: Record<string, unknown>): Promise<unknown>;
    /**
     * Stream data incrementally from the source (optional).
     * Implement when the data source is too large to load into memory at once.
     * @param params Stream parameters (connector-specific)
     */
    stream?(params: Record<string, unknown>): AsyncGenerator<unknown>;
    /**
     * Disconnect from the data source and release any held resources.
     */
    disconnect(): Promise<void>;
    /**
     * Returns true if the connector currently has an active connection.
     */
    isConnected(): boolean;
}
/**
 * Register a connector implementation under its name.
 * Subsequent calls with the same name will overwrite the previous registration.
 *
 * @param name   Unique connector name (should match connector.name)
 * @param connector  The connector instance to register
 */
export declare function registerConnector(name: string, connector: DataConnector): void;
/**
 * Retrieve a registered connector by name.
 * Returns null if no connector is registered under that name.
 *
 * @param name The connector name used during registration
 */
export declare function getConnector(name: string): DataConnector | null;
/**
 * List all currently registered connector names.
 */
export declare function listConnectors(): string[];
/**
 * Remove a connector from the registry.
 * Useful in tests or when hot-swapping connectors.
 *
 * @param name The connector name to remove
 * @returns true if a connector was removed, false if it was not registered
 */
export declare function unregisterConnector(name: string): boolean;
/**
 * Abstract base class that provides boilerplate for connector implementations.
 * Subclasses must implement: connect(), query(), disconnect(), and isConnected().
 * The stream() method is optional.
 */
export declare abstract class BaseConnector implements DataConnector {
    abstract readonly name: string;
    abstract connect(config: Record<string, unknown>): Promise<void>;
    abstract query(params: Record<string, unknown>): Promise<unknown>;
    abstract disconnect(): Promise<void>;
    abstract isConnected(): boolean;
    /**
     * Default stream implementation: fetches all data via query() and yields it
     * as a single chunk. Override for true streaming from large data sources.
     */
    stream(params: Record<string, unknown>): AsyncGenerator<unknown>;
    /**
     * Assert that connect() has been called before attempting a query.
     * Call this at the start of query() and stream() in subclasses.
     */
    protected assertConnected(): void;
}
//# sourceMappingURL=base.d.ts.map