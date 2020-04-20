'use strict';

const Fs = require('fs');

// export just to illustrate module usage
module.exports = async function runExample(manager, connName) {

  const date = new Date();

  // Insert row (implicit transaction)
  const rslt = await manager.db[connName].create.table1.rows({
    binds: {
      id: 1, name: 'TABLE: 1, ROW: 1', created: date, updated: date
    }
  });

  return rslt;
};