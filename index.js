'use strict';

/**
 * PostgreSQL specific extension of the {@link Manager~ConnectionOptions} from the [`sqler`](https://ugate.github.io/sqler/) module.
 * @typedef {Manager~ConnectionOptions} PGConnectionOptions
 * @property {Object} driverOptions The `pg` module specific options. __Both `client` and `pool` will be merged when generating the connection pool.__
 * @property {Object} [driverOptions.client] An object that will contain properties/values that will be used to construct the PostgreSQL Client
 * (e.g. `{ database: 'mydb', statement_timeout: 10000 }`). See the `pg` module documentation for a full listing of available Client options.
 * When a property value is a string surrounded by `${}`, it will be assumed to be a property that resides on either the {@link Manager~PrivateOptions}
 * passed into the {@link Manager} constructor or a property on the {@link PGConnectionOptions} itself (in that order of precedence). For example, 
 * `clientOpts.host = '127.0.0.1'` and `driverOptions.client.host = '${host}'` would be interpolated into `driverOptions.client.host = '127.0.0.1'`.
 * In contrast to `privOpts.username = 'someUsername' and `driverOptions.client.user = '${username}'` would be interpolated into
 * `driverOptions.client.user = 'someUsername'`.
 * @property {Object} [driverOptions.pool] The pool `conf` options that will be passed into `pg.createPool(conf)`. See the `pg` module for a full
 * listing of avialable connection pooling options.
 * __Using any of the generic `pool.someOption` will override the `conf` options set on `driverOptions.pool`__ (e.g. `pool.max = 10` would override 
 * `driverOptions.pool.max = 20`).
 * When a value is a string surrounded by `${}`, it will be assumed to be a _constant_ property that resides on the `pg` module and will be interpolated
 * accordingly.
 * For example `driverOptions.pool.someProp = '${SOME_PG_CONSTANT}'` will be interpolated as `pool.someProp = pg.SOME_PG_CONSTANT`.
 */

/**
 * PostgreSQL specific extension of the {@link Manager~ExecOptions} from the [`sqler`](https://ugate.github.io/sqler/) module. When a property of `binds`
 * contains an object it will be _interpolated_ for property values on the `pg` module.
 * For example, `binds.name = '${SOME_PG_CONSTANT}'` will be interpolated as `binds.name = pg.SOME_PG_CONSTANT`.
 * @typedef {Manager~ExecOptions} PGExecOptions
 * @property {Object} [driverOptions] The `pg` module specific options.
 * @property {Object} [driverOptions.client] The client configuration that overrides the `client` {@link PGConnectionOptions}.
 * @property {Object} [driverOptions.query] The options passed into `pg.Client.query` during {@link Manager.exec}. See the `pg` module documentation
 * for a full listing of available query options.
 * When a value is a string surrounded by `${}`, it will be assumed to be a _constant_ property that resides on the `pg` module and will be interpolated
 * accordingly.
 * For example `driverOptions.query.someDriverProp = '${SOME_PG_CONSTANT}'` will be interpolated as
 * `driverOptions.query.someDriverProp = pg.SOME_PG_CONSTANT`.
 * @property {(String | Boolean)} [driverOptions.query.name] As stated in the `pg` documentation, the `name` option will cause a perpared statemenet to be
 * used. `sqler-postgres` allows a `true` value to be set to utilize the internally generated SQL file name to be used instead of explicitly defining a
 * name (which is of course, also supported).
 */

/**
 * PostgreSQL {@link Dialect} implementation for [`sqler`](https://ugate.github.io/sqler/)
 */
module.exports = class PGDialect {

  /**
   * Constructor
   * @constructs PGDialect
   * @param {Manager~PrivateOptions} priv The private configuration options
   * @param {PGConnectionOptions} connConf The individual SQL __connection__ configuration for the given dialect that was passed into the originating {@link Manager}
   * @param {Manager~Track} track Container for sharing data between {@link Dialect} instances.
   * @param {Function} [errorLogger] A function that takes one or more arguments and logs the results as an error (similar to `console.error`)
   * @param {Function} [logger] A function that takes one or more arguments and logs the results (similar to `console.log`)
   * @param {Boolean} [debug] A flag that indicates the dialect should be run in debug mode (if supported)
   */
  constructor(priv, connConf, track, errorLogger, logger, debug) {
    if (!connConf.driverOptions) throw new Error('Connection configuration is missing required driverOptions');
    const dlt = internal(this);
    dlt.at.track = track;
    dlt.at.driver = require('pg');
    dlt.at.connections = {};
    dlt.at.opts = {
      autoCommit: true, // default autoCommit = true to conform to sqler
      id: `sqlerPGGen${Math.floor(Math.random() * 10000)}`,
      client: connConf.driverOptions.client ? dlt.at.track.interpolate({}, connConf.driverOptions.client, dlt.at.driver) : {}
    };
    // merge client options into pool options
    dlt.at.opts.pool = connConf.driverOptions.pool ? 
      dlt.at.track.interpolate(dlt.at.opts.client, connConf.driverOptions.pool, dlt.at.driver) : 
      dlt.at.opts.client;
    // sqler compatible state
    dlt.at.state = {
      pending: 0
    };

    dlt.at.errorLogger = errorLogger;
    dlt.at.logger = logger;
    dlt.at.debug = debug;

    if (priv.host) dlt.at.opts.pool.host = priv.host;
    if (priv.hasOwnProperty('port')) dlt.at.opts.pool.port = priv.port;
    dlt.at.opts.pool.user = priv.username;
    dlt.at.opts.pool.password = priv.password;

    if (connConf.pool) {
      // if (connConf.pool.hasOwnProperty('min')) dlt.at.opts.pool.minimumIdle = connConf.pool.min; // not supported
      if (connConf.pool.hasOwnProperty('max')) dlt.at.opts.pool.max = connConf.pool.max;
      if (connConf.pool.hasOwnProperty('idle')) dlt.at.opts.pool.idleTimeoutMillis = connConf.pool.idle;
      // if (connConf.pool.hasOwnProperty('increment')) dlt.at.opts.pool.incrementSize = connConf.pool.increment; // not supported
      if (connConf.pool.hasOwnProperty('timeout')) dlt.at.opts.pool.connectionTimeoutMillis = connConf.pool.timeout;
    }
  }

  /**
   * Initializes {@link PGDialect} by creating the connection pool
   * @param {Dialect~DialectInitOptions} opts The options described by the `sqler` module
   * @returns {Object} The PostgreSQL connection pool
   */
  async init(opts) {
    const dlt = internal(this), numSql = opts.numOfPreparedStmts;
    let conn, error;
    try {
      dlt.at.pool = new dlt.at.driver.Pool(dlt.at.opts.pool);
      if (dlt.at.logger) {
        dlt.at.logger(`sqler-postgres: Connection pool "${dlt.at.opts.id}" created with (${numSql} SQL files) ` +
          `max=${dlt.at.opts.pool.max} idleTimeoutMillis=${dlt.at.opts.pool.idleTimeoutMillis} ` +
          `connectionTimeoutMillis=${dlt.at.opts.pool.connectionTimeoutMillis}`);
      }
      conn = await dlt.at.pool.connect();
      return dlt.at.pool;
    } catch (err) {
      error = err;
      const msg = `sqler-postgres: connection pool "${dlt.at.opts.id}" could not be created`;
      if (dlt.at.errorLogger) dlt.at.errorLogger(`${msg} (passwords are omitted from error) ${JSON.stringify(err, null, ' ')}`);
      const pconf = Object.assign({}, dlt.at.opts.pool);
      delete pconf.password;
      err.message = `${err.message}\n${msg} for ${JSON.stringify(pconf, null, ' ')}`;
      err.sqlerPG = pconf;
      throw err;
    } finally {
      if (conn) {
        await operation(dlt, 'release', false, conn, opts, error)();
      }
    }
  }

  /**
   * Begins a transaction by opening a connection from the pool
   * @param {String} txId The transaction ID that will be started
   */
  async beginTransaction(txId) {
    const dlt = internal(this);
    if (dlt.at.connections[txId]) return;
    if (dlt.at.logger) {
      dlt.at.logger(`sqler-postgres: Beginning transaction "${txId}" on connection pool "${dlt.at.opts.id}"`);
    }
    dlt.at.connections[txId] = await dlt.this.getConnection({ transactionId: txId });
    return dlt.at.connections[txId].query('BEGIN');
  }

  /**
   * Executes a SQL statement
   * @param {String} sql the SQL to execute
   * @param {PGExecOptions} opts The execution options
   * @param {String[]} frags The frament keys within the SQL that will be retained
   * @param {Manager~ExecMeta} meta The SQL execution metadata
   * @param {(Manager~ExecErrorOptions | Boolean)} [errorOpts] The error options to use
   * @returns {Dialect~ExecResults} The execution results
   */
  async exec(sql, opts, frags, meta, errorOpts) {
    const dlt = internal(this);
    let conn, bndp = {}, rslts;
    try {
      // interpolate and remove unused binds since
      // PostgreSQL only accepts the exact number of bind parameters (also, cuts down on payload bloat)
      bndp = dlt.at.track.interpolate(bndp, opts.binds, dlt.at.driver, props => sql.includes(`:${props[0]}`));

      // driver options query override
      const dopts = opts.driverOptions || {};
      if (!dopts.query) dopts.query = {};
      dopts.query.values = [];
      dopts.query.text = dlt.at.track.positionalBinds(sql, bndp, dopts.query.values);

      const rtn = {};

      if (!opts.transactionId && opts.type === 'READ') {
        rslts = await dlt.at.pool.query(dopts.query);
        rtn.rows = rslts.rows;
        rtn.raw = rslts;
      } else {
        // name will cause pg to use a prepared statement
        if (dopts.query.name === true) dopts.query.name = meta.name;
        conn = await dlt.this.getConnection(opts);
        rslts = await conn.query(dopts.query);
        rtn.rows = rslts.rows;
        rtn.raw = rslts;
        if (opts.autoCommit) {
          // PostgreSQL has no option to autocommit during SQL execution
          await operation(dlt, 'commit', false, conn, opts)();
        } else {
          dlt.at.state.pending++;
          rtn.commit = operation(dlt, 'commit', true, conn, opts);
          rtn.rollback = operation(dlt, 'rollback', true, conn, opts);
        }
      }

      return rtn;
    } catch (err) {
      if (conn) {
        try {
          await operation(dlt, 'end', false, conn, opts)();
        } catch (cerr) {
          err.closeError = cerr;
        }
      }
      const msg = ` (BINDS: [${Object.keys(bndp)}], FRAGS: ${Array.isArray(frags) ? frags.join(', ') : frags})`;
      if (dlt.at.errorLogger) {
        dlt.at.errorLogger(`Failed to execute the following SQL: ${sql}`, err);
      }
      err.message += msg;
      throw err;
    }
  }

  /**
   * Gets the currently open connection or a new connection when no transaction is in progress
   * @protected
   * @param {PGExecOptions} opts The execution options
   * @returns {Object} The connection (when present)
   */
  async getConnection(opts) {
    const dlt = internal(this);
    const txId = opts.transactionId;
    let conn = txId ? dlt.at.connections[txId] : null;
    if (!conn) {
      return dlt.at.pool.connect();
    }
    return conn;
  }

  /**
   * Closes the PostgreSQL connection pool
   * @returns {Integer} The number of connections closed
   */
  async close() {
    const dlt = internal(this);
    try {
      if (dlt.at.logger) {
        dlt.at.logger(`sqler-postgres: Closing connection pool "${dlt.at.opts.id}" (uncommitted transactions: ${dlt.at.state.pending})`);
      }
      if (dlt.at.pool) {
        await dlt.at.pool.end();
      }
      return dlt.at.state.pending;
    } catch (err) {
      if (dlt.at.errorLogger) {
        dlt.at.errorLogger(`sqler-postgres: Failed to close connection pool "${dlt.at.opts.id}" (uncommitted transactions: ${dlt.at.state.pending})`, err);
      }
      throw err;
    }
  }

  /**
   * @returns {Manager~State} The state
   */
  get state() {
    const dlt = internal(this);
    return {
      connection: {
        count: (dlt.at.pool && dlt.at.pool.totalCount) || 0,
        inUse: (dlt.at.pool && dlt.at.pool.waitingCount) || 0
      },
      pending: dlt.at.state.pending || (dlt.at.pool && dlt.at.pool.waitingCount) || 0
    };
  }

  /**
   * @protected
   * @returns {Object} The PostgreSQL driver module
   */
  get driver() {
    return internal(this).at.driver;
  }
};

/**
 * Executes a function by name that resides on the PostgreSQL connection
 * @private
 * @param {Object} dlt The internal PostgreSQL object instance
 * @param {String} name The name of the function that will be called on the connection
 * @param {Boolean} reset Truthy to reset the pending connection and transaction count when the operation completes successfully
 * @param {Object} conn The connection
 * @param {Manager~ExecOptions} [opts] The {@link Manager~ExecOptions}
 * @param {Error} [error] An originating error where any oprational errors will be set as a property of the passed error
 * (e.g. `name = 'close'` would result in `error.closeError = someInternalError`). __Internal Errors will not be thrown.__
 * @returns {Function} A no-arguement `async` function that returns the number or pending transactions
 */
function operation(dlt, name, reset, conn, opts, error) {
  return async () => {
    let ierr;
    try {
      if (dlt.at.logger) {
        dlt.at.logger(`sqler-postgres: Performing ${name} on connection pool "${dlt.at.opts.id}" (uncommitted transactions: ${dlt.at.state.pending})`);
      }
      if (name === 'commit' || name === 'rollback') {
        await conn.query(name.toUpperCase());
      } else {
        await conn[name]();
      }
      if (reset) { // not to be confused with pg connection.reset();
        if (opts && opts.transactionId) delete dlt.at.connections[opts.transactionId];
        dlt.at.state.pending = 0;
      }
    } catch (err) {
      ierr = err;
      if (dlt.at.errorLogger) {
        dlt.at.errorLogger(`sqler-postgres: Failed to ${name} ${dlt.at.state.pending} transaction(s) with options: ${
          opts ? JSON.stringify(opts) : 'N/A'}`, ierr);
      }
      if (error) {
        error[`${name}Error`] = err;
      } else {
        throw err;
      }
    } finally {
      if (name !== 'end' && name !== 'release') {
        try {
          await conn.release();
        } catch (endErr) {
          if (ierr) {
            ierr.releaseError = endErr;
          }
        }
      }
    }
    return dlt.at.state.pending;
  };
}

// private mapping
let map = new WeakMap();
let internal = function(object) {
  if (!map.has(object)) {
    map.set(object, {});
  }
  return {
    at: map.get(object),
    this: object
  };
};