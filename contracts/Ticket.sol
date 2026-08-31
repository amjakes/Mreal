// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721Enumerable} from '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';

/// @title Ticket
/// @notice Transferable event ticket NFTs minted and redeemed only by EventTicketing.
contract Ticket is ERC721Enumerable {
    error OnlyEventContract();
    error TicketAlreadyRedeemed();

    struct TicketData {
        uint256 eventId;
        bool redeemed;
    }

    address public immutable eventContract;
    uint256 private nextTicketId;
    mapping(uint256 ticketId => TicketData) private ticketData;

    event TicketRedeemed(uint256 indexed ticketId, uint256 indexed eventId);

    modifier onlyEventContract() {
        if (msg.sender != eventContract) revert OnlyEventContract();
        _;
    }

    constructor(address eventContract_) ERC721('ChainPass Ticket', 'PASS') {
        eventContract = eventContract_;
    }

    function mint(address buyer, uint256 eventId) external onlyEventContract returns (uint256 ticketId) {
        ticketId = nextTicketId++;
        ticketData[ticketId] = TicketData({eventId: eventId, redeemed: false});
        _safeMint(buyer, ticketId);
    }

    function redeem(uint256 ticketId) external onlyEventContract {
        if (ticketData[ticketId].redeemed) revert TicketAlreadyRedeemed();
        ticketData[ticketId].redeemed = true;
        emit TicketRedeemed(ticketId, ticketData[ticketId].eventId);
    }

    function eventIdOf(uint256 ticketId) external view returns (uint256) {
        _requireOwned(ticketId);
        return ticketData[ticketId].eventId;
    }

    function isRedeemed(uint256 ticketId) external view returns (bool) {
        _requireOwned(ticketId);
        return ticketData[ticketId].redeemed;
    }
}
