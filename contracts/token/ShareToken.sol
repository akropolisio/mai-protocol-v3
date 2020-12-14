// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/GSN/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

contract ShareToken is
    Initializable,
    ContextUpgradeable,
    AccessControlUpgradeable,
    ERC20Upgradeable
{
    function initialize(
        string memory name,
        string memory symbol,
        address minter
    ) public virtual initializer {
        __ShareToken_init(name, symbol, minter);
    }

    function __ShareToken_init(
        string memory name,
        string memory symbol,
        address minter
    ) internal initializer {
        __Context_init_unchained();
        __AccessControl_init_unchained();
        __ERC20_init_unchained(name, symbol);
        __ShareToken_init_unchained(minter);
    }

    function __ShareToken_init_unchained(address minter) internal initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, minter);
    }

    function mint(address account, uint256 amount) public virtual {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "ERC20PresetMinterPauser: must have minter role to mint"
        );
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public virtual {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "ERC20PresetMinterPauser: must have minter role to mint"
        );
        _burn(account, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20Upgradeable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    uint256[50] private __gap;
}
