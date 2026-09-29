// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Simulated warehouse receipt: one whole CWR represents one kilogram of coffee.
contract CoffeeWarehouseReceipt is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant DOCUMENT_ROLE = keccak256("DOCUMENT_ROLE");
    uint256 public immutable cap;
    string public assetDocument;
    event ReceiptIssued(address indexed to, uint256 amount);
    event AssetDocumentUpdated(string previousDocument, string newDocument, address indexed editor);

    constructor(address admin, uint256 capacity, string memory document) ERC20("Coffee Warehouse Receipt", "CWR") {
        require(admin != address(0) && capacity > 0, "invalid configuration");
        require(bytes(document).length > 0, "empty document");
        cap = capacity;
        assetDocument = document;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(DOCUMENT_ROLE, admin);
        emit AssetDocumentUpdated("", document, admin);
    }

    function decimals() public pure override returns (uint8) { return 0; }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(amount > 0 && amount <= cap - totalSupply(), "invalid issuance");
        _mint(to, amount);
        emit ReceiptIssued(to, amount);
    }

    function burn(uint256 amount) public override {
        require(amount > 0, "zero burn");
        super.burn(amount);
    }

    function burnFrom(address account, uint256 amount) public override {
        require(amount > 0, "zero burn");
        super.burnFrom(account, amount);
    }

    function updateAssetDocument(string calldata document) external onlyRole(DOCUMENT_ROLE) {
        require(bytes(document).length > 0, "empty document");
        string memory previous = assetDocument;
        assetDocument = document;
        emit AssetDocumentUpdated(previous, document, msg.sender);
    }
}
