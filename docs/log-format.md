# Log format

Each nonempty line is a JSON object:

```json
{"path":"/api/search","status":200,"durationMs":48}
```

`path` is a string, `status` is an integer HTTP code from 100 to 599, and
`durationMs` is a finite nonnegative number. Blank lines are ignored.
Every request contributes to the nearest-rank p95 calculation.

The fixtures contain synthetic request records for a reproducible demonstration.
