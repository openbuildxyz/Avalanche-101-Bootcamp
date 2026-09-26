// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Educational receipt for a single simulated coffee batch; no real asset rights.
/// @dev Amounts use 3 decimals: 1,000 base units = 1 token = 1 simulated kg.
contract CoffeeWarehouseToken is ERC20, Ownable2Step {
    uint256 public constant MAX_BATCH_ISSUANCE = 10_000 * 1_000;
    uint256 public totalIssued;
    uint256 public documentVersion;
    string public assetDocument;

    error ZeroAmount();
    error EmptyAssetDocument();
    error BatchIssuanceExceeded(uint256 requested, uint256 remaining);

    event TokensIssued(address indexed operator, address indexed to, uint256 amount);
    /// @dev Records a redemption request only, not proof of physical delivery.
    event RedemptionRequested(address indexed holder, uint256 amount);
    event AssetDocumentUpdated(
        uint256 indexed version, string previousDocument, string newDocument
    );

    constructor(address initialOwner, string memory initialDocument)
        ERC20("Fuji Coffee Warehouse Receipt", "FCWR")
        Ownable(initialOwner)
    {
        _setAssetDocument(initialDocument);
    }

    function decimals() public pure override returns (uint8) {
        return 3;
    }

    /// @notice Issue receipts after the simulated custodian verifies the batch.
    /// @dev The lifetime cap is not replenished by burning.
    function mint(address to, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 remaining = MAX_BATCH_ISSUANCE - totalIssued;
        if (amount > remaining) revert BatchIssuanceExceeded(amount, remaining);
        totalIssued += amount;
        _mint(to, amount);
        emit TokensIssued(msg.sender, to, amount);
    }

    /// @notice Destroy caller's receipts to request simulated warehouse redemption.
    function burn(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _burn(msg.sender, amount);
        emit RedemptionRequested(msg.sender, amount);
    }

    function updateAssetDocument(string calldata document) external onlyOwner {
        _setAssetDocument(document);
    }

    function _setAssetDocument(string memory document) private {
        if (bytes(document).length == 0) revert EmptyAssetDocument();
        string memory previous = assetDocument;
        assetDocument = document;
        documentVersion += 1;
        emit AssetDocumentUpdated(documentVersion, previous, document);
    }
}
