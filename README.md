# sql-builder (WIP)

A WIP nodejs SQL generator, intended for underlying sql generator for ORM's such as sequelize.

Example syntax: (generated SQL would be for postgres)
```js
factory.select(['abc', 'def'], {
    from: 'my_table',
    limit: 5,
    distinct: true,
    orderBy: 'abc'
})// -> SELECT DISTINCT "my_table"."abc", "my_table"."def" FROM "my_table" ORDER BY "my_table"."abc" LIMIT 5; 
```

## Priorities (High->Low):
1. Easy to use
2. Easy to work on - e.g. adding a new dialect / supporting more syntax should be pretty simple.
3. Loosely follows standard SQL terminology and such. E.g. `.select` over `.find`.

This is still in the very early stages, so its unlikely I'll be accepting any PRs. Feel free to leave an issue though if you notice something. 
