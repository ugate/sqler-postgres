'use strict';

// export just to illustrate module usage
module.exports = async function runExample(manager, connName) {

  // delete the test table
  const rslt = await manager.db[connName].setup.delete.table1();

  return rslt;
};