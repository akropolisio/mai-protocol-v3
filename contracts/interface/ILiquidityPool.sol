// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "../Type.sol";

interface ILiquidityPool {
    function getLiquidityPoolInfo()
        external
        view
        returns (
            // [0] factory,
            // [1] operator,
            // [2] collateral,
            // [3] vault,
            // [4] governor,
            // [5] shareToken,
            address[6] memory addresses,
            // [0] vaultFeeRate,
            // [3] poolCash,
            int256[2] memory nums,
            uint256 perpetualCount,
            uint256 fundingTime
        );

    function getPerpetualInfo(uint256 perpetualIndex)
        external
        returns (
            PerpetualState state,
            address oracle,
            // [0] totalCollateral
            // [1] markPrice,
            // [2] indexPrice,
            // [3] unitAccumulativeFunding,
            // [4] initialMarginRate,
            // [5] maintenanceMarginRate,
            // [6] operatorFeeRate,
            // [7] lpFeeRate,
            // [8] referrerRebateRate,
            // [9] liquidationPenaltyRate,
            // [10] keeperGasReward,
            // [11] insuranceFundRate,
            // [12] insuranceFundCap,
            // [13] insuranceFund,
            // [14] donatedInsuranceFund,
            // [15] halfSpread,
            // [16] openSlippageFactor,
            // [17] closeSlippageFactor,
            // [18] fundingRateLimit,
            // [19] ammMaxLeverage
            int256[20] memory nums
        );

    function initialize(
        address operator,
        address collateral,
        address governor,
        address shareToken,
        bool isFastCreationEnabled
    ) external;

    function trade(
        uint256 perpetualIndex,
        address trader,
        int256 amount,
        int256 limitPrice,
        uint256 deadline,
        address referrer,
        bool isCloseOnly
    ) external;

    function brokerTrade(
        Order memory order,
        int256 amount,
        bytes memory signature,
        uint8 signType
    ) external;

    function activeAccountCount(uint256 perpetualIndex) external view returns (uint256);

    function listActiveAccounts(
        uint256 perpetualIndex,
        uint256 start,
        uint256 count
    ) external view returns (address[] memory result);

    function getMarginAccount(uint256 perpetualIndex, address trader)
        external
        view
        returns (int256 cash, int256 position);
}
