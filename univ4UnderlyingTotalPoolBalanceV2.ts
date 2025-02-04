import { TickMath } from "@uniswap/v3-sdk";
import {
  createPublicClient,
  http,
  Address,
  Hex,
  pad,
  keccak256,
  encodePacked,
  hexToBigInt,
  formatEther,
  Chain,
  getContractError,
  PublicClient,
  stringToHex,
} from "viem";
import { readContract } from "viem/actions";
import { base, baseSepolia } from "viem/chains";
import { bytes32ToUint256, uint256ToBytes32 } from "./utils/common";
import { calculateUnderlyingTokenBalances } from "./utils/liquidity";
import {
  BidWallAddress,
  FairLaunchAddress,
  PoolManagerAddress,
} from "./data/addresses";
import { BidWallABI } from "./abi/BidWall";
import { PoolManagerABI } from "./abi/PoolManager";
import { RPC_URL } from "./data/rpcs";
import { FairLaunchABI } from "./abi/FairLaunch";
import { getValidTick, TICK_FINDER, TICK_SPACING } from "./utils/ticks";

let currentChain: Chain = base;

let publicClient: PublicClient = createPublicClient({
  chain: currentChain,
  transport: http(RPC_URL[currentChain.id]),
});

const getPoolStateSlot = ({ poolId }: { poolId: Hex }) => {
  const POOLS_SLOT = uint256ToBytes32(6n);

  return keccak256(encodePacked(["bytes32", "bytes32"], [poolId, POOLS_SLOT]));
};

const getPoolLiquidity = async ({ poolId }: { poolId: Hex }) => {
  const stateSlot = getPoolStateSlot({ poolId });

  const LIQUIDITY_OFFSET = 3n;
  const liquiditySlot = uint256ToBytes32(
    bytes32ToUint256(stateSlot) + LIQUIDITY_OFFSET
  );

  let liquidity = 0n;
  try {
    const data = await readContract(publicClient, {
      address: PoolManagerAddress[currentChain.id],
      abi: PoolManagerABI,
      functionName: "extsload",
      args: [liquiditySlot],
    });
    liquidity = hexToBigInt(data);
  } catch (error) {
    const cError = getContractError(error as Error, {
      address: PoolManagerAddress[currentChain.id],
      abi: PoolManagerABI,
      functionName: "extsload",
      args: [liquiditySlot],
    });

    console.log("error in getPoolLiquidity", {
      error: {
        shortMessage: cError.shortMessage,
        contractAddress: cError.contractAddress,
        functionName: cError.functionName,
        args: cError.args,
      },
    });
    liquidity = 0n;
  }

  return { liquidity };
};

const getPoolSlot0 = async ({ poolId }: { poolId: Hex }) => {
  const stateSlot = getPoolStateSlot({ poolId });

  try {
    const data = await readContract(publicClient, {
      address: PoolManagerAddress[currentChain.id],
      abi: PoolManagerABI,
      functionName: "extsload",
      args: [stateSlot],
    });

    // Convert the input hex to a BigInt for bitwise operations
    const dataAsBigInt = BigInt(data);

    // Extract sqrtPriceX96 (bottom 160 bits)
    const sqrtPriceX96Mask = BigInt(
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
    );
    const sqrtPriceX96 = dataAsBigInt & sqrtPriceX96Mask;

    // Extract tick (next 24 bits after sqrtPriceX96)
    // First, shift right by 160 bits to get the tick bits at the bottom
    const tickShifted = dataAsBigInt >> 160n;
    // Then mask to get only the 24 bits we want
    const tickMask = BigInt("0xFFFFFF");
    const tickRaw = Number(tickShifted & tickMask);
    // Sign extend the 24-bit number if needed
    const tick = tickRaw > 0x7fffff ? tickRaw - 0x1000000 : tickRaw;

    // Extract protocolFee (next 24 bits)
    const protocolFeeShifted = dataAsBigInt >> 184n;
    const protocolFeeMask = BigInt("0xFFFFFF");
    const protocolFee = Number(protocolFeeShifted & protocolFeeMask);

    // Extract lpFee (last 24 bits)
    const lpFeeShifted = dataAsBigInt >> 208n;
    const lpFeeMask = BigInt("0xFFFFFF");
    const lpFee = Number(lpFeeShifted & lpFeeMask);

    return { sqrtPriceX96, tick, protocolFee, lpFee };
  } catch (error) {
    const cError = getContractError(error as Error, {
      address: PoolManagerAddress[currentChain.id],
      abi: PoolManagerABI,
      functionName: "extsload",
      args: [stateSlot],
    });

    console.log("error in getPoolSlot0", {
      error: {
        shortMessage: cError.shortMessage,
        contractAddress: cError.contractAddress,
        functionName: cError.functionName,
        args: cError.args,
      },
    });
    return { sqrtPriceX96: 0n, tick: 0, protocolFee: 0, lpFee: 0 };
  }
};

// NOTE: this results in inaccuracte results when memecoin is sold, but tracks the ETH amount incoming after a buy correctly
const getUnderlyingTotalPoolBalance = async ({ poolId }: { poolId: Hex }) => {
  const tickLower = TickMath.MIN_TICK;
  const tickUpper = TickMath.MAX_TICK;

  const { liquidity } = await getPoolLiquidity({ poolId });
  const { tick: tickCurrent } = await getPoolSlot0({ poolId });

  const { amount0, amount1 } = calculateUnderlyingTokenBalances(
    liquidity,
    tickLower,
    tickUpper,
    tickCurrent
  );

  return { amount0, amount1 };
};

const getPositionInfo = async ({
  poolId,
  owner,
  tickLower,
  tickUpper,
  salt,
}: {
  poolId: Hex;
  owner: Address;
  tickLower: number;
  tickUpper: number;
  salt: string;
}): Promise<{
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
}> => {
  const saltBytes32 = pad(stringToHex(salt), { size: 32, dir: "right" });

  const positionKey = keccak256(
    encodePacked(
      ["address", "int24", "int24", "bytes32"],
      [owner, tickLower, tickUpper, saltBytes32]
    )
  );

  const stateSlot = getPoolStateSlot({ poolId });

  const POSITIONS_OFFSET = 6n;
  const positionMapping = uint256ToBytes32(
    bytes32ToUint256(stateSlot) + POSITIONS_OFFSET
  );

  const positionInfoSlot = keccak256(
    encodePacked(["bytes32", "bytes32"], [positionKey, positionMapping])
  );

  const data = await readContract(publicClient, {
    address: PoolManagerAddress[currentChain.id],
    abi: PoolManagerABI,
    functionName: "extsload",
    args: [positionInfoSlot, 3n],
  });

  const liquidity = hexToBigInt(data[0]);
  const feeGrowthInside0LastX128 = hexToBigInt(data[1]);
  const feeGrowthInside1LastX128 = hexToBigInt(data[2]);

  return {
    liquidity,
    feeGrowthInside0LastX128,
    feeGrowthInside1LastX128,
  };
};

const getFairLaunchETHOnlyPosition = async ({
  poolId,
  currencyFlipped,
  initialTick,
  tickCurrent,
}: {
  poolId: Hex;
  currencyFlipped: boolean;
  initialTick: number;
  tickCurrent: number;
}) => {
  let tickLower: number;
  let tickUpper: number;

  if (!currencyFlipped) {
    tickLower = getValidTick({ tick: initialTick + 1, roundDown: false });
    tickUpper = tickLower + TICK_SPACING;
  } else {
    tickUpper = getValidTick({ tick: initialTick - 1, roundDown: true });
    tickLower = tickUpper - TICK_SPACING;
  }

  const { liquidity } = await getPositionInfo({
    poolId,
    owner: FairLaunchAddress[currentChain.id],
    tickLower,
    tickUpper,
    salt: "",
  });

  const { amount0, amount1 } = calculateUnderlyingTokenBalances(
    liquidity,
    tickLower,
    tickUpper,
    tickCurrent
  );

  return { amount0, amount1 };
};

const getFairLaunchMemeOnlyPosition = async ({
  poolId,
  currencyFlipped,
  initialTick,
  tickCurrent,
}: {
  poolId: Hex;
  currencyFlipped: boolean;
  initialTick: number;
  tickCurrent: number;
}) => {
  let tickLower: number;
  let tickUpper: number;

  if (!currencyFlipped) {
    tickLower = TICK_FINDER.MIN_TICK;
    tickUpper = getValidTick({ tick: initialTick - 1, roundDown: true });
  } else {
    tickLower = getValidTick({ tick: initialTick + 1, roundDown: false });
    tickUpper = TICK_FINDER.MAX_TICK;
  }

  const { liquidity } = await getPositionInfo({
    poolId,
    owner: FairLaunchAddress[currentChain.id],
    tickLower,
    tickUpper,
    salt: "",
  });

  const { amount0, amount1 } = calculateUnderlyingTokenBalances(
    liquidity,
    tickLower,
    tickUpper,
    tickCurrent
  );

  return { amount0, amount1 };
};

const getUnderlyingFairLaunchBalance = async ({
  poolId,
  currencyFlipped,
}: {
  poolId: Hex;
  currencyFlipped: boolean;
}) => {
  const { initialTick } = await readContract(publicClient, {
    address: FairLaunchAddress[currentChain.id],
    abi: FairLaunchABI,
    functionName: "fairLaunchInfo",
    args: [poolId],
  });

  const { tick: tickCurrent } = await getPoolSlot0({ poolId });

  const { amount0: amount0ETHOnlyPos, amount1: amount1ETHOnlyPos } =
    await getFairLaunchETHOnlyPosition({
      poolId,
      currencyFlipped,
      initialTick,
      tickCurrent,
    });

  const { amount0: amount0MEMEOnlyPos, amount1: amount1MEMEOnlyPos } =
    await getFairLaunchMemeOnlyPosition({
      poolId,
      currencyFlipped,
      initialTick,
      tickCurrent,
    });

  return {
    amount0: amount0ETHOnlyPos + amount0MEMEOnlyPos,
    amount1: amount1ETHOnlyPos + amount1MEMEOnlyPos,
  };
};

const getUnderlyingBidWallBalance = async ({ poolId }: { poolId: Hex }) => {
  const [amount0, amount1, pendingEth] = await readContract(publicClient, {
    address: BidWallAddress[currentChain.id],
    abi: BidWallABI,
    functionName: "position",
    args: [poolId],
  });

  return { amount0, amount1, pendingEth };
};

const main = async () => {
  currentChain = baseSepolia;
  const poolId: Hex =
    "0x3f08a616131c6bbae508fb0f94f66acf1d9ac7ebdca43050dc883d2ac344c5a1";
  const currencyFlipped: boolean = true;

  publicClient = createPublicClient({
    chain: currentChain,
    transport: http(RPC_URL[currentChain.id]),
  });

  const {
    amount0: amount0BidWall,
    amount1: amount1BidWall,
    pendingEth,
  } = await getUnderlyingBidWallBalance({ poolId });

  const { amount0: amount0FairLaunch, amount1: amount1FairLaunch } =
    await getUnderlyingFairLaunchBalance({
      poolId,
      currencyFlipped,
    });

  const totalAmount0 = amount0BidWall + amount0FairLaunch;
  const totalAmount1 = amount1BidWall + amount1FairLaunch;

  console.log({
    currencyFlipped,
    total: {
      amount0: formatEther(totalAmount0),
      amount1: formatEther(totalAmount1),
      pendingEth: formatEther(pendingEth),
    },
    bidWall: {
      amount0: formatEther(amount0BidWall),
      amount1: formatEther(amount1BidWall),
      pendingEth: formatEther(pendingEth),
    },
    fairLaunch: {
      amount0: formatEther(amount0FairLaunch),
      amount1: formatEther(amount1FairLaunch),
    },
  });
};

main();
