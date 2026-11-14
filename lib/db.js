// ============================================================
// 저장소: Upstash Redis (Vercel Storage → Upstash for Redis 로 만들면 환경 변수가 자동으로 들어옴)
// - KV_REST_API_URL / KV_REST_API_TOKEN (또는 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, 또는 REDIS_URL)
// - 패키지 없이 REST API를 직접 부릅니다.
// 저장 구조: cb:rec:{종류}:{id} = 기록(JSON), cb:idx:{종류} = 최근 순서(정렬 집합, 점수 = 시각)
// ============================================================
"use strict";

// 연결 방식에 따라 REDIS_URL(rediss://default:비밀번호@주소.upstash.io:6379) 하나만 들어오는 경우도 있어 그 값에서도 읽음
function fromRedisUrl() {
  const m = String(process.env.KV_URL || process.env.REDIS_URL || "").match(/^rediss?:\/\/[^:@]*:([^@]+)@([^:/]+)/);
  return m && /\.upstash\.io$/.test(m[2]) ? { url: "https://" + m[2], token: decodeURIComponent(m[1]) } : null;
}
const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || (fromRedisUrl() || {}).url || "";
const TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || (fromRedisUrl() || {}).token || "";
const configured = () => !!(URL_() && TOKEN());

const KINDS = ["order", "request", "inquiry", "chat", "member", "unanswered", "answer"];
const recKey = (kind, id) => `cb:rec:${kind}:${id}`;
const idxKey = (kind) => `cb:idx:${kind}`;

async function pipeline(cmds) {
  if (!configured()) throw new Error("db_not_configured");
  const r = await fetch(URL_().replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN(), "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error("db_http_" + r.status);
  const out = await r.json();
  return out.map((x) => { if (x.error) throw new Error("db_" + x.error); return x.result; });
}
const cmd = async (...args) => (await pipeline([args]))[0];

const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

async function get(kind, id) { return parse(await cmd("GET", recKey(kind, id))); }

// 새로 만들기: 이미 있으면 덮어쓰지 않고 false (재전송된 같은 기록은 한 번만 저장)
async function create(kind, rec, score = Date.now()) {
  const [ok] = await pipeline([["SET", recKey(kind, rec.id), JSON.stringify(rec), "NX"], ["ZADD", idxKey(kind), score, rec.id]]);
  return ok === "OK";
}

async function save(kind, rec, score) {
  const cmds = [["SET", recKey(kind, rec.id), JSON.stringify(rec)]];
  if (score) cmds.push(["ZADD", idxKey(kind), score, rec.id]);
  await pipeline(cmds);
}

async function remove(kind, id) { await pipeline([["DEL", recKey(kind, id)], ["ZREM", idxKey(kind), id]]); }

// 최근 순서대로 최대 limit개
async function list(kind, limit = 500) {
  const ids = await cmd("ZREVRANGE", idxKey(kind), 0, limit - 1);
  if (!ids || !ids.length) return [];
  const vals = await cmd("MGET", ...ids.map((id) => recKey(kind, id)));
  return vals.map(parse).filter(Boolean);
}

// 요청 횟수 제한: windowSec 동안 max회 넘으면 true
async function limited(name, max, windowSec) {
  const key = "cb:rl:" + name;
  const [n] = await pipeline([["INCR", key], ["EXPIRE", key, windowSec, "NX"]]);
  return n > max;
}

module.exports = { configured, KINDS, get, create, save, remove, list, limited, cmd };
