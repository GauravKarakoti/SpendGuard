# 🛡️ SpendGuard
> A programmable financial firewall and spending-control layer for autonomous AI agents in the 0G ecosystem.

SpendGuard is an open-source security primitive designed to bridge the gap between autonomous AI operations and financial security. It provides a robust policy layer over 0G's existing 402/payment infrastructure, ensuring that autonomous agents can freely interact with AI providers, without ever having unrestricted access to a user's wallet.

Even if an agent goes rogue, gets trapped in a retry loop, or is manipulated via prompt injection, its maximum financial impact is strictly contained to the budget you explicitly authorize.

## 🛑 The Problem
As AI agents become more autonomous, they need the ability to pay for inference, data, and compute via 0G's provider ecosystem. However, giving an AI agent direct, unrestricted access to a wallet introduces catastrophic risks:
  - **Prompt Injection**: Malicious actors could manipulate your agent into draining funds by spamming expensive provider endpoints.
  - **Infinite Loops & Retries**: A bug in the agent's logic or a network error could cause runaway API calls, racking up massive unintended charges.
  - **Lack of Granularity**: Standard wallets do not natively support "per-request" or "time-boxed" allowances for non-human actors.

## 💡 The Solution
SpendGuard does not replace 0G's 402 payment infrastructure; it wraps it in a programmable security layer. Backed by a smart contract deployed natively on 0G, SpendGuard allows developers and users to define hard, enforceable financial policies before the agent makes a single request.

## ✨ Core Features
- **Programmable Budgets**: Define strict global spending limits and individual agent-specific allowances.
- **Granular Constraints**: Enforce maximum per-request limits to prevent sudden, high-cost transactions.
- **Time-Based Limits**: Restrict spending velocity (e.g., "Max $10 per day").
- **Provider Restricting (Whitelisting)**: Ensure your agent can only spend funds with trusted, explicitly approved 0G ecosystem providers.
- **Replay & Duplicate Protection**: Built-in idempotency and duplicate-payment detection ensure that network retries or malicious transaction replays cannot cause double charges.

## 🏗️ Architecture & Tech Stack
SpendGuard is built as a full-stack decentralized application, structured to be easily adopted as an ecosystem primitive by 0G builders.
  - **Smart Contracts**: Built with Solidity and Hardhat (`contracts/SpendGuard.sol`, `hardhat.config.ts`).
  - **Frontend/Dashboard**: Built with Next.js, React, and Tailwind CSS for the Agent Console UI (next.config.mjs, `tailwind.config.js`, `src/app/agent-console/`).
  - **Database & Indexing**: Powered by Drizzle ORM to index agent logs and audit trails (`drizzle.config.ts`, `src/lib/db/`).  

### Repository Structure
- `/contracts` - Contains the core `SpendGuard.sol` policy enforcer and `MockUSDC.sol` for local testing.
- `/src/app/agent-console` - The primary UI for users to monitor agent spending, view HTTP 402 flows, and adjust budgets.
- `/src/app/audit-trail` - Verification interfaces including `DeliveryHashVerifier` and transaction audit tables.
- `/src/app/api` - Backend routes handling agent registration, 402 payment verification, and log streaming.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- pnpm or npm
- A 0G-compatible Web3 Wallet

### Installation
1. **Clone the repository:**
```bash
git clone https://github.com/your-org/SpendGuard.git
cd SpendGuard
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**

Copy the example environment file and fill in your network RPCs and database credentials.
```bash
cp .env.example .env
```

4. **Compile Smart Contracts:**
```bash
npx hardhat compile
```

5. **Run the Database Migrations (Drizzle):**
```bash
npm run db:push
```

6. **Start the Development Server:**
```bash
npm run dev
```
Navigate to `http://localhost:3000` to view the Agent Console.

## 🗺️ Vision: A 0G Ecosystem Primitive
SpendGuard is built on the thesis that **trustless AI requires trustless budget enforcement**.

We are validating this architecture with 0G builders to establish it as an open-source standard. By integrating SpendGuard, developers can offer their users peace of mind, knowing that autonomous agents are operating within a mathematically enforced financial sandbox.