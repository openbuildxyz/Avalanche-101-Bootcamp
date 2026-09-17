// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title RentalIncomeRightToken (XRIR)
 * @notice 星海广场 A 座 12 层商业物业「未来 12 个月租金收益权」的链上凭证（RWA Token）。
 *         On-chain certificate for the future 12-month rental income right of a
 *         commercial office floor in Shanghai.
 *
 * @dev 业务映射 / Business mapping
 *      ------------------------------------------------------------------
 *      标的资产 Underlying asset
 *          上海市浦东新区“星海广场 A 座 12 层”商业办公物业在 2026-01-01 至
 *          2026-12-31 期间的租金收益权, 年度租金总额 12,000,000 CNY。
 *
 *      托管与资产证明 Custody / proof
 *          由专项计划 SPV「星海资产一号专项计划」持有并托管物业收益权,
 *          管理人负责出具租赁合同摘要、资产评估报告及线下登记编号,
 *          其哈希/IPFS 地址写入本合约的 assetDocument 字段。
 *
 *      份额单位 Unit
 *          1 XRIR = 1 CNY 的租金收益权 (1 token = 1 CNY of rental income right)。
 *          因此 MAX_SUPPLY = 12,000,000 XRIR 恰好对应 1,200 万元年度租金。
 *
 *      业务行为 Business actions
 *          mint      -> 租金收益权份额上链发行 (issuance / primary offering)
 *          transfer  -> 投资者之间二级转让收益权份额 (secondary transfer)
 *          burn      -> 到期兑付注销或提前赎回 (redemption / expiry cancellation)
 *
 *      ------------------------------------------------------------------
 *      风险边界 / Risk boundaries
 *          - 本合约仅用于技术学习与业务模拟, 不涉及真实资产募集或金融产品发行。
 *          - 本合约不实现任何收益分配、利息计算或现金流兑付逻辑;
 *            租金收益的实际兑付在链下由 SPV 完成, 链上 Token 仅作为权益凭证。
 *          - 资产证明字段由中心化管理人写入, 因此存在信任假设:
 *            链上无法自证链下资产真实存在, 需依赖审计、托管及法律结构。
 */
contract RentalIncomeRightToken is ERC20, ERC20Burnable, Ownable, Pausable {
    /// @notice 总发行上限: 12,000,000 XRIR, 对应 1,200 万元人民币年度租金收益权。
    uint256 public constant MAX_SUPPLY = 12_000_000 ether;

    /// @notice 链上保存的资产证明信息 (IPFS URI / 文档摘要 / 线下凭证编号)。
    string private _assetDocument;

    /// @notice 资产证明信息最后一次上链时间 (block.timestamp)。
    uint256 public assetDocumentUpdatedAt;

    /// @notice 资产证明信息为空时回滚。Reverts when the asset document is empty.
    error EmptyAssetDocument();

    /// @notice 发行后总供应量超过上限时回滚。Reverts when the hard cap would be exceeded.
    error MaxSupplyExceeded(uint256 maxSupply, uint256 attemptedTotalSupply);

    /// @notice 新增租金收益权份额时触发。Emitted when new rental-income rights are issued.
    event TokensMinted(address indexed operator, address indexed to, uint256 amount);

    /// @notice 收益权份额被注销时触发。Emitted when rental-income rights are cancelled.
    event TokensBurned(address indexed operator, address indexed from, uint256 amount);

    /// @notice 资产证明信息变更时触发。Emitted when the on-chain asset proof is replaced.
    event AssetDocumentUpdated(
        address indexed operator, string previousDocument, string newDocument
    );

    /**
     * @param initialOwner 授权账户: 可发行、强制注销、更新资产证明、暂停合约。
     * @param initialAssetDocument 初始资产证明信息 (非空)。
     */
    constructor(address initialOwner, string memory initialAssetDocument)
        ERC20("Xinghai Plaza Rental Income Right", "XRIR")
        Ownable(initialOwner)
    {
        if (bytes(initialAssetDocument).length == 0) revert EmptyAssetDocument();
        _assetDocument = initialAssetDocument;
        assetDocumentUpdatedAt = block.timestamp;
    }

    // ---------------------------------------------------------------------
    // 发行 / Issuance
    // ---------------------------------------------------------------------

    /**
     * @notice 发行新的租金收益权份额。Issues new rental-income rights to `to`.
     * @dev 仅授权账户 (owner) 可调用; 总供应量不得超过 MAX_SUPPLY。
     *      `to == address(0)` 由 ERC20._mint 直接回滚 (ERC20InvalidReceiver)。
     */
    function mint(address to, uint256 amount) external onlyOwner whenNotPaused {
        uint256 newTotalSupply = totalSupply() + amount;
        if (newTotalSupply > MAX_SUPPLY) revert MaxSupplyExceeded(MAX_SUPPLY, newTotalSupply);
        _mint(to, amount);
        emit TokensMinted(msg.sender, to, amount);
    }

    // ---------------------------------------------------------------------
    // 销毁 / Redemption
    // ---------------------------------------------------------------------

    /**
     * @notice 持有人自行注销自己持有的收益权份额 (到期兑付 / 主动赎回)。
     *         Holder cancels its own rights after redemption.
     * @dev 继承自 ERC20Burnable; 因 _update 带 whenNotPaused, 暂停期间销毁同样被禁用。
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        emit TokensBurned(msg.sender, msg.sender, amount);
    }

    /**
     * @notice 授权账户强制注销指定账户的收益权份额 (合规 / 到期强制赎回)。
     *         Compliance-driven forced cancellation of expired rights.
     */
    function forceBurn(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
        emit TokensBurned(msg.sender, account, amount);
    }

    // ---------------------------------------------------------------------
    // 资产证明 / Asset proof
    // ---------------------------------------------------------------------

    /**
     * @notice 更新链上资产证明信息。Updates the on-chain asset proof.
     * @dev 仅授权账户可调用。真实 RWA 项目中该字段通常指向 IPFS 上的
     *      租赁合同摘要、资产评估报告哈希与线下登记编号; 它本身不能证明
     *      链下资产真实存在, 只提供可追溯的存证入口。
     */
    function updateAssetDocument(string calldata newDocument) external onlyOwner {
        if (bytes(newDocument).length == 0) revert EmptyAssetDocument();
        string memory previousDocument = _assetDocument;
        _assetDocument = newDocument;
        assetDocumentUpdatedAt = block.timestamp;
        emit AssetDocumentUpdated(msg.sender, previousDocument, newDocument);
    }

    /// @notice 查询当前资产证明信息。Returns the current asset proof document.
    function assetDocument() external view returns (string memory) {
        return _assetDocument;
    }

    // ---------------------------------------------------------------------
    // 风险控制 / Circuit breaker
    // ---------------------------------------------------------------------

    /// @notice 暂停发行、转账与销毁 (风险事件应急)。Pauses mint/transfer/burn.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice 恢复合约运行。Resumes normal operation.
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 所有余额变动 (mint / burn / transfer) 的唯一入口。
     *      继承 Pausable 后, 暂停时链上权益流转整体冻结。
     */
    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        super._update(from, to, value);
    }
}
