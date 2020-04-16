### ⚙️ Setup &amp; Configuration <sub id="conf"></sub>:

> __Most of documentation pertaining to general configuration for `sqler-postgres` can be found in the [`sqler` manual](https://ugate.github.io/sqler).__

The following modules versions are required when using `sqler-postgres` for [PostgreSQL](https://www.postgresql.org):
```jsdocp ./package.json @~ devDependencies.sqler @~ devDependencies.pg
```

Install the required modules:
```sh
npm install sqler
npm install sqler-postgres
npm install pg
```

Connection and execution option extensions can be found under the API docs for [globals](global.html).

### 💡 [PostgreSQL](tutorial-2-usage.html)