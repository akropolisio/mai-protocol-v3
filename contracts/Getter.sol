// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/SafeCastUpgradeable.sol";

import "./module/MarginAccountModule.sol";
import "./module/PerpetualModule.sol";

import "./Type.sol";
import "./Storage.sol";

contract Getter is Storage {
    using SafeMathUpgradeable for uint256;
    using SafeCastUpgradeable for uint256;
    using CollateralModule for address;
    using MarginAccountModule for PerpetualStorage;
    using PerpetualModule for PerpetualStorage;

    function getLiquidityPoolInfo()
        public
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
        )
    {
        addresses = [
            _liquidityPool.factory,
            _liquidityPool.operator,
            _liquidityPool.collateralToken,
            _liquidityPool.vault,
            _liquidityPool.governor,
            _liquidityPool.shareToken
        ];
        nums = [_liquidityPool.vaultFeeRate, _liquidityPool.poolCash];
        perpetualCount = _liquidityPool.perpetuals.length;
        fundingTime = _liquidityPool.fundingTime;
    }

    function getPerpetualInfo(uint256 perpetualIndex)
        public
        syncState
        onlyExistedPerpetual(perpetualIndex)
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
        )
    {
        PerpetualStorage storage perpetual = _liquidityPool.perpetuals[perpetualIndex];
        state = perpetual.state;
        oracle = perpetual.oracle;
        nums = [
            perpetual.totalCollateral,
            perpetual.getMarkPrice(),
            perpetual.getIndexPrice(),
            perpetual.unitAccumulativeFunding,
            perpetual.initialMarginRate,
            perpetual.maintenanceMarginRate,
            perpetual.operatorFeeRate,
            perpetual.lpFeeRate,
            perpetual.referrerRebateRate,
            perpetual.liquidationPenaltyRate,
            perpetual.keeperGasReward,
            perpetual.insuranceFundRate,
            perpetual.insuranceFundCap,
            perpetual.insuranceFund,
            perpetual.donatedInsuranceFund,
            perpetual.halfSpread.value,
            perpetual.openSlippageFactor.value,
            perpetual.closeSlippageFactor.value,
            perpetual.fundingRateLimit.value,
            perpetual.ammMaxLeverage.value
        ];
    }

    bytes[50] private __gap;
}
