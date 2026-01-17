---
sidebar_position: 1
slug: /
---

# Getting Started

Welcome to **CronoPay** - the AI-powered payment agent for Cronos blockchain.

CronoPay is an MCP-native payment agent that brings AI intelligence, visual planning, and developer tools to the Cronos ecosystem.

## What is CronoPay?

CronoPay is the first payment agent for Cronos that combines:

- **AI Planning** - Multi-step execution plans with risk assessment
- **Visual Tools** - HTML/Mermaid/ASCII execution flow diagrams  
- **Transaction Simulator** - Risk-free dry run before execution
- **Batch Transfers** - Airdrop to multiple recipients
- **Smart Contract Tools** - Inspect, read, estimate gas via natural language
- **Transaction Analytics** - Query history with AI insights
- **MCP-Native** - Works with ChatGPT, Claude, and any MCP client

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- OpenAI API key
- Cronos Testnet wallet with private key

### Installation

1. Clone the repository:

```bash
git clone https://github.com/CodeswithrohStudio/CronoPay.git
cd CronoPay
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` and add:

```env
OPENAI_API_KEY=sk-your-api-key-here
CRONOS_PRIVATE_KEY=your-private-key
CRONOS_RPC_URL=https://evm-t3.cronos.org
CRONOS_USDC_TOKEN_ADDRESS=0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0
```

4. Start the MCP server:

```bash
npm run dev
```

The server will start on `http://localhost:3000/mcp`

## Next Steps

- [Connect with ChatGPT/Claude](./setup/chatgpt-setup)
- [Explore MCP Tools](./tools/overview)
- [Try Example Prompts](./examples/basic-payments)
