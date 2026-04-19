# Load Testing

k6 stress tests for the `join_session` RPC, verifying correctness under concurrent load.

## Setup

```bash
# 1. Seed test users (one-time)
npm run seed:users

# 2. Create sessions and authenticate users → writes tests/load/fixtures.json
npm run load:setup

# 3. Run the load test
npm run load:run
```

`load:setup` authenticates up to 20 `test__*` users and creates fresh sessions with random caps. It writes `tests/load/fixtures.json` (gitignored — contains live JWTs).

## Configuration

| Parameter | Value |
|---|---|
| Tool | k6 |
| Endpoint | `POST /rest/v1/rpc/join_session` |
| Scenario | `ramping-vus`: 0 → 200 VUs over 30s, hold 2m, ramp down 15s |
| Thresholds | p95 < 3000ms · success rate > 90% · HTTP errors < 5% |
| Teardown | Queries each session's `joined` count and asserts `count ≤ max_participants` |

## Results

### Run 1 — 50 VUs × 1 session (cap 20)

| Metric | Value |
|---|---|
| Total requests | 12,296 |
| Duration | 2m 45s |
| Throughput | ~74 RPS |
| Median latency | 54 ms |
| p95 latency | 200 ms |
| Max latency | 677 ms |
| HTTP error rate | 0% |
| Success rate | 100% |
| Lock correctness | ✓ exactly 20 joined, 0 overcounted |

### Run 2 — 200 VUs × 10 sessions (caps 20–80)

| Metric | Value |
|---|---|
| Total requests | 44,692 |
| Duration | 2m 45s |
| Throughput | ~269 RPS |
| Median latency | 66 ms |
| p95 latency | 512 ms |
| Max latency | 9.77 s |
| HTTP error rate | 0% |
| Success rate | 100% |
| Lock correctness | ✓ all 10 sessions within cap, 0 overcounted |

Session caps in Run 2: 39, 21, 55, 77, 68, 80, 50, 28, 57, 59 — each had exactly `cap` joined participants at teardown.

## Key Findings

**Lock correctness holds under full concurrency.** `pg_advisory_xact_lock(abs(hashtext(session_id)))` in the `join_session` RPC serialises concurrent writes per session. At 269 RPS across 10 simultaneous sessions with 200 VUs, zero sessions exceeded their `max_participants` cap.

**Latency scales linearly.** Median latency increased from 54ms (50 VUs) to 66ms (200 VUs). The p95 grew from 200ms to 512ms — the lock contention is visible in the tail but stays well within the 3000ms threshold.

**Duplicate joins are handled gracefully.** VUs cycling through fewer tokens than VUs hit `already have an active entry` errors which are counted as `duplicate_rejections` (not RPC errors) and excluded from the error rate.
