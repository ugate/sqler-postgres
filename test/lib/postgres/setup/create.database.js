'use strict';

// export just to illustrate module usage
module.exports = async function runExample(manager, connName) {

  // create test database and/or schema
  return manager.db[connName].setup.create.database();
};