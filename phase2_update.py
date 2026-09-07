#!/usr/bin/env python3
"""Phase 2 — rewrite OKX service definitions to the OKX-edge POST endpoints.

Per the Sep 3 audit (RC3): fee '0.05' (winner band), POST endpoint on the
OKX-edge, 4-line numbered A2MCP description. Updates existing services via
operation:update (never create — avoids 'Duplicate service names').

Each agent carries TWO distinct services on DISTINCT OKX-edge endpoints
(OKX rejects duplicate endpoints within an ASP):
  - Market Intelligence -> POST /v1/market/price  (price data)
  - Token Security      -> POST /v1/security/score (risk scoring)
"""
import json
import subprocess
import sys

def svc(service_id, name, endpoint, desc_lines):
    return {
        "operation": "update",
        "id": service_id,
        "serviceName": name,
        "serviceDescription": "\n".join(desc_lines),
        "serviceType": "A2MCP",
        "fee": "0.05",
        "endpoint": endpoint,
    }

# agent_id -> list of (service_id, name, endpoint, description_lines)
AGENTS = {
    "2847": [
        ("30554", "Market Intelligence",
         "https://api.gentechlabs.net/v1/market/price",
         ["Real-time crypto market price data via x402 pay-per-call",
          "symbol(string, required): crypto symbol, e.g. BTC",
          "POST",
          "curl -X POST https://api.gentechlabs.net/v1/market/price -H \"Content-Type: application/json\" -d '{\"symbol\":\"BTC\"}'"]),
        ("30555", "Token Security",
         "https://api.gentechlabs.net/v1/security/score",
         ["Token risk scoring and rugcheck analysis via x402 pay-per-call",
          "address(string, required): token or contract address, e.g. 0x7ebff188f2Eba16518C02864589b1403a5d1296a",
          "POST",
          "curl -X POST https://api.gentechlabs.net/v1/security/score -H \"Content-Type: application/json\" -d '{\"address\":\"0x7ebff188f2Eba16518C02864589b1403a5d1296a\"}'"]),
    ],
    "2848": [
        ("30552", "Market Intelligence",
         "https://api.gentechlabs.net/v1/market/price",
         ["Real-time crypto market price data via x402 pay-per-call",
          "symbol(string, required): crypto symbol, e.g. BTC",
          "POST",
          "curl -X POST https://api.gentechlabs.net/v1/market/price -H \"Content-Type: application/json\" -d '{\"symbol\":\"BTC\"}'"]),
        ("30553", "Token Security",
         "https://api.gentechlabs.net/v1/security/score",
         ["Token risk scoring and rugcheck analysis via x402 pay-per-call",
          "address(string, required): token or contract address, e.g. 0x7ebff188f2Eba16518C02864589b1403a5d1296a",
          "POST",
          "curl -X POST https://api.gentechlabs.net/v1/security/score -H \"Content-Type: application/json\" -d '{\"address\":\"0x7ebff188f2Eba16518C02864589b1403a5d1296a\"}'"]),
    ],
    "2849": [
        ("30550", "Market Intelligence",
         "https://api.gentechlabs.net/v1/market/price",
         ["Real-time crypto market price data via x402 pay-per-call",
          "symbol(string, required): crypto symbol, e.g. BTC",
          "POST",
          "curl -X POST https://api.gentechlabs.net/v1/market/price -H \"Content-Type: application/json\" -d '{\"symbol\":\"BTC\"}'"]),
        ("30551", "Token Security",
         "https://api.gentechlabs.net/v1/security/score",
         ["Token risk scoring and rugcheck analysis via x402 pay-per-call",
          "address(string, required): token or contract address, e.g. 0x7ebff188f2Eba16518C02864589b1403a5d1296a",
          "POST",
          "curl -X POST https://api.gentechlabs.net/v1/security/score -H \"Content-Type: application/json\" -d '{\"address\":\"0x7ebff188f2Eba16518C02864589b1403a5d1296a\"}'"]),
    ],
}

def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "2847"
    if target not in AGENTS:
        print(f"Unknown agent {target}. Valid: {list(AGENTS)}")
        return 1
    services = [svc(sid, name, ep, desc) for (sid, name, ep, desc) in AGENTS[target]]
    payload = json.dumps(services)
    cmd = ["onchainos", "agent", "update", "--agent-id", target, "--service", payload]
    print(f"=== Updating agent {target} ===")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    print(r.stdout)
    if r.stderr:
        print("STDERR:", r.stderr[-2000:])
    return 0 if r.returncode == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
