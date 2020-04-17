'use strict';

const Fs = require('fs');

// export just to illustrate module usage
module.exports = async function runExample(manager, connName) {

  // The odbc module needs the date to be in a valid ANSI compliant format.
  // Could also use:
  // https://www.npmjs.com/package/moment-db
  const date = new Date().toISOString().replace('T', ' ').replace('Z', '');

  // Insert row (implicit transaction)
  const rslt = await manager.db[connName].create.table1.rows({
    binds: {
      id: 1, name: 'TABLE: 1, ROW: 1', created: date, updated: date
    }
  });

  return rslt;
};