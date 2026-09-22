# Usage

Pass one JSONL file containing HTTP request records:

```sh verify
node bin/request-report.mjs fixtures/requests.jsonl
```

The output is a text report with total requests, server errors, p95 latency
in milliseconds, and the number of requests for each route. Only HTTP status
codes of 500 and above count as server errors.

```text
Requests: 8
Server errors: 2
p95 latency: 240 ms
/: 3
/api/search: 3
/api/export: 2
```

## Arguments

| Argument | Purpose |
| --- | --- |
| `<requests.jsonl>` | Path to a UTF-8 JSONL request log. |
| `--format <text\|json\|html>` | Output format. Defaults to `text`. |
| `--help` | Print usage and exit. |

An empty log, invalid JSON, invalid request fields, or invalid arguments produces
an error on stderr and a nonzero exit status. See [log format](log-format.md).

## Choose an output format

| Format | Use it for |
| --- | --- |
| `text` | A readable summary in the terminal. This is the default. |
| `json` | Machine-readable output to pipe into another script. |
| `html` | A self-contained page to open in a browser and share. |

The `json` output holds the same figures as the text report, keyed as
`requests`, `errors`, `p95Ms`, and `routes`:

```sh verify
node bin/request-report.mjs fixtures/requests.jsonl --format json
```

## Build an HTML report

The `html` format prints a complete HTML document to stdout. Redirect it to a
file to keep it:

```sh
node bin/request-report.mjs fixtures/requests.jsonl --format html > report.html
```

Open `report.html` in a browser. The page has no external scripts or styles, so
it works offline and you can send the single file to someone else.

The report opens with the same figures as the text output: total requests,
server errors and their share of traffic, p95 latency, and the count of distinct
paths. Two charts show requests by path and each request's duration in log order.
Below them, a table lists every request, where you can:

- Filter to all requests or only server errors.
- Search by path.
- Sort by log order or slowest first.

The summary and charts always cover the whole log; the filters and search apply
to the table.

## Troubleshooting

### The input file does not exist

If the path you pass is not a readable file, the command prints nothing to
stdout, writes an error to stderr, and exits with status 1:

```sh
node bin/request-report.mjs missing.jsonl
```

```text
ENOENT: no such file or directory, open 'missing.jsonl'
```

Check the path and your working directory. Paths are resolved relative to the
directory you run the command from, so run it from the repository root or pass
an absolute path.
