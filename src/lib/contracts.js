import { BrowserProvider, Contract } from 'ethers';

export async function loadDeployment() {
  const response = await fetch('/contracts.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Contract configuration is missing. Run npm run deploy:local first.');
  const deployment = await response.json();
  if (!deployment.eventTicketing?.address) {
    throw new Error('Contract configuration is empty. Run npm run deploy:local first.');
  } BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== deployment.chainId) {
    throw new Error(`Switch your wallet to chain ${deployment.chainId} and reconnect.`);
  }
  const signer = await provider.getSigner();
  const ticketing = new Contract(deployment.eventTicketing.address, deployment.eventTicketing.abi, signer);
  const ticket = new Contract(deployment.ticket.address, deployment.ticket.abi, signer);
  return { provider, signer, ticketing, ticket, account: await signer.getAddress() };
}
