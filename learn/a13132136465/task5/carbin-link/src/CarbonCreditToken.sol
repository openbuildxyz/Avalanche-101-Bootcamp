// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title Verified Carbon Credit Token
/// @notice Learning-only ERC-20 representation of verified carbon-reduction units.
/// @dev One whole token (1e18 base units) represents one verified metric tonne of CO2e.
contract CarbonCreditToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ASSET_DOCUMENT_ROLE = keccak256("ASSET_DOCUMENT_ROLE");

    string public assetDocument;

    event MinterAuthorizationUpdated(address indexed account, bool authorized);
    event AssetDocumentUpdaterAuthorizationUpdated(address indexed account, bool authorized);
    event AssetDocumentUpdated(
        string previousDocument,
        string newDocument,
        address indexed updatedBy
    );

    error ZeroAddress();
    error EmptyAssetDocument();

    constructor(string memory initialAssetDocument)
        ERC20("Verified Carbon Credit", "VCC")
    {
        if (bytes(initialAssetDocument).length == 0) revert EmptyAssetDocument();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(ASSET_DOCUMENT_ROLE, msg.sender);
        assetDocument = initialAssetDocument;

        emit MinterAuthorizationUpdated(msg.sender, true);
        emit AssetDocumentUpdaterAuthorizationUpdated(msg.sender, true);
        emit AssetDocumentUpdated("", initialAssetDocument, msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function updateAssetDocument(string calldata newDocument)
        external
        onlyRole(ASSET_DOCUMENT_ROLE)
    {
        if (bytes(newDocument).length == 0) revert EmptyAssetDocument();
        string memory previousDocument = assetDocument;
        assetDocument = newDocument;
        emit AssetDocumentUpdated(previousDocument, newDocument, msg.sender);
    }

    function setMinter(address account, bool authorized)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (account == address(0)) revert ZeroAddress();
        if (authorized) {
            _grantRole(MINTER_ROLE, account);
        } else {
            _revokeRole(MINTER_ROLE, account);
        }
        emit MinterAuthorizationUpdated(account, authorized);
    }

    function setAssetDocumentUpdater(address account, bool authorized)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (account == address(0)) revert ZeroAddress();
        if (authorized) {
            _grantRole(ASSET_DOCUMENT_ROLE, account);
        } else {
            _revokeRole(ASSET_DOCUMENT_ROLE, account);
        }
        emit AssetDocumentUpdaterAuthorizationUpdated(account, authorized);
    }

    function isMinter(address account) external view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }

    function isAssetDocumentUpdater(address account) external view returns (bool) {
        return hasRole(ASSET_DOCUMENT_ROLE, account);
    }
}

