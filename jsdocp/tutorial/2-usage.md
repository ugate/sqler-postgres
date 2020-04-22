### 💡 [PostgreSQL](https://www.postgresql.org) Examples:

#### Examples:<sub id="examples"></sub>

The examples below use the following setup:

__[Private Options Configuration:](https://ugate.github.io/sqler/Manager.html#~PrivateOptions)__ (appended to the subsequent connection options)
```jsdocp ./test/fixtures/priv.json
```

__[Connection Options Configuration:](global.html#PGConnectionOptions)__
```jsdocp ./test/fixtures/postgres/conf.json
```

Test code that illustrates how to use PostgreSQL with various examples
```jsdocp ./test/fixtures/run-example.js
```

__Create Schema:__

```jsdocp ./test/db/postgres/setup/create.database.sql
-- db/postgres/setup/create.database.sql
```

```jsdocp ./test/lib/postgres/setup/create.database.js
```

__Create Table(s):__

```jsdocp ./test/db/postgres/setup/create.table1.sql
-- db/postgres/setup/create.table1.sql
```
```jsdocp ./test/db/postgres/setup/create.table2.sql
-- db/postgres/setup/create.table2.sql
```

```jsdocp ./test/lib/postgres/setup/create.tables.js
```

__Create Rows:__

```jsdocp ./test/db/postgres/create.table1.rows.sql
-- db/postgres/create.table1.rows.sql
```
```jsdocp ./test/db/postgres/create.table2.rows.sql
-- db/postgres/create.table2.rows.sql
```

```jsdocp ./test/lib/postgres/create.table.rows.js
```

__Read Rows:__

```jsdocp ./test/db/postgres/read.table.rows.sql
-- db/postgres/read.table.rows.sql
```

```jsdocp ./test/lib/postgres/read.table.rows.js
```

__Update Rows:__

```jsdocp ./test/db/postgres/update.table1.rows.sql
-- db/postgres/update.table1.rows.sql
```
```jsdocp ./test/db/postgres/update.table2.rows.sql
-- db/postgres/update.table2.rows.sql
```

```jsdocp ./test/lib/postgres/update.table.rows.js
```

__Delete Rows:__

```jsdocp ./test/db/postgres/delete.table1.rows.sql
-- db/postgres/delete.table1.rows.sql
```
```jsdocp ./test/db/postgres/delete.table2.rows.sql
-- db/postgres/delete.table2.rows.sql
```

```jsdocp ./test/lib/postgres/delete.table.rows.js
```

__Delete Tables:__

```jsdocp ./test/db/postgres/setup/delete.table1.sql
-- db/postgres/setup/delete.table1.sql
```
```jsdocp ./test/db/postgres/setup/delete.table2.sql
-- db/postgres/setup/delete.table2.sql
```

```jsdocp ./test/lib/postgres/setup/delete.tables.js
```

__Delete Schema:__

```jsdocp ./test/db/postgres/setup/delete.database.sql
-- db/postgres/setup/delete.database.sql
```

```jsdocp ./test/lib/postgres/setup/delete.database.js
```