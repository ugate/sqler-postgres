'use strict';

// export just to illustrate module usage
module.exports = async function runExample(manager, connName) {

  const date = new Date();

  // binds
  const binds = {
    id: 1, name: 'TABLE: 1, ROW: 1 (UPDATE)', updated: date
  };
  let exec;

  //-------------------------------------------------------
  // There are two different ways to perform a transaction
  // 1. Explicit (suitable for multiple executions in 1 tx)
  // 2. Implicit (suitable for a single execution in 1 tx)

  // Using an explicit transaction:
  try {
    // start a transaction
    const txId = await manager.db[connName].beginTransaction();
    exec = await manager.db[connName].update.table1.rows({
      autoCommit: false,
      transactionId: txId, // ensure execution takes place within transaction
      binds
    });
    await exec.commit();
  } catch (err) {
    if (exec) {
      await exec.rollback();
    }
    throw err;
  }

  // Using an implicit transcation (autoCommit defaults to true):
  exec = await manager.db[connName].update.table1.rows({
    binds
  });

  return exec;
};