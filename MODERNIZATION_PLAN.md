# Modernization plan

This repository was originally a 2018 Truffle, Solidity 0.4, Web3 beta, and
React 15 course project. The modernized version targets a local Hardhat chain
first and keeps public-network deployment deliberately opt-in.

## Local release criteria

- Contracts compile with Solidity 0.8 and are covered by automated tests.
- The frontend uses an EIP-1193 wallet provider and can connect to a local
  Hardhat node.
- A deploy script writes a minimal public contract configuration consumed by
  the frontend.
- `npm run build`, `npm run test`, and `npm run test:contracts` succeed.

## Production boundary

Deployment to a public network additionally requires a secure deployer key,
an RPC provider, contract verification, a review/audit, and a static host.
No secret is stored in this repository.
