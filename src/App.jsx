import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import QRCode from 'qrcode';
import { connectWallet, loadDeployment } from './lib/contracts.js';

const shortAddress = (address) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';
const formatPrice = (price) => ethers.formatEther(price);
const friendlyError = (error) => {
  const message = error?.shortMessage || error?.message || 'Unable to connect. Please try again.';
  if (/user rejected|action_rejected/i.test(message)) return 'Wallet connection was cancelled.';
  if (/install a wallet|window\.ethereum/i.test(message)) return 'Install MetaMask, then refresh this page.';
  if (/chain 31337|wrong network/i.test(message)) return 'Switch MetaMask to Local Hardhat (chain ID 31337), then reconnect.';
  if (/failed to fetch|network error|ECONNREFUSED/i.test(message)) return 'Local Hardhat is unavailable. Start npm run node, then run npm run deploy:local.';
  return message;
};

export default function App() {
  const [deployment, setDeployment] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [notice, setNotice] = useState('Load the local deployment, then connect a wallet.');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', price: '0.01', supply: '10' });
  const [proof, setProof] = useState('');
  const [createdProof, setCreatedProof] = useState(null);
  const [page, setPage] = useState('discover');

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
    try {
      const count = Number(await currentWallet.ticketing.eventCount());
      const loadedEvents = await Promise.all([...Array(count).keys()].map(async (id) => {
        const data = await currentWallet.ticketing.eventDetails(id);
        return { id, ...data };
      }));
      const balance = Number(await currentWallet.ticket.balanceOf(currentWallet.account));
      const loadedTickets = await Promise.all([...Array(balance).keys()].map(async (index) => {
        const id = Number(await currentWallet.ticket.tokenOfOwnerByIndex(currentWallet.account, index));
        const eventId = Number(await currentWallet.ticket.eventIdOf(id));
        return { id, eventId, redeemed: await currentWallet.ticket.isRedeemed(id) };
      }));
      setEvents(loadedEvents);
      setTickets(loadedTickets);
    } catch (error) {
      setNotice(friendlyError(error));
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
      setNotice(friendlyError(error));
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
      const value = JSON.stringify({ ticketId: ticket.id, challenge, deadline: deadline.toString(), signature });
      const qr = await QRCode.toDataURL(value, { width: 300, margin: 1 });
      setCreatedProof({ value, qr, ticket });
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
    <header><div><p className="eyebrow">EVENTS, OWNED BY YOU</p><h1><img className="brand-logo" src="/mreal-logo.jpg" alt="Mreal logo" />Mreal</h1></div>
      {wallet && <nav className="app-nav"><button className={page === 'discover' ? 'active' : ''} onClick={() => setPage('discover')}>Discover</button><button className={page === 'tickets' ? 'active' : ''} onClick={() => setPage('tickets')}>My tickets</button><button className={page === 'host' ? 'active' : ''} onClick={() => setPage('host')}>Host dashboard</button></nav>}
      <button disabled={!deployment || busy} onClick={wallet ? () => { setWallet(null); setTickets([]); setNotice('Wallet disconnected.'); } : onConnect}>{wallet ? shortAddress(wallet.account) : 'Connect wallet'}</button>
    </header>
    <p className="notice" role="status">{notice}</p>
    {!wallet ? <section className="hero-panel"><div><p className="eyebrow">WELCOME TO MREAL</p><h2>Discover experiences worth <em>showing up for.</em></h2><p>Find local moments, own your ticket, and arrive ready. Blockchain stays in the background—your next memory takes centre stage.</p><button disabled={!deployment || busy} onClick={onConnect}>Connect to explore →</button><div className="hero-points"><span>⌁ Built for real moments</span><span>◈ Your ticket, your wallet</span></div></div><div className="hero-ticket-stage"><div className="hero-ticket"><div className="hero-ticket__face hero-ticket__front"><small>MREAL PRESENTS</small><strong>CONFIDENCE<br />IN EVERY CLICK.</strong><small>USALAMA WAKO GUARANTEED</small></div><div className="hero-ticket__face hero-ticket__back"><img src="/mreal-logo.jpg" alt="" /><span>MREAL</span><small>ONE TICKET · EVERY EXPERIENCE</small><div className="ticket-lines" /></div></div><div className="hero-ticket-shadow" /></div></section> : <>
      {page === 'host' && <section className="panel host-create"><p className="eyebrow">HOST CENTER</p><h2>Create an event</h2><p>Bring people together. Ticket sales and ownership are secured on-chain.</p><form onSubmit={submitEvent}>
        <input required maxLength="120" placeholder="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required min="0" step="0.000001" type="number" placeholder="Price in ETH" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <input required min="1" max="4294967295" type="number" placeholder="Ticket supply" value={form.supply} onChange={(e) => setForm({ ...form, supply: e.target.value })} />
        <button disabled={busy}>Create event</button>
      </form></section>}
      {page === 'discover' && <section><div className="section-head"><div><p className="eyebrow">EXPLORE</p><h2>Events around you</h2></div><span>{events.length} events found</span></div><div className="grid">{events.map((event) => <article className="card" key={event.id}>
        <p className="eyebrow">EVENT #{event.id}</p><h3>{event.name}</h3><p>{formatPrice(event.price)} ETH · {Number(event.totalTickets) - Number(event.soldTickets)} remaining</p>
        <p className="muted">Host: {shortAddress(event.host)}</p><button disabled={busy || !event.active || Number(event.soldTickets) >= Number(event.totalTickets)} onClick={() => buy(event)}>Buy ticket</button>
      </article>)}</div>{!events.length && <div className="empty-state"><strong>No events found</strong><p>Be the first to host an experience.</p></div>}</section>}
      {page === 'tickets' && <section><div className="section-head"><div><p className="eyebrow">YOUR COLLECTION</p><h2>My tickets</h2></div><span>Ready for the door</span></div><div className="grid">{tickets.length ? tickets.map((ticket) => <article className="card" key={ticket.id}>
        <p className="eyebrow">TICKET #{ticket.id}</p><h3>{events.find((event) => event.id === ticket.eventId)?.name || `Event #${ticket.eventId}`}</h3><p>{ticket.redeemed ? 'Redeemed' : 'Active'}</p>
        {!ticket.redeemed && <button disabled={busy} onClick={() => createProof(ticket)}>Create entry proof</button>}
      </article>) : <p className="muted">No tickets in this wallet.</p>}</div>
      {createdProof && <div className="proof-card"><img src={createdProof.qr} alt="Ticket entry proof QR code" /><div><p className="eyebrow">ENTRY PROOF READY</p><h3>You're on the list.</h3><p>Show this proof to the host. It expires in five minutes.</p><button onClick={() => navigator.clipboard?.writeText(createdProof.value)}>Copy entry proof</button></div></div>}</section>}
      {page === 'host' && <section className="panel host-tools"><p className="eyebrow">DOOR MODE</p><h2>Validate an entry</h2><p>Paste an attendee’s signed proof to verify ownership and redeem their ticket.</p>
        <textarea placeholder="Entry proof JSON" value={proof} onChange={(e) => setProof(e.target.value)} /><button disabled={busy || !proof} onClick={redeem}>Redeem proof</button>
      <div className="host-events">{myEvents.length ? myEvents.map((event) => <button key={event.id} disabled={busy} onClick={() => withdraw(event.id)}>Withdraw {event.name} proceeds</button>) : <p>You have not hosted an event yet.</p>}</div></section>}
    </>}
  </main>;
}
