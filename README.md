# Mreal

Mreal is a local-first Ethereum ticketing demonstration. Event hosts create
events and sell ERC-721 tickets. Ticket holders create a short-lived ownership
proof, which the host submits to redeem the ticket at entry.

This version is a modernized replacement for the original 2018 course project:
React/Vite, ethers v6, Hardhat, Solidity 0.8, and OpenZeppelin Contracts.

## What is included

- ERC-721 tickets, minted only by the event contract.
- Exact-price purchases and isolated, pull-based host withdrawals.
- Ticket-capacity checks and host-controlled event activation.
- On-chain redemption that requires an unexpired signature from the current
  ticket owner and rejects replayed proofs.
- A browser frontend that uses the EIP-1193 wallet interface (`window.ethereum`).
- Automated frontend smoke tests and contract tests.

## Local deployment

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- MetaMask or another EIP-1193-compatible browser wallet

Install the dependencies once:

```sh
npm install
```

In terminal one, start the local chain and leave it running:

```sh
npm run node
```

In terminal two, deploy the contracts and generate the frontend configuration:

```sh
npm run deploy:local
```

In terminal three, start the frontend:

```sh
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

### Configure MetaMask

Add a custom network with these values:

| Setting | Value |
| --- | --- |
| Network name | Local Hardhat |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | ETH |

Import one of the private keys printed by `npm run node`. These accounts are
public test accounts—never use their keys on a real network.

`npm run deploy:local` writes `public/contracts.json`. It is deliberately
ignored by Git because it is generated for the particular local chain. Re-run
the deployment script whenever the local node is restarted.

## Verification commands

```sh
npm run build
npm run test
npm run test:contracts
```

For a one-off deployment using Hardhat's temporary in-process chain, use:

```sh
npm run deploy:local:inprocess
```

It is useful for build verification, but not for browser use because that chain
stops when the command exits.

## Product and security boundary

This repository is ready for local development and demonstration, not public
sale. A public deployment still needs a key-management plan, a configured RPC
provider, contract verification, monitoring, legal/compliance review, and an
independent security audit. Keep private keys exclusively in `.env` or a secure
deployment service; never commit them.

The contract is intentionally non-custodial for hosts: ticket revenue is
credited per event and can only be withdrawn by that event's host. Entry proofs
bind the contract address, chain ID, event, ticket, random challenge, and
deadline, which prevents cross-chain and replay use.
