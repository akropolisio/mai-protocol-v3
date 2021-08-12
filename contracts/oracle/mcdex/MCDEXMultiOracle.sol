// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "../../interface/IOracle.sol";

contract MCDEXMultiOracle is AccessControl {
    struct Single {
        string collateral;
        string underlyingAsset;
        int256 price;
        uint256 timestamp;
        bool isMarketClosed;
        bool isTerminated;
    }

    mapping(uint256 => Single) markets;
    bool isAllTerminated;

    event SetMarket(uint256 indexed index, string collateral, string underlyingAsset);
    event SetPrice(uint256 indexed index, int256 price, uint256 timestamp);
    event SetMarketClosed(uint256 indexed index, bool isMarketClosed);
    event SetTerminated(uint256 indexed index);
    event SetAllTerminated();

    /**
     * @dev SET_PRICE_ROLE can update prices.
     */
    bytes32 public constant SET_PRICE_ROLE = keccak256("SET_PRICE_ROLE");

    /**
     * @dev CLOSE_MARKET_ROLE can mark the market as closed if it is not in regular
     *      trading period.
     */
    bytes32 public constant CLOSE_MARKET_ROLE = keccak256("CLOSE_MARKET_ROLE");

    /**
     * @dev TERMINATE_ROLE can shutdown the oracle service and never online again.
     */
    bytes32 public constant TERMINATE_ROLE = keccak256("TERMINATE_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(SET_PRICE_ROLE, _msgSender());
        _setupRole(CLOSE_MARKET_ROLE, _msgSender());
        _setupRole(TERMINATE_ROLE, _msgSender());
    }

    function collateral(uint256 index) external view returns (string memory) {
        Single storage m = markets[index];
        return m.collateral;
    }

    function underlyingAsset(uint256 index) external view returns (string memory) {
        Single storage m = markets[index];
        return m.underlyingAsset;
    }

    function priceTWAPLong(uint256 index)
        external
        view
        returns (int256 newPrice, uint256 newTimestamp)
    {
        Single storage m = markets[index];
        return (m.price, m.timestamp);
    }

    function priceTWAPShort(uint256 index)
        external
        view
        returns (int256 newPrice, uint256 newTimestamp)
    {
        Single storage m = markets[index];
        return (m.price, m.timestamp);
    }

    function isMarketClosed(uint256 index) external view returns (bool) {
        Single storage m = markets[index];
        return m.isMarketClosed;
    }

    function isTerminated(uint256 index) external view returns (bool) {
        if (isAllTerminated) {
            return true;
        }
        Single storage m = markets[index];
        return m.isTerminated;
    }

    function setMarket(
        uint256 index,
        string memory collateral_,
        string memory underlyingAsset_
    ) external {
        require(!isAllTerminated, "all terminated");
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "admin_role");
        Single storage m = markets[index];
        m.collateral = collateral_;
        m.underlyingAsset = underlyingAsset_;
        emit SetMarket(index, collateral_, underlyingAsset_);
    }

    function setPrice(
        uint256 index,
        int256 price,
        uint256 timestamp
    ) external {
        require(!isAllTerminated, "all terminated");
        require(hasRole(SET_PRICE_ROLE, _msgSender()), "set_price_role");
        _setPrice(index, price, timestamp);
    }

    struct Prices {
        uint256 index;
        int256 price;
    }

    function setPrices(Prices[] memory prices, uint256 timestamp) external {
        require(!isAllTerminated, "all terminated");
        require(hasRole(SET_PRICE_ROLE, _msgSender()), "set_price_role");
        for (uint256 i = 0; i < prices.length; i++) {
            _setPrice(prices[i].index, prices[i].price, timestamp);
        }
    }

    function setMarketClosed(uint256 index, bool isMarketClosed_) external {
        require(!isAllTerminated, "all terminated");
        require(hasRole(CLOSE_MARKET_ROLE, _msgSender()), "close_market_role");
        Single storage m = markets[index];
        m.isMarketClosed = isMarketClosed_;
        emit SetMarketClosed(index, isMarketClosed_);
    }

    function setTerminated(uint256 index) external {
        require(!isAllTerminated, "all terminated");
        require(hasRole(TERMINATE_ROLE, _msgSender()), "terminate_role");
        Single storage m = markets[index];
        require(!m.isTerminated, "terminated");
        m.isTerminated = true;
        emit SetTerminated(index);
    }

    function setAllTerminated() external {
        require(!isAllTerminated, "all terminated");
        require(hasRole(TERMINATE_ROLE, _msgSender()), "terminate_role");
        isAllTerminated = true;
        emit SetAllTerminated();
    }

    function _setPrice(
        uint256 index,
        int256 price,
        uint256 timestamp
    ) private {
        Single storage m = markets[index];
        require(!m.isTerminated, "terminated");
        m.price = price;
        m.timestamp = timestamp;
        emit SetPrice(index, price, timestamp);
    }
}

// note: wrapped by TransparentUpgradeableProxy
contract MCDEXSingleOracle is Initializable, IOracle {
    MCDEXMultiOracle private _multiOracle;
    uint256 private _index;

    function initialize(MCDEXMultiOracle multiOracle_, uint256 index_) external initializer {
        _multiOracle = multiOracle_;
        _index = index_;
    }

    function collateral() external view override returns (string memory) {
        return _multiOracle.collateral(_index);
    }

    function underlyingAsset() external view override returns (string memory) {
        return _multiOracle.underlyingAsset(_index);
    }

    function priceTWAPLong()
        external
        view
        override
        returns (int256 newPrice, uint256 newTimestamp)
    {
        return _multiOracle.priceTWAPLong(_index);
    }

    function priceTWAPShort()
        external
        view
        override
        returns (int256 newPrice, uint256 newTimestamp)
    {
        return _multiOracle.priceTWAPShort(_index);
    }

    function isMarketClosed() external view override returns (bool) {
        return _multiOracle.isMarketClosed(_index);
    }

    function isTerminated() external view override returns (bool) {
        return _multiOracle.isTerminated(_index);
    }
}
