// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import {MessageHashUtils} from '@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {Ticket} from './Ticket.sol';

/// @title EventTicketing
/// @notice Creates events, sells tickets, verifies ownership proofs, and releases proceeds to hosts.
contract EventTicketing is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct EventData {
        string name;
        uint96 price;
        uint32 totalTickets;
        uint32 soldTickets;
        address host;
        bool active;
    }

    error EventDoesNotExist();
    error NotEventHost();
    error EventIsInactive();
    error InvalidEventName();
    error InvalidTicketSupply();
    error IncorrectPayment();
    error SoldOut();
    error EmptyWithdrawal();
    error TransferFailed();
    error ProofExpired();
    error ProofAlreadyUsed();
    error InvalidTicketOwner();

    Ticket public immutable ticket;
    EventData[] private events;
    mapping(uint256 eventId => uint256 amount) public withdrawableProceeds;
    mapping(bytes32 proofDigest => bool used) public usedProofs;

    event EventCreated(uint256 indexed eventId, address indexed host, string name, uint256 price, uint256 supply);
    event TicketPurchased(uint256 indexed eventId, uint256 indexed ticketId, address indexed buyer);
    event TicketRedeemed(uint256 indexed eventId, uint256 indexed ticketId, address indexed attendee);
    event ProceedsWithdrawn(uint256 indexed eventId, address indexed host, uint256 amount);
    event EventStatusChanged(uint256 indexed eventId, bool active);

    constructor() Ownable(msg.sender) {
        ticket = new Ticket(address(this));
    }

    function eventCount() external view returns (uint256) {
        return events.length;
    }

    function getEvent(uint256 eventId) external view returns (EventData memory) {
        _event(eventId);
        return events[eventId];
    }

    function createEvent(string calldata name, uint96 price, uint32 totalTickets) external returns (uint256 eventId) {
        if (bytes(name).length == 0 || bytes(name).length > 120) revert InvalidEventName();
        if (totalTickets == 0) revert InvalidTicketSupply();
        eventId = events.length;
        events.push(EventData(name, price, totalTickets, 0, msg.sender, true));
        emit EventCreated(eventId, msg.sender, name, price, totalTickets);
    }

    function setEventActive(uint256 eventId, bool active) external {
        EventData storage eventData = _event(eventId);
        if (eventData.host != msg.sender) revert NotEventHost();
        eventData.active = active;
        emit EventStatusChanged(eventId, active);
    }

    function buyTicket(uint256 eventId) external payable nonReentrant returns (uint256 ticketId) {
        EventData storage eventData = _event(eventId);
        if (!eventData.active) revert EventIsInactive();
        if (eventData.soldTickets >= eventData.totalTickets) revert SoldOut();
        if (msg.value != eventData.price) revert IncorrectPayment();
        eventData.soldTickets += 1;
        withdrawableProceeds[eventId] += msg.value;
        ticketId = ticket.mint(msg.sender, eventId);
        emit TicketPurchased(eventId, ticketId, msg.sender);
    }

    function redeemTicket(uint256 ticketId, bytes32 challenge, uint256 deadline, bytes calldata signature) external {
        uint256 eventId = ticket.eventIdOf(ticketId);
        EventData storage eventData = _event(eventId);
        if (eventData.host != msg.sender) revert NotEventHost();
        if (block.timestamp > deadline) revert ProofExpired();
        bytes32 proofDigest = redemptionDigest(eventId, ticketId, challenge, deadline);
        if (usedProofs[proofDigest]) revert ProofAlreadyUsed();
        address signer = proofDigest.toEthSignedMessageHash().recover(signature);
        if (signer != ticket.ownerOf(ticketId)) revert InvalidTicketOwner();
        usedProofs[proofDigest] = true;
        ticket.redeem(ticketId);
        emit TicketRedeemed(eventId, ticketId, signer);
    }

    function redemptionDigest(uint256 eventId, uint256 ticketId, bytes32 challenge, uint256 deadline)
        public view returns (bytes32)
    {
        return keccak256(abi.encode(address(this), block.chainid, eventId, ticketId, challenge, deadline));
    }

    function withdrawProceeds(uint256 eventId) external nonReentrant {
        EventData storage eventData = _event(eventId);
        if (eventData.host != msg.sender) revert NotEventHost();
        uint256 amount = withdrawableProceeds[eventId];
        if (amount == 0) revert EmptyWithdrawal();
        withdrawableProceeds[eventId] = 0;
        (bool sent,) = payable(msg.sender).call{value: amount}('');
        if (!sent) revert TransferFailed();
        emit ProceedsWithdrawn(eventId, msg.sender, amount);
    }

    function _event(uint256 eventId) private view returns (EventData storage eventData) {
        if (eventId >= events.length) revert EventDoesNotExist();
        return events[eventId];
    }
}
