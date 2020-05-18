## [1.1.1](https://ugate.github.io/sqler-postgres/tree/v1.1.1) (2020-05-18)
[Full Changelog](https://ugate.github.io/sqler-postgres/compare/v1.1.0...v1.1.1)


__Fixes:__
* [[FIX]: Long path names may exceed the max number of characters for prepared statements (63 characters). In this case, characters from the beggining of the path name will be remved to accommodate.](https://ugate.github.io/sqler-postgres/commit/20445e9716e68f93f00c35d2a46167ff1d532cf3)
* [[FIX]: Number of prepared statements was reported with undefined within init](https://ugate.github.io/sqler-postgres/commit/dd2a48a2648e4bfeb24f99d8f819c791c28b31af)