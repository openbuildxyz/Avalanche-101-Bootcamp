// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title Fuji Carbon Credit
/// @notice A learning-only RWA token representing one simulated kilogram of verified CO2e reduction per token.
/// @dev The document URI is a reference only; it does not establish ownership of an off-chain asset.
contract FujiCarbonCredit is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant ASSET_MANAGER_ROLE = keccak256("ASSET_MANAGER_ROLE");

    string private _assetDocument;

    event AssetDocumentUpdated(string previousDocument, string newDocument, address indexed updatedBy);
    event CarbonCreditsIssued(address indexed to, uint256 amount, address indexed issuer);

    constructor(string memory initialAssetDocument) ERC20("Fuji Carbon Credit", "FCC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
        _grantRole(ASSET_MANAGER_ROLE, msg.sender);
        _assetDocument = initialAssetDocument;
        emit AssetDocumentUpdated("", initialAssetDocument, msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRole(ISSUER_ROLE) {
        _mint(to, amount);
        emit CarbonCreditsIssued(to, amount, msg.sender);
    }

    function updateAssetDocument(string calldata document) external onlyRole(ASSET_MANAGER_ROLE) {
        string memory previousDocument = _assetDocument;
        _assetDocument = document;
        emit AssetDocumentUpdated(previousDocument, document, msg.sender);
    }

    function assetDocument() external view returns (string memory) {
        return _assetDocument;
    }
}
