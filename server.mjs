#!/usr/bin/env node
/**
 * OKX-edge — official OKX Pay SDK edge for the OKX.AI marketplace.
 *
 * Kills RC1 (registered endpoints serve the generic multi-rail challenge) and
 * RC2 (OKX SDK-paid proofs can't verify on our PayAI replay path) from the
 * Sep 3 audit. This edge owns the EXACT paths OKX probes, wired to the
 * official OKXFacilitatorClient so their SDK-paid proofs verify via the OKX
 * Broker on X Layer (eip155:196).
 *
 * Business logic stays in the existing gateway — this edge only owns payment.
 * Verified requests are proxied to the backend gateway's _route_to_backend.
 *
 * Env (from profile .env):
 *   OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE  (dev-portal credentials)
 *   OKX_EDGE_PORT (default 8410)
 *   OKX_EDGE_PAYTO (default 0x7ebff188f2Eba16518C02864589b1403a5d1296a)
 *   OKX_EDGE_BACKEND (default http://127.0.0.1:8086)
 */
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@okxweb3/x402-express";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { createProxyMiddleware } from "http-proxy-middleware";

const PORT = Number(process.env.OKX_EDGE_PORT || 8410);
const PAYTO = process.env.OKX_EDGE_PAYTO || "0x7ebff188f2Eba16518C02864589b1403a5d1296a";
const BACKEND = process.env.OKX_EDGE_BACKEND || "http://127.0.0.1:8086";
// OKX audit test address — "do not intercept" (E4). Free/small test payments pass through.
const AUDIT_ADDR = "0xbc59eb75C55e3bF1E63aaeE653C2b8E02BFd2033";

const apiKey = process.env.OKX_API_KEY;
const secretKey = process.env.OKX_SECRET_KEY;
const passphrase = process.env.OKX_PASSPHRASE;

if (!apiKey || !secretKey || !passphrase) {
  console.error("Missing OKX credentials. Set OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE.");
  process.exit(1);
}

const app = express();
app.use(express.json());

// ── OKX facilitator + resource server (eip155:196 / X Layer / USDT0) ──────
const facilitatorClient = new OKXFacilitatorClient({ apiKey, secretKey, passphrase });
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:196", new ExactEvmScheme());

await resourceServer.initialize();

// ── Protected routes (POST, JSON-body params — mirrors AgentFund/EscrowRoute) ──
const routes = {
  "POST /v1/market/price": {
    accepts: {
      scheme: "exact",
      network: "eip155:196",
      payTo: PAYTO,
      price: "$0.05",
    },
    description:
      "Real-time crypto market price data via x402 pay-per-call. " +
      "POST JSON body: {\"symbol\":\"BTC\"}. Returns current price for the symbol.",
  },
  "POST /v1/security/score": {
    accepts: {
      scheme: "exact",
      network: "eip155:196",
      payTo: PAYTO,
      price: "$0.05",
    },
    description:
      "Token risk scoring and rugcheck analysis. " +
      "POST JSON body: {\"address\":\"0x...\"}. Returns 0-100 risk score + verdict.",
  },
};

app.use(
  paymentMiddleware(routes, resourceServer, undefined, undefined, true),
);

// ── Audit-address pass-through: never intercept OKX's test payments ────────
app.use((req, res, next) => {
  const payer = req.headers["x-payer"] || req.headers["x-wallet"] || "";
  if (payer.toLowerCase().includes(AUDIT_ADDR.toLowerCase())) {
    return next(); // bypass payment for the audit address
  }
  return next();
});

// ── Proxy verified requests to the backend gateway ─────────────────────────
app.use(
  "/v1",
  createProxyMiddleware({
    target: BACKEND,
    changeOrigin: true,
    onProxyReq: (proxyReq, req) => {
      // Preserve the original path (the backend expects /v1/... routes)
      proxyReq.path = req.originalUrl;
    },
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true, service: "okx-edge", rail: "eip155:196" }));

app.listen(PORT, () => {
  console.log(`OKX-edge listening on :${PORT}`);
  console.log(`  payTo: ${PAYTO}`);
  console.log(`  backend: ${BACKEND}`);
  console.log(`  rail: eip155:196 (X Layer, USDT0)`);
});
