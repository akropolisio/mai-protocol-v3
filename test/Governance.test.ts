const { ethers } = require("hardhat");
const { expect } = require("chai");

import {
    toWei,
    toBytes32,
    getAccounts,
    createContract,
    createFactory,
} from '../scripts/utils';

describe('Governance', () => {
    let accounts;
    let user0;
    let user1;
    let user2;
    let governance;
    let TestGovernance;
    let creator;

    before(async () => {
        accounts = await getAccounts();
        user0 = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];

        const AMMModule = await createContract("AMMModule");
        const CollateralModule = await createContract("CollateralModule")
        const PerpetualModule = await createContract("PerpetualModule");
        const LiquidityPoolModule = await createContract("LiquidityPoolModule", [], { CollateralModule, AMMModule, PerpetualModule });

        TestGovernance = await createFactory(
            "TestGovernance",
            { PerpetualModule, LiquidityPoolModule }
        );
    })

    beforeEach(async () => {
        governance = await TestGovernance.deploy();
        await governance.initializeParameters(
            "0x0000000000000000000000000000000000000000",
            [toWei("0.1"), toWei("0.05"), toWei("0.001"), toWei("0.001"), toWei("0.2"), toWei("0.02"), toWei("0.00000002"), toWei("0.5"), toWei("1")],
            [toWei("0.01"), toWei("0.1"), toWei("0.06"), toWei("0.1"), toWei("5"), toWei("0.2"), toWei("0.04"), toWei("1")],
            [toWei("0.01"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0")],
            [toWei("0.9"), toWei("1"), toWei("1"), toWei("1"), toWei("10"), toWei("1"), toWei("1"), toWei("1")],
        )
        creator = await createContract("TestTracer");
        await governance.setCreator(creator.address);
    })

    it('checkIn', async () => {
        expect(await governance.operatorExpiration()).to.equal(0);
        expect(await governance.getOperator()).to.equal("0x0000000000000000000000000000000000000000")
        await expect(governance.checkIn()).to.be.revertedWith("only operator is allowed")

        await governance.setOperatorNoAuth(user0.address);
        const tx = await governance.checkIn();
        const block = await ethers.provider.getBlock(tx.blockNumber)
        // var now = Math.floor(Date.now() / 1000);
        expect(await governance.operatorExpiration()).to.equal(block.timestamp + 86400 * 10);
        expect(await governance.getOperator()).to.equal(user0.address);
        await governance.setOperatorExpiration(block.timestamp);
        expect(await governance.getOperator()).to.equal("0x0000000000000000000000000000000000000000")
    })


    it('operatorship', async () => {
        await expect(governance.transferOperator(user1.address)).to.be.revertedWith("can only be initiated by governor")

        await governance.setOperatorNoAuth(user0.address);
        await creator.registerLiquidityPool(governance.address, user0.address);

        await governance.transferOperator(user1.address);
        await expect(governance.connect(user1).transferOperator(user0.address)).to.be.revertedWith("can only be initiated by operator")

        await governance.connect(user1).claimOperator();
        let pools = await creator.listLiquidityPoolOwnedBy(user0.address, 0, 1);
        await expect(pools.length).to.equal(0);
        pools = await creator.listLiquidityPoolOwnedBy(user1.address, 0, 1);
        await expect(pools[0]).to.equal(governance.address);
        await expect(governance.connect(user0).transferOperator(user1.address)).to.be.revertedWith("can only be initiated by operator")

        await governance.connect(user1).transferOperator(user0.address);
        await governance.connect(user1).transferOperator(user2.address);
        await expect(governance.connect(user0).claimOperator()).to.be.revertedWith("caller is not qualified")
        await governance.connect(user2).claimOperator();

        await expect(governance.connect(user1).revokeOperator()).to.be.revertedWith("only operator is allowed")
        await governance.connect(user2).revokeOperator();
        await expect(governance.connect(user1).transferOperator(user0.address)).to.be.revertedWith("can only be initiated by governor")
        pools = await creator.listLiquidityPoolOwnedBy(user2.address, 0, 1);
        await expect(pools.length).to.equal(0);

        await governance.setGovernor(user2.address);
        await governance.connect(user2).transferOperator(user0.address);
        await governance.connect(user0).claimOperator();
    });

    it('forceToSetEmergencyState', async () => {
        const oracle = await createContract("OracleWrapper", ["A", "B"])
        var now = Math.floor(Date.now() / 1000);
        await oracle.setIndexPrice(toWei("1000"), now)
        await oracle.setMarkPrice(toWei("1000"), now)
        await governance.setGovernor(user0.address);
        await governance.setOracle(0, oracle.address);

        await expect(governance.connect(user1).forceToSetEmergencyState(0, toWei("771"))).to.be.revertedWith("only governor is allowed")

        const tx = await governance.forceToSetEmergencyState(0, toWei("771"));
        const block = await ethers.provider.getBlock(tx.blockNumber)

        const result = await governance.settlementPrice(0)
        expect(result[0]).to.equal(toWei("771"));
        expect(result[1]).to.equal(block.timestamp);
        expect(await governance.state(0)).to.equal(3)
    })

    it('setOracle', async () => {
        const oracle = await createContract("OracleWrapper", ["A", "B"])
        await governance.setGovernor(user0.address);

        expect(await governance.oracle(0)).to.equal("0x0000000000000000000000000000000000000000")
        await governance.setOracle(0, oracle.address);
        expect(await governance.oracle(0)).to.equal(oracle.address)

        await expect(governance.setOracle(0, "0x0000000000000000000000000000000000000000")).to.be.revertedWith("invalid oracle address")
        await expect(governance.setOracle(0, oracle.address)).to.be.revertedWith("oracle not changed")
        await expect(governance.setOracle(0, user0.address)).to.be.revertedWith("oracle must be contract")
    })


    it('setEmergencyState - 1', async () => {
        const oracle = await createContract("OracleWrapper", ["A", "B"])
        var now = Math.floor(Date.now() / 1000);
        await oracle.setIndexPrice(toWei("1000"), now)
        await oracle.setMarkPrice(toWei("1000"), now)

        await governance.setGovernor(user0.address);
        await governance.setOracle(0, oracle.address);

        await expect(governance.setEmergencyState(0)).to.be.revertedWith("prerequisite not met")

        await oracle.setTerminated(true);
        await governance.setEmergencyState(0);

        const result = await governance.settlementPrice(0)
        expect(result[0]).to.equal(toWei("1000"));
        expect(result[1]).to.equal(now);
        expect(await governance.state(0)).to.equal(3)
    })

    it('setEmergencyState - 2', async () => {
        // const ctk = await createContract("CustomERC20", ["collateral", "CTK", 18]);
        const oracle = await createContract("OracleWrapper", ["A", "B"])
        var now = Math.floor(Date.now() / 1000);
        await oracle.setIndexPrice(toWei("1000"), now)
        await oracle.setMarkPrice(toWei("1000"), now)

        await governance.setGovernor(user0.address);
        await governance.setOracle(0, oracle.address);
        // await governance.setCollateralToken(ctk.address, 18);
        await governance.setTotalCollateral(0, toWei("1000"));

        await expect(governance.setEmergencyState(0)).to.be.revertedWith("prerequisite not met")
        await governance.setMarginAccount(0, governance.address, toWei("-1000"), toWei("1"));
        await governance.setEmergencyState(0);
        const result = await governance.settlementPrice(0)
        expect(result[0]).to.equal(toWei("1000"));
        expect(result[1]).to.equal(now);
        expect(await governance.state(0)).to.equal(3)
    })

    it('setPerpetualBaseParameter', async () => {
        await governance.setGovernor(user0.address);
        expect(await governance.initialMarginRate(0)).to.equal(toWei("0.1"));

        await governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0.025"),
            toWei("0.002"),
            toWei("0.002"),
            toWei("0.5"),
            toWei("0.01"),
            toWei("1"),
            toWei("0.2"),
            toWei("1"),
        ]);

        expect(await governance.initialMarginRate(0)).to.equal(toWei("0.05"));
        expect(await governance.maintenanceMarginRate(0)).to.equal(toWei("0.025"));
        expect(await governance.operatorFeeRate(0)).to.equal(toWei("0.002"));
        expect(await governance.lpFeeRate(0)).to.equal(toWei("0.002"));
        expect(await governance.referralRebateRate(0)).to.equal(toWei("0.5"));
        expect(await governance.liquidationPenaltyRate(0)).to.equal(toWei("0.01"));
        expect(await governance.keeperGasReward(0)).to.equal(toWei("1"));
        expect(await governance.insuranceFundRate(0)).to.equal(toWei("0.2"));
    })

    it('setPerpetualBaseParameter - exception', async () => {
        await governance.setGovernor(user1.address);
        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0.025"),
            toWei("0.002"),
            toWei("0.002"),
            toWei("0.5"),
            toWei("0.01"),
            toWei("1"),
            toWei("0.2"),
            toWei("1"),
        ])).to.be.revertedWith("only governor is allowed");

        await governance.setGovernor(user0.address);
        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.11"),
            toWei("0.05"),
            toWei("0.001"),
            toWei("0.001"),
            toWei("0.2"),
            toWei("0.02"),
            toWei("0.00000002"),
            toWei("0.5"),
            toWei("1"),
        ])).to.be.revertedWith("cannot increase initialMarginRate");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0.051"),
            toWei("0.001"),
            toWei("0.001"),
            toWei("0.2"),
            toWei("0.02"),
            toWei("0.00000002"),
            toWei("0.5"),
            toWei("1"),
        ])).to.be.revertedWith("cannot increase maintenanceMarginRate");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.04"),
            toWei("0.05"),
            toWei("0.001"),
            toWei("0.001"),
            toWei("0.2"),
            toWei("0.02"),
            toWei("0.00000002"),
            toWei("0.5"),
            toWei("1"),
        ])).to.be.revertedWith("maintenanceMarginRate > initialMarginRate");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0"),
            toWei("0.05"),
            toWei("0.001"),
            toWei("0.001"),
            toWei("0.2"),
            toWei("0.02"),
            toWei("0.00000002"),
            toWei("0.5"),
            toWei("1"),
        ])).to.be.revertedWith("initialMarginRate <= 0");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("-0.01"),
            toWei("0.05"),
            toWei("0.001"),
            toWei("0.001"),
            toWei("0.2"),
            toWei("0.02"),
            toWei("0.00000002"),
            toWei("0.5"),
            toWei("1"),
        ])).to.be.revertedWith("initialMarginRate <= 0");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0"),
            toWei("0.001"),
            toWei("0.001"),
            toWei("0.2"),
            toWei("0.02"),
            toWei("0.00000002"),
            toWei("0.5"),
            toWei("1"),
        ])).to.be.revertedWith("maintenanceMarginRate <= 0");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("-0.05"),
            toWei("0.001"),
            toWei("0.001"),
            toWei("0.2"),
            toWei("0.02"),
            toWei("0.00000002"),
            toWei("0.5"),
            toWei("1"),
        ])).to.be.revertedWith("maintenanceMarginRate <= 0");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0.025"),
            toWei("-0.01"),
            toWei("0.001"),
            toWei("0.2"),
            toWei("0.02"),
            toWei("0.00000002"),
            toWei("0.5"),
            toWei("1"),
        ])).to.be.revertedWith("operatorFeeRate < 0");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0.025"),
            toWei("0.011"),
            toWei("0.001"),
            toWei("0.2"),
            toWei("0.02"),
            toWei("0.00000002"),
            toWei("0.5"),
            toWei("1"),
        ])).to.be.revertedWith("operatorFeeRate > 1%");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0.025"),
            toWei("0.01"),
            toWei("-0.01"),
            toWei("0.2"),
            toWei("0.02"),
            toWei("0.00000002"),
            toWei("0.5"),
            toWei("1"),
        ])).to.be.revertedWith("lpFeeRate < 0");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0.025"),
            toWei("0.01"),
            toWei("0.011"),
            toWei("0.2"),
            toWei("0.02"),
            toWei("0.00000002"),
            toWei("0.5"),
            toWei("1"),
        ])).to.be.revertedWith("lpFeeRate > 1%");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0.025"),
            toWei("0.002"),
            toWei("0.002"),
            toWei("0.5"),
            toWei("-0.01"),
            toWei("1"),
            toWei("0.2"),
            toWei("1"),
        ])).to.be.revertedWith("liquidationPenaltyRate < 0");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0.025"),
            toWei("0.002"),
            toWei("0.002"),
            toWei("0.5"),
            toWei("0.026"),
            toWei("1"),
            toWei("0.2"),
            toWei("1"),
        ])).to.be.revertedWith("liquidationPenaltyRate > maintenanceMarginRate");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0.025"),
            toWei("0.002"),
            toWei("0.002"),
            toWei("0.5"),
            toWei("0.01"),
            toWei("-1"),
            toWei("0.2"),
            toWei("1"),
        ])).to.be.revertedWith("keeperGasReward < 0");

        await expect(governance.setPerpetualBaseParameter(0, [
            toWei("0.05"),
            toWei("0.025"),
            toWei("0.002"),
            toWei("0.002"),
            toWei("0.5"),
            toWei("0.01"),
            toWei("1"),
            toWei("-0.2"),
            toWei("1"),
        ])).to.be.revertedWith("insuranceFundRate < 0");
    })

    it('updatePerpetualRiskParameter', async () => {
        await governance.setOperatorNoAuth(user0.address);
        await governance.updatePerpetualRiskParameter(0, [
            toWei("0.5"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ])
        expect(await governance.halfSpread(0)).to.equal(toWei("0.5"));
        expect(await governance.openSlippageFactor(0)).to.equal(toWei("0.6"));
        expect(await governance.closeSlippageFactor(0)).to.equal(toWei("0.45"));
        expect(await governance.fundingRateLimit(0)).to.equal(toWei("0.1"));
        expect(await governance.ammMaxLeverage(0)).to.equal(toWei("5"));
        expect(await governance.maxClosePriceDiscount(0)).to.equal(toWei("0.05"));
        expect(await governance.fundingRateFactor(0)).to.equal(toWei("0.04"));
    })

    it('setPerpetualRiskParameter', async () => {
        await governance.setGovernor(user0.address);
        await governance.setPerpetualRiskParameter(0,
            [toWei("0.05"), toWei("0.1"), toWei("0.06"), toWei("0.1"), toWei("5"), toWei("0.2"), toWei("0.04"), toWei("1")],
            [toWei("0.01"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0")],
            [toWei("0.9"), toWei("1"), toWei("1"), toWei("1"), toWei("10"), toWei("1"), toWei("1"), toWei("1")],
        );
        expect(await governance.halfSpread(0)).to.equal(toWei("0.05"));

        await expect(governance.setPerpetualRiskParameter(0,
            [toWei("0.99"), toWei("0.1"), toWei("0.06"), toWei("0.1"), toWei("5"), toWei("0.2"), toWei("0.04"), toWei("1")],
            [toWei("0.01"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0")],
            [toWei("0.9"), toWei("1"), toWei("1"), toWei("1"), toWei("10"), toWei("1"), toWei("1"), toWei("1")],
        )).to.be.revertedWith("value out of range");
        await expect(governance.setPerpetualRiskParameter(0,
            [toWei("0.009"), toWei("0.1"), toWei("0.06"), toWei("0.1"), toWei("5"), toWei("0.2"), toWei("0.04"), toWei("1")],
            [toWei("0.01"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0")],
            [toWei("0.9"), toWei("1"), toWei("1"), toWei("1"), toWei("10"), toWei("1"), toWei("1"), toWei("1")],
        )).to.be.revertedWith("value out of range");
    })

    it('updatePerpetualRiskParameter - exception', async () => {

        await governance.setOperatorNoAuth(user0.address);
        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("-1"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("halfSpread < 0");
        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("1"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("halfSpread >= 100%");

        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("0.5"),
            toWei("-0.1"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("openSlippageFactor < 0");

        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("0.5"),
            toWei("0.6"),
            toWei("-0.1"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("closeSlippageFactor < 0");

        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("0.5"),
            toWei("0.6"),
            toWei("0.8"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("closeSlippageFactor > openSlippageFactor");

        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("0.5"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("-0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("fundingRateLimit < 0");
        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("0.5"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("-0.04"),
            toWei("1")
        ])).to.be.revertedWith("fundingRateFactor < 0");
        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("0.5"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("-5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("ammMaxLeverage < 0");
        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("0.5"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("-0.05"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("maxClosePriceDiscount < 0");
        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("0.5"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("1"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("maxClosePriceDiscount >= 100%");
    })

    it('updatePerpetualRiskParameter', async () => {
        await governance.setOperatorNoAuth(user1.address);
        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("0.5"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("operator is allowed");

        await governance.setOperatorNoAuth(user0.address);
        await governance.updatePerpetualRiskParameter(0, [
            toWei("0.1"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ]);
        await governance.updatePerpetualRiskParameter(0, [
            toWei("0.9"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ]);
        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("0.99"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("value out of range");
        await expect(governance.updatePerpetualRiskParameter(0, [
            toWei("0.001"),
            toWei("0.6"),
            toWei("0.45"),
            toWei("0.1"),
            toWei("5"),
            toWei("0.05"),
            toWei("0.04"),
            toWei("1")
        ])).to.be.revertedWith("value out of range");
    })

    it("setLiquidityPoolParameter", async () => {
        await governance.setGovernor(user1.address);
        await governance.connect(user1).setLiquidityPoolParameter([1, 1000]);

        expect(await governance.isFastCreationEnabled()).to.be.true;
        await expect(governance.connect(user1).setLiquidityPoolParameter([0, -1])).to.be.revertedWith("insuranceFundCap < 0");
        await governance.connect(user1).setLiquidityPoolParameter([0, 1000]);
        expect(await governance.isFastCreationEnabled()).to.be.false;

        await expect(governance.setLiquidityPoolParameter([1, 1000])).to.be.revertedWith("only governor is allowed");
    })
})
