const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  const EventTicketing = await hre.ethers.getContractFactory('EventTicketing');
  const ticketing = await EventTicketing.deploy();
  await ticketing.waitForDeployment();
  const ticketAddress = await ticketing.ticket();
  const network = await hre.ethers.provider.getNetwork();

  const artifact = await hre.artifacts.readArtifact('EventTicketing');
  const ticketArtifact = await hre.artifacts.readArtifact('Ticket');
  const deployment = {
    chainId: Number(network.chainId),
    eventTicketing: { address: await ticketing.getAddress(), abi: artifact.abi },
    ticket: { address: ticketAddress, abi: ticketArtifact.abi },
  };
  const output = path.join(__dirname, '..', 'public', 'contracts.json');
  fs.writeFileSync(output, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`EventTicketing deployed to ${deployment.eventTicketing.address}`);
  console.log(`Ticket deployed to ${ticketAddress}`);
  console.log(`Frontend configuration written to ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
