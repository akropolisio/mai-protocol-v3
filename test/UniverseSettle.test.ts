const { ethers } = require("hardhat");
const { expect } = require("chai");
import { BigNumber as BN } from "ethers";
import { toWei, fromWei, createFactory, createContract, createLiquidityPoolFactory } from "../scripts/utils";

describe("universeSettle", () => {

  it("main", async () => {
    // users
    const accounts = await ethers.getSigners();
    const user0 = accounts[0];
    const user1 = accounts[1];
    const user2 = accounts[2];
    const user3 = accounts[3];
    const vault = accounts[9];
    const none = "0x0000000000000000000000000000000000000000";
    const LiquidityPoolFactory = await createLiquidityPoolFactory();

    // create components
    var symbol = await createContract("SymbolService");
    await symbol.initialize(10000);
    var ctk = await createContract("CustomERC20", ["collateral", "CTK", 18]);
    var perpTemplate = await LiquidityPoolFactory.deploy();
    var govTemplate = await createContract("TestLpGovernor");
    var poolCreator = await createContract("PoolCreator");
    await poolCreator.initialize(symbol.address, vault.address, toWei("0.001"));
    await poolCreator.addVersion(perpTemplate.address, govTemplate.address, 0, "initial version");
    await symbol.addWhitelistedFactory(poolCreator.address);

    const { liquidityPool, governor } = await poolCreator.callStatic.createLiquidityPool(
      ctk.address,
      18,
      998,
      ethers.utils.defaultAbiCoder.encode(["bool", "int256"], [false, toWei("1000000")])
    );
    await poolCreator.createLiquidityPool(ctk.address, 18, 998, ethers.utils.defaultAbiCoder.encode(["bool", "int256"], [false, toWei("1000000")]));
    const perp = await LiquidityPoolFactory.attach(liquidityPool);

    // oracle
    let oracle1 = await createContract("OracleAdaptor", ["USD", "ETH"]);
    let oracle2 = await createContract("OracleAdaptor", ["USD", "ETH"]);
    let oracle3 = await createContract("OracleAdaptor", ["USD", "ETH"]);
    let oracle4 = await createContract("OracleAdaptor", ["USD", "ETH"]);
    let updatePrice = async (price1, price2, price3, price4) => {
      let now = Math.floor(Date.now() / 1000);
      await oracle1.setMarkPrice(price1, now);
      await oracle1.setIndexPrice(price1, now);
      await oracle2.setMarkPrice(price2, now);
      await oracle2.setIndexPrice(price2, now);
      await oracle3.setMarkPrice(price3, now);
      await oracle3.setIndexPrice(price3, now);
      await oracle4.setMarkPrice(price4, now);
      await oracle4.setIndexPrice(price4, now);
    };
    await updatePrice(toWei("500"), toWei("500"), toWei("500"), toWei("500"));

    await perp.createPerpetual(
      oracle1.address,
      // imr          mmr           operatorfr      lpfr            rebate        penalty        keeper               insur         oi
      [toWei("0.1"), toWei("0.05"), toWei("0.001"), toWei("0.001"), toWei("0.2"), toWei("0.02"), toWei("0.00000002"), toWei("0.5"), toWei("5")],
      // alpha         beta1        beta2          frLimit       lev         maxClose       frFactor
      [toWei("0.01"), toWei("0.1"), toWei("0.06"), toWei("0.1"), toWei("5"), toWei("0.05"), toWei("0.01"), toWei("1")],
      [toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0")],
      [toWei("0.1"), toWei("0.2"), toWei("0.2"), toWei("0.5"), toWei("10"), toWei("0.99"), toWei("1"), toWei("1")]
    );

    await perp.createPerpetual(
      oracle2.address,
      [toWei("0.1"), toWei("0.05"), toWei("0.001"), toWei("0.001"), toWei("0.2"), toWei("0.02"), toWei("0.00000002"), toWei("0.5"), toWei("5")],
      [toWei("0.01"), toWei("0.1"), toWei("0.06"), toWei("0.1"), toWei("5"), toWei("0.05"), toWei("0.01"), toWei("1")],
      [toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0")],
      [toWei("0.1"), toWei("0.2"), toWei("0.2"), toWei("0.5"), toWei("10"), toWei("0.99"), toWei("1"), toWei("1")]
    );
    await perp.createPerpetual(
      oracle3.address,
      [toWei("0.1"), toWei("0.05"), toWei("0.001"), toWei("0.001"), toWei("0.2"), toWei("0.02"), toWei("0.00000002"), toWei("0.5"), toWei("5")],
      [toWei("0.01"), toWei("0.1"), toWei("0.06"), toWei("0.1"), toWei("5"), toWei("0.05"), toWei("0.01"), toWei("1")],
      [toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0")],
      [toWei("0.1"), toWei("0.2"), toWei("0.2"), toWei("0.5"), toWei("10"), toWei("0.99"), toWei("1"), toWei("1")]
    );
    await perp.createPerpetual(
      oracle4.address,
      [toWei("0.1"), toWei("0.05"), toWei("0.001"), toWei("0.001"), toWei("0.2"), toWei("0.02"), toWei("0.00000002"), toWei("0.5"), toWei("5")],
      [toWei("0.01"), toWei("0.1"), toWei("0.06"), toWei("0.1"), toWei("5"), toWei("0.05"), toWei("0.01"), toWei("1")],
      [toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0")],
      [toWei("0.1"), toWei("0.2"), toWei("0.2"), toWei("0.5"), toWei("10"), toWei("0.99"), toWei("1"), toWei("1")]
    );

    await perp.runLiquidityPool();

    // overview
    const info = await perp.getLiquidityPoolInfo();
    const stk = await (await createFactory("TestLpGovernor")).attach(info[2][4]);

    // get initial coins
    await ctk.mint(user1.address, toWei("10000"));
    await ctk.mint(user2.address, toWei("10000"));
    await ctk.connect(user1).approve(perp.address, toWei("100000"));
    await ctk.connect(user2).approve(perp.address, toWei("100000"));

    await perp.forceToSyncState();

    // deposit
    await perp.connect(user1).deposit(0, user1.address, toWei("100"));

    // lp
    await updatePrice(toWei("501"), toWei("601"), toWei("701"), toWei("801"));
    await perp.connect(user2).addLiquidity(toWei("1000"));

    let now = Math.floor(Date.now() / 1000);

    await poolCreator.setGuaridan(user3.address);
    expect(await poolCreator.guardian()).to.equal(user3.address);

    await expect(poolCreator.setUniverseSettled(true)).to.be.revertedWith("sender is not guardian");
    await poolCreator.connect(user3).setUniverseSettled(true)

    await expect(perp.connect(user1).deposit(0, user1.address, toWei("100"))).to.be.revertedWith("universe settled");;
    // trade 1
    await expect(perp.connect(user1).trade(0, user1.address, toWei("0.1"), toWei("1000"), now + 999999, none, 0)).to.be.revertedWith("universe settled");
    // withdraw
    await expect(perp.connect(user1).withdraw(0, user1.address, toWei("10"))).to.be.revertedWith("universe settled");;
  });
});
