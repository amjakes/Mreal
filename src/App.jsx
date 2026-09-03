import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { connectWallet, loadDeployment } from './lib/contracts.js';

const shortAddress = (address) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';
const formatPrice = (price) => ethers.formatEther(price);

export default function App() {
  const [deployment, setDeployment] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [notice, setNotice] = useState('Load the local deployment, then connect a wallet.');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', price: '0.01', supply: '10' });
  const [proof, setProof] = useState('');
  const [createdProof, setCreatedProof] = useState('');

  useEffect(() => {
    loadDeployment().then(setDeployment).catch((error) => setNotice(error.message));
  }, []);

  const myEvents = useMemo(
    () => events.filter((event) => wallet && event.host.toLowerCase() === wallet.account.toLowerCase()),
    [events, wallet],
  );

  async function refresh(currentWallet = wallet) {
    if (!currentWallet) return;
    setBusy(true);
    try {await Promise.all([...Array(balance).keys()].map(async (index) => {
        const id = Number(await currentWallet.ticket.tokenOfOwnerByIndex(currentWallet.account, index));
        const eventId = Number(await currentWallet.ticket.eventIdOf(id));
        return { id, eventId, redeemed: await currentWallet.ticket.isRedeemed(id) };
      }));
      setEvents(loadedEvents);
      setTickets(loadedTickets);
    } catch (error) {
      setNotice(error.shortMessage || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function onConnect() {
    setBusy(true);
    try {
      const connected = await connectWallet(deployment);
      setWallet(connected);
      await refresh(connected);
      setNotice(`Connected as ${shortAddress(connected.account)}.`);
    } catch (error) {
      setNotice(error.shortMessage || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitEvent(event) {
    event.preventDefault();
    if (!wallet) return;
    setBusy(true);
    try {
      const transaction = await wallet.ticketing.createEvent(form.name.trim(), ethers.parseEther(form.price), Number(form.supply));
      await transaction.wait();
      setForm({ name: '', price: '0.01', supply: '10' });
      await refresh();
      setNotice('Event created.');
    } catch (error) {
      setNotice(error.shortMessage || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function buy(event) {
    setBusy(true);
    try {
      const transaction = await wallet.ticketing.buyTicket(event.id, { value: event.price });
      await transaction.wait();
      await refresh();
      setNotice(`Ticket purchased for ${event.name}.`);
    } catch (error) {
      setNotice(error.shortMessage || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(eventId) {
    setBusy(true);
    try {
      const transaction = await wallet.ticketing.withdrawProceeds(eventId);
      await transaction.wait();
      setNotice('Event proceeds withdrawn to your wallet.');
    } catch (error) {
      setNotice(error.shortMessage || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function createProof(ticket) {
    setBusy(true);
    try {
      const challenge = ethers.hexlify(ethers.randomBytes(32));
      const latest = await wallet.provider.getBlock('latest');
      const deadline = BigInt(latest.timestamp + 300);
      const digest = await wallet.ticketing.redemptionDigest(ticket.eventId, ticket.id, challenge, deadline);
      const signature = await wallet.signer.signMessage(ethers.getBytes(digest));
      setCreatedProof(JSON.stringify({ ticketId: ticket.id, challenge, deadline: deadline.toString(), signature }));
      setNotice('Proof created. Share it with the event host before it expires.');
    } catch (error) {
      setNotice(error.shortMessage || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    setBusy(true);
    try {
      const data = JSON.parse(proof);
      const transaction = await wallet.ticketing.redeemTicket(data.ticketId, data.challenge, data.deadline, data.signature);
      await transaction.wait();
      setProof('');
      await refresh();
      setNotice('Ticket redemption confirmed.');
    } catch (error) {
      setNotice(error.shortMessage || error.message || 'The proof must be valid JSON.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="app-shell">
    <header><div><p className="eyebrow">LOCAL BLOCKCHAIN TICKETING</p><h1>ChainPass</h1></div>
      <button disabled={!deployment || busy} onClick={onConnect}>{wallet ? shortAddress(wallet.account) : 'Connect wallet'}</button>
    </header>
    <p className="notice" role="status">{notice}</p>
    {!wallet ? <section className="panel"><h2>Local setup</h2><p>Start the chain, deploy the contracts, add Local Hardhat to MetaMask, then connect.</p><code>npm run node · npm run deploy:local · npm run dev</code></section> : <>
      <section className="panel"><h2>Create an event</h2><form onSubmit={submitEvent}>
        <input required maxLength="120" placeholder="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required min="0" step="0.000001" type="number" placeholder="Price in ETH" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <input required min="1" max="4294967295" type="number" placeholder="Ticket supply" value={form.supply} onChange={(e) => setForm({ ...form, supply: e.target.value })} />
        <button disabled={busy}>Create event</button>
      </form></section>
      <section><h2>Available events</h2><div className="grid">{events.map((event) => <article className="card" key={event.id}>
        <p className="eyebrow">EVENT #{event.id}</p><h3>{event.name}</h3><p>{formatPrice(event.price)} ETH · {Number(event.totalTickets) - Number(event.soldTickets)} remaining</p>
        <p className="muted">Host: {shortAddress(event.host)}</p><button disabled={busy || !event.active || Number(event.soldTickets) >= Number(event.totalTickets)} onClick={() => buy(event)}>Buy ticket</button>
      </article>)}</div></section>
      <section><h2>My tickets</h2><div className="grid">{tickets.length ? tickets.map((ticket) => <article className="card" key={ticket.id}>
        <p className="eyebrow">TICKET #{ticket.id}</p><h3>{events.find((event) => event.id === ticket.eventId)?.name || `Event #${ticket.eventId}`}</h3><p>{ticket.redeemed ? 'Redeemed' : 'Active'}</p>
        {!ticket.redeemed && <button disabled={busy} onClick={() => createProof(ticket)}>Create entry proof</button>}
      </article>) : <p className="muted">No tickets in this wallet.</p>}</div>
      {createdProof && <><h3>Entry proof</h3><textarea readOnly value={createdProof} /></>}</section>
      <section className="panel"><h2>Host tools</h2><p>Paste an attendee’s entry proof. Proofs expire after five minutes and can only be redeemed once.</p>
        <textarea placeholder="Entry proof JSON" value={proof} onChange={(e) => setProof(e.target.value)} /><button disabled={busy || !proof} onClick={redeem}>Redeem proof</button>
        <div className="host-events">{myEvents.map((event) => <button key={event.id} disabled={busy} onClick={() => withdraw(event.id)}>Withdraw event #{event.id} proceeds</button>)}</div>
      </section>
    </>}
  </main>;
}
