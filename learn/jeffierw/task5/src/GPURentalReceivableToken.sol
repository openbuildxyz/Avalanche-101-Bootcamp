// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title GPURentalReceivableToken
 * @notice A learning-only RWA token representing confirmed GPU equipment rental receivables.
 * @dev One whole GRRT represents a simulated receivable with a face value of one USDC.
 */
contract GPURentalReceivableToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant DOCUMENT_ROLE = keccak256("DOCUMENT_ROLE");

    string private _assetDocument;

    error EmptyAssetDocument();
    error InvalidAdmin();
    error ZeroAmount();

    event ReceivableIssued(address indexed operator, address indexed recipient, uint256 amount);
    event ReceivableBurned(address indexed account, uint256 amount);
    event AssetDocumentUpdated(address indexed operator, string previousDocument, string newDocument);

    constructor(address initialAdmin, string memory initialAssetDocument)
        ERC20("GPU Rental Receivable Token", "GRRT")
    {
        if (initialAdmin == address(0)) revert InvalidAdmin();
        if (bytes(initialAssetDocument).length == 0) revert EmptyAssetDocument();

        _assetDocument = initialAssetDocument;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(MINTER_ROLE, initialAdmin);
        _grantRole(DOCUMENT_ROLE, initialAdmin);
    }

    /// @notice Uses six decimals so one whole GRRT has the same unit precision as USDC.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
        emit ReceivableIssued(msg.sender, to, amount);
    }

    /// @notice Burns settled receivable tokens held by the caller.
    function burn(uint256 amount) public override {
        if (amount == 0) revert ZeroAmount();
        super.burn(amount);
        emit ReceivableBurned(msg.sender, amount);
    }

    function updateAssetDocument(string calldata newDocument) external onlyRole(DOCUMENT_ROLE) {
        if (bytes(newDocument).length == 0) revert EmptyAssetDocument();

        string memory previousDocument = _assetDocument;
        _assetDocument = newDocument;
        emit AssetDocumentUpdated(msg.sender, previousDocument, newDocument);
    }

    function assetDocument() external view returns (string memory) {
        return _assetDocument;
    }
}
