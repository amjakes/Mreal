const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('EventTicketing', function () {
  async function deployFixture() {
    const [owner, host, buyer, other] = await ethers.getSigners();
    const EventTicketing = await ethers.getContractFactory('EventTicketing');
    const ticketing = await EventTicketing.deploy();
    return { ticketing, owner, host, buyer, other };
  }

  async function createEvent(ticketing, host, price = ethers.parseEther('0.1')) {
    await ticketing.connect(host).createEvent('Local Music Festival', price, 2);
    return price;
  }

  it('creates an event with validated data', async function () {
    const { ticketing, host } = await deployFixture();
    const price = await createEvent(ticketing, host);
    const eventData = await ticketing.eventDetails(0);
    expect(eventData.name).to.equal('Local Music Festival');
    expect(eventData.price).to.equal(price);
    expect(eventData.host).to.equal(host.address);
  });

  it('rejects empty event names and zero supply', async function () {
    const { ticketing, host } = await deployFixture();
    await expect(ticketing.connect(host).createEvent('', 0, 1)).to.be.revertedWithCustomError(ticketing, 'InvalidEventName');
    await expect(ticketing.connect(host).createEvent('Valid', 0, 0)).to.be.revertedWithCustomError(ticketing, 'InvalidTicketSupply');
  });

  it('mints an NFT ticket and credits proceeds on exact payment', async function () {
    const { ticketing, host, buyer } = await deployFixture();
    const price = await createEvent(ticketing, host);
    await expect(ticketing.connect(buyer).buyTicket(0, { value: price }))
      .to.emit(ticketing, 'TicketPurchased')
      .withArgs(0, 0, buyer.address);
    const ticket = await ethers.getContractAt('Ticket', await ticketing.ticket());
    expect(await ticket.ownerOf(0)).to.equal(buyer.address);
    expect(await ticketing.withdrawableProceeds(0)).to.equal(price);
  });

  it('rejects incorrect payment and purchases after supply is sold out', async function () {
    const { ticketing, host, buyer, other } = await deployFixture();
    const price = await createEvent(ticketing, host);
    await expect(ticketing.connect(buyer).buyTicket(0, { value: price - 1n })).to.be.revertedWithCustomError(ticketing, 'IncorrectPayment');
    await ticketing.connect(buyer).buyTicket(0, { value: price });
    await ticketing.connect(other).buyTicket(0, { value: price });
    await expect(ticketing.connect(host).buyTicket(0, { value: price })).to.be.revertedWithCustomError(ticketing, 'SoldOut');
  });

  it('allows only a host to withdraw that event proceeds', async function () {
    const { ticketing, host, buyer, other } = await deployFixture();
    const price = await createEvent(ticketing, host);
    await ticketing.connect(buyer).buyTicket(0, { value: price });
    await expect(ticketing.connect(other).withdrawProceeds(0)).to.be.revertedWithCustomError(ticketing, 'NotEventHost');
    await expect(ticketing.connect(host).withdrawProceeds(0)).to.changeEtherBalances([ticketing, host], [-price, price]);
    await expect(ticketing.connect(host).withdrawProceeds(0)).to.be.revertedWithCustomError(ticketing, 'EmptyWithdrawal');
  });

  it('redeems only an unexpired proof from the current ticket owner', async function () {
    const { ticketing, host, buyer, other } = await deployFixture();
    const price = await createEvent(ticketing, host);
    await ticketing.connect(buyer).buyTicket(0, { value: price });
    const challenge = ethers.keccak256(ethers.toUtf8Bytes('door-check-1'));
    const deadline = BigInt((await ethers.provider.getBlock('latest')).timestamp + 300);
    const digest = await ticketing.redemptionDigest(0, 0, challenge, deadline);
    const signature = await buyer.signMessage(ethers.getBytes(digest));
    await expect(ticketing.connect(host).redeemTicket(0, challenge, deadline, signature))
      .to.emit(ticketing, 'TicketRedeemed')
      .withArgs(0, 0, buyer.address);
    const ticket = await ethers.getContractAt('Ticket', await ticketing.ticket());
    expect(await ticket.isRedeemed(0)).to.equal(true);
    await expect(ticketing.connect(other).redeemTicket(0, challenge, deadline, signature)).to.be.revertedWithCustomError(ticketing, 'NotEventHost');
  });
});
