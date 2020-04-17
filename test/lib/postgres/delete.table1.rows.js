'use strict';

// export just to illustrate module usage
module.exports = async function runExample(manager, connName) {

  // Delete row (implicit transaction)
  const rslt = await manager.db[connName].delete.table1.rows({
    binds: { id: 1 }
  });

  return rslt;
};