// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title PropertyRentalToken (PRRT) — 房地产租金收益权 RWA Token
/// @notice
///  本合约将一处商业地产的租金收益权映射为链上 ERC-20 Token。
///  每个 PRRT 代表对应物业年度净租金收益的 1/10,000 份额。
///
///  业务场景：
///  - Mint（发行）：资产管理方将新的租赁收益权打包上链，向投资者发行 Token
///  - Burn（销毁）：投资者赎回收益权或对应物业被出售时，销毁对应 Token
///  - Transfer（转让）：持有者可在二级市场转让租金收益权
///
///  资产证明（assetDocument）：
///  存储链下资产证明文件的 IPFS URI 或文档哈希，在真实 RWA 项目中可指向：
///  - 房产证/不动产权证书扫描件
///  - 租赁合同
///  - 第三方评估报告
///  - 租金流水记录
///
///  权限设计：
///  - DEFAULT_ADMIN_ROLE：合约所有者，可管理角色和更新资产证明
///  - MINTER_ROLE：授权发行方，可铸造新 Token
///
/// @dev 基于 OpenZeppelin ERC20 + AccessControl，仅供技术学习与业务模拟。
contract PropertyRentalToken is ERC20, AccessControl {
    // ============ 角色定义 ============

    /// @notice 铸造者角色 — 只有持有该角色的账户可以发行（mint）Token
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ============ 资产证明 ============

    /// @notice 资产证明文档 URI / IPFS 链接 / 哈希
    ///         记录对应物业的产权证明、租赁合同、评估报告等信息
    string private _assetDocument;

    // ============ 事件 ============

    /// @notice 发行 Token 时触发
    event TokensMinted(address indexed to, uint256 amount);

    /// @notice 销毁 Token 时触发
    event TokensBurned(address indexed from, uint256 amount);

    /// @notice 资产证明信息更新时触发
    event AssetDocumentUpdated(
        address indexed updater,
        string oldDocument,
        string newDocument
    );

    // ============ 构造函数 ============

    /// @param admin   合约管理员（DEFAULT_ADMIN_ROLE 持有者）
    /// @param minter  初始 MINTER_ROLE 持有者
    /// @param initialAssetDocument 初始资产证明文档 URI
    constructor(
        address admin,
        address minter,
        string memory initialAssetDocument
    ) ERC20("Property Rental Rights Token", "PRRT") {
        require(admin != address(0), "PRRT: zero admin");
        require(minter != address(0), "PRRT: zero minter");

        // 授予 admin DEFAULT_ADMIN_ROLE
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        // 授予 minter MINTER_ROLE
        _grantRole(MINTER_ROLE, minter);

        _assetDocument = initialAssetDocument;
    }

    // ============ Token 发行 ============

    /// @notice 发行（铸造）Token — 仅 MINTER_ROLE 可调用
    /// @param to     接收地址
    /// @param amount 发行数量
    ///
    /// 业务含义：资产管理方将新的租金收益权打包上链，
    ///          向投资者（to）发行对应份额的 Token。
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "PRRT: mint to zero address");
        require(amount > 0, "PRRT: mint zero amount");

        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    // ============ Token 销毁 ============

    /// @notice 销毁自己持有的 Token
    /// @param amount 销毁数量
    ///
    /// 业务含义：持有者赎回收益权（退出投资），
    ///          或对应物业被出售后回购销毁 Token。
    function burn(uint256 amount) external {
        require(amount > 0, "PRRT: burn zero amount");
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }

    // ============ 资产证明管理 ============

    /// @notice 更新资产证明文档 URI — 仅 DEFAULT_ADMIN_ROLE 可调用
    /// @param document 新的资产证明文档 URI / IPFS 链接 / 哈希
    ///
    /// 业务含义：当物业信息变更（如续租、重新评估、新增物业）时，
    ///          资产管理方更新链上资产证明引用，保持链上记录与链下资产一致。
    function updateAssetDocument(
        string calldata document
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory oldDoc = _assetDocument;
        _assetDocument = document;
        emit AssetDocumentUpdated(msg.sender, oldDoc, document);
    }

    /// @notice 查询当前资产证明文档 URI
    /// @return 资产证明文档字符串
    function assetDocument() external view returns (string memory) {
        return _assetDocument;
    }

    // ============ 权限查询辅助 ============

    /// @notice 检查地址是否拥有 MINTER_ROLE
    function isMinter(address account) external view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }

    /// @notice 检查地址是否为管理员
    function isAdmin(address account) external view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, account);
    }
}