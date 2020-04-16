'use strict';

const PGDialect = require('../../index');
const { expect } = require('@hapi/code');

/**
* Test PostgreSQL database {@link Dialect}
*/
module.exports = class PGTestDialect extends PGDialect {

  /**
   * @inheritdoc
   */
  constructor(priv, connConf, track, errorLogger, logger, debug) {
    super(priv, connConf, track, errorLogger, logger, debug);

    expect(priv, 'priv').to.be.object();

    expect(connConf, 'connConf').to.be.object();

    expect(connConf.username || priv.username, 'priv.username').to.be.string();
    expect(connConf.username || priv.username, 'priv.username.length').to.not.be.empty();

    expect(connConf.id, 'connConf.id').to.be.string();
    expect(connConf.id, 'connConf.id.length').to.not.be.empty();
    expect(connConf.name, 'connConf.name').to.be.string();
    expect(connConf.name, 'connConf.name.length').to.not.be.empty();
    expect(connConf.dir, 'connConf.dir').to.be.string();
    expect(connConf.dir, 'connConf.dir.length').to.not.be.empty();
    expect(connConf.service, 'connConf.service').to.be.string();
    expect(connConf.service, 'connConf.service.length').to.not.be.empty();
    expect(connConf.dialect, 'connConf.dialect === postgres').to.equal('postgres');

    expectDriverOptions(connConf, this);

    expect(track, 'track').to.be.object();
    if (errorLogger) expect(errorLogger, 'errorLogger').to.be.function();
    if (logger) expect(logger, 'logger').to.be.function();
    expect(debug, 'debug').to.be.boolean();
  }

  /**
   * @inheritdoc
   */
  async init(opts) {
    const pool = await super.init(opts);

    return pool;
  }

  /**
   * @inheritdoc
   */
  async exec(sql, opts, frags) {
    expect(sql, 'sql').to.be.string();

    expect(opts, 'opts').to.be.object();

    const state = super.state;
    expect(state, 'dialect.state').to.be.object();
    expect(state.pending, 'dialect.state.pending').to.be.number();
    expect(state.connection, 'dialect.connection').to.be.object();
    expect(state.connection.count, 'dialect.connection.count').to.be.number();
    expect(state.connection.inUse, 'dialect.connection.inUse').to.be.number();

    return super.exec(sql, opts, frags);
  }

  /**
   * @inheritdoc
   */
  async close() {
    return super.close();
  }
};

/**
 * Expects the PostgreSQL driver options (when present)
 * @param {Manager~ConnectionOptions} opts The connection options to check
 * @param {MDBTestDialect} dlt The test dialect
 */
function expectDriverOptions(opts, dlt) {
  expect(dlt.driver, `${dlt.constructor.name} driver`).to.be.object();
  if (!opts.driverOptions) return;
  expect(opts.driverOptions, 'connConf.driverOptions').to.be.object();
  if (!opts.global) return;
  expect(opts.driverOptions.global, 'connConf.driverOptions.global').to.be.object();
  //expect(opts.driverOptions.global.autoCommit, 'connConf.driverOptions.global.autoCommit = dlt.isAutocommit').to.equal(dlt.isAutocommit());
  for (let odb in opts.driverOptions.global) {
    expect(opts.driverOptions.global[odb], `connConf.driverOptions.global.${odb} = dlt.driver.${odb}`).to.be.equal(dlt.driver[odb]);
  }
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