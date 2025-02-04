import { TickMath } from "@uniswap/v3-sdk";
import {
  createPublicClient,
  http,
  Address,
  Hex,
  pad,
  keccak256,
  encodeAbiParameters,
  encodePacked,
  hexToBigInt,
  formatEther,
  Chain,
  getContractError,
  PublicClient,
} from "viem";
import { readContract } from "viem/actions";
import { base, baseSepolia } from "viem/chains";

let currentChain: Chain = base;

const RPC_URL: {
  [chainId: number]: string;
} = {
  [baseSepolia.id]: "https://sepolia.base.org",
  [base.id]: "https://mainnet.base.org",
};

const PoolManagerAddress: {
  [chainId: number]: Address;
} = {
  [baseSepolia.id]: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
  [base.id]: "0x498581fF718922c3f8e6A244956aF099B2652b2b",
};

const PoolManagerABI = [
  {
    inputs: [
      { internalType: "address", name: "initialOwner", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  { inputs: [], name: "AlreadyUnlocked", type: "error" },
  {
    inputs: [
      { internalType: "address", name: "currency0", type: "address" },
      { internalType: "address", name: "currency1", type: "address" },
    ],
    name: "CurrenciesOutOfOrderOrEqual",
    type: "error",
  },
  { inputs: [], name: "CurrencyNotSettled", type: "error" },
  { inputs: [], name: "DelegateCallNotAllowed", type: "error" },
  { inputs: [], name: "InvalidCaller", type: "error" },
  { inputs: [], name: "ManagerLocked", type: "error" },
  { inputs: [], name: "MustClearExactPositiveDelta", type: "error" },
  { inputs: [], name: "NonzeroNativeValue", type: "error" },
  { inputs: [], name: "PoolNotInitialized", type: "error" },
  { inputs: [], name: "ProtocolFeeCurrencySynced", type: "error" },
  {
    inputs: [{ internalType: "uint24", name: "fee", type: "uint24" }],
    name: "ProtocolFeeTooLarge",
    type: "error",
  },
  { inputs: [], name: "SwapAmountCannotBeZero", type: "error" },
  {
    inputs: [{ internalType: "int24", name: "tickSpacing", type: "int24" }],
    name: "TickSpacingTooLarge",
    type: "error",
  },
  {
    inputs: [{ internalType: "int24", name: "tickSpacing", type: "int24" }],
    name: "TickSpacingTooSmall",
    type: "error",
  },
  { inputs: [], name: "UnauthorizedDynamicLPFeeUpdate", type: "error" },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "spender",
        type: "address",
      },
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "PoolId", name: "id", type: "bytes32" },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount0",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount1",
        type: "uint256",
      },
    ],
    name: "Donate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "PoolId", name: "id", type: "bytes32" },
      {
        indexed: true,
        internalType: "Currency",
        name: "currency0",
        type: "address",
      },
      {
        indexed: true,
        internalType: "Currency",
        name: "currency1",
        type: "address",
      },
      { indexed: false, internalType: "uint24", name: "fee", type: "uint24" },
      {
        indexed: false,
        internalType: "int24",
        name: "tickSpacing",
        type: "int24",
      },
      {
        indexed: false,
        internalType: "contract IHooks",
        name: "hooks",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint160",
        name: "sqrtPriceX96",
        type: "uint160",
      },
      { indexed: false, internalType: "int24", name: "tick", type: "int24" },
    ],
    name: "Initialize",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "PoolId", name: "id", type: "bytes32" },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "int24",
        name: "tickLower",
        type: "int24",
      },
      {
        indexed: false,
        internalType: "int24",
        name: "tickUpper",
        type: "int24",
      },
      {
        indexed: false,
        internalType: "int256",
        name: "liquidityDelta",
        type: "int256",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "salt",
        type: "bytes32",
      },
    ],
    name: "ModifyLiquidity",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      { indexed: false, internalType: "bool", name: "approved", type: "bool" },
    ],
    name: "OperatorSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "protocolFeeController",
        type: "address",
      },
    ],
    name: "ProtocolFeeControllerUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "PoolId", name: "id", type: "bytes32" },
      {
        indexed: false,
        internalType: "uint24",
        name: "protocolFee",
        type: "uint24",
      },
    ],
    name: "ProtocolFeeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "PoolId", name: "id", type: "bytes32" },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "int128",
        name: "amount0",
        type: "int128",
      },
      {
        indexed: false,
        internalType: "int128",
        name: "amount1",
        type: "int128",
      },
      {
        indexed: false,
        internalType: "uint160",
        name: "sqrtPriceX96",
        type: "uint160",
      },
      {
        indexed: false,
        internalType: "uint128",
        name: "liquidity",
        type: "uint128",
      },
      { indexed: false, internalType: "int24", name: "tick", type: "int24" },
      { indexed: false, internalType: "uint24", name: "fee", type: "uint24" },
    ],
    name: "Swap",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "id", type: "uint256" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint256", name: "id", type: "uint256" },
    ],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "balance", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "burn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "Currency", name: "currency", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "clear",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "Currency", name: "currency", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "collectProtocolFees",
    outputs: [
      { internalType: "uint256", name: "amountCollected", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "Currency", name: "currency0", type: "address" },
          { internalType: "Currency", name: "currency1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickSpacing", type: "int24" },
          { internalType: "contract IHooks", name: "hooks", type: "address" },
        ],
        internalType: "struct PoolKey",
        name: "key",
        type: "tuple",
      },
      { internalType: "uint256", name: "amount0", type: "uint256" },
      { internalType: "uint256", name: "amount1", type: "uint256" },
      { internalType: "bytes", name: "hookData", type: "bytes" },
    ],
    name: "donate",
    outputs: [{ internalType: "BalanceDelta", name: "delta", type: "int256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "slot", type: "bytes32" }],
    name: "extsload",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "startSlot", type: "bytes32" },
      { internalType: "uint256", name: "nSlots", type: "uint256" },
    ],
    name: "extsload",
    outputs: [{ internalType: "bytes32[]", name: "", type: "bytes32[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32[]", name: "slots", type: "bytes32[]" }],
    name: "extsload",
    outputs: [{ internalType: "bytes32[]", name: "", type: "bytes32[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32[]", name: "slots", type: "bytes32[]" }],
    name: "exttload",
    outputs: [{ internalType: "bytes32[]", name: "", type: "bytes32[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "slot", type: "bytes32" }],
    name: "exttload",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "Currency", name: "currency0", type: "address" },
          { internalType: "Currency", name: "currency1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickSpacing", type: "int24" },
          { internalType: "contract IHooks", name: "hooks", type: "address" },
        ],
        internalType: "struct PoolKey",
        name: "key",
        type: "tuple",
      },
      { internalType: "uint160", name: "sqrtPriceX96", type: "uint160" },
    ],
    name: "initialize",
    outputs: [{ internalType: "int24", name: "tick", type: "int24" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "operator", type: "address" },
    ],
    name: "isOperator",
    outputs: [{ internalType: "bool", name: "isOperator", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "Currency", name: "currency0", type: "address" },
          { internalType: "Currency", name: "currency1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickSpacing", type: "int24" },
          { internalType: "contract IHooks", name: "hooks", type: "address" },
        ],
        internalType: "struct PoolKey",
        name: "key",
        type: "tuple",
      },
      {
        components: [
          { internalType: "int24", name: "tickLower", type: "int24" },
          { internalType: "int24", name: "tickUpper", type: "int24" },
          { internalType: "int256", name: "liquidityDelta", type: "int256" },
          { internalType: "bytes32", name: "salt", type: "bytes32" },
        ],
        internalType: "struct IPoolManager.ModifyLiquidityParams",
        name: "params",
        type: "tuple",
      },
      { internalType: "bytes", name: "hookData", type: "bytes" },
    ],
    name: "modifyLiquidity",
    outputs: [
      { internalType: "BalanceDelta", name: "callerDelta", type: "int256" },
      { internalType: "BalanceDelta", name: "feesAccrued", type: "int256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "protocolFeeController",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "Currency", name: "currency", type: "address" }],
    name: "protocolFeesAccrued",
    outputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "operator", type: "address" },
      { internalType: "bool", name: "approved", type: "bool" },
    ],
    name: "setOperator",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "Currency", name: "currency0", type: "address" },
          { internalType: "Currency", name: "currency1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickSpacing", type: "int24" },
          { internalType: "contract IHooks", name: "hooks", type: "address" },
        ],
        internalType: "struct PoolKey",
        name: "key",
        type: "tuple",
      },
      { internalType: "uint24", name: "newProtocolFee", type: "uint24" },
    ],
    name: "setProtocolFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "controller", type: "address" }],
    name: "setProtocolFeeController",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "settle",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "recipient", type: "address" }],
    name: "settleFor",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes4", name: "interfaceId", type: "bytes4" }],
    name: "supportsInterface",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "Currency", name: "currency0", type: "address" },
          { internalType: "Currency", name: "currency1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickSpacing", type: "int24" },
          { internalType: "contract IHooks", name: "hooks", type: "address" },
        ],
        internalType: "struct PoolKey",
        name: "key",
        type: "tuple",
      },
      {
        components: [
          { internalType: "bool", name: "zeroForOne", type: "bool" },
          { internalType: "int256", name: "amountSpecified", type: "int256" },
          {
            internalType: "uint160",
            name: "sqrtPriceLimitX96",
            type: "uint160",
          },
        ],
        internalType: "struct IPoolManager.SwapParams",
        name: "params",
        type: "tuple",
      },
      { internalType: "bytes", name: "hookData", type: "bytes" },
    ],
    name: "swap",
    outputs: [
      { internalType: "BalanceDelta", name: "swapDelta", type: "int256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "Currency", name: "currency", type: "address" }],
    name: "sync",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "Currency", name: "currency", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "take",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "receiver", type: "address" },
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "sender", type: "address" },
      { internalType: "address", name: "receiver", type: "address" },
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes", name: "data", type: "bytes" }],
    name: "unlock",
    outputs: [{ internalType: "bytes", name: "result", type: "bytes" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "Currency", name: "currency0", type: "address" },
          { internalType: "Currency", name: "currency1", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "int24", name: "tickSpacing", type: "int24" },
          { internalType: "contract IHooks", name: "hooks", type: "address" },
        ],
        internalType: "struct PoolKey",
        name: "key",
        type: "tuple",
      },
      { internalType: "uint24", name: "newDynamicLPFee", type: "uint24" },
    ],
    name: "updateDynamicLPFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

let publicClient: PublicClient = createPublicClient({
  chain: currentChain,
  transport: http(RPC_URL[currentChain.id]),
});

const uint256ToBytes32 = (value: bigint) => {
  return pad(
    encodeAbiParameters([{ type: "uint256", name: "value" }], [value]),
    { size: 32, dir: "right" }
  );
};

const bytes32ToUint256 = (value: Hex) => {
  return hexToBigInt(value);
};

export const getSqrtPriceX96FromTick = (tick: number): bigint => {
  return BigInt(TickMath.getSqrtRatioAtTick(tick).toString());
};

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

export const calculateUnderlyingTokenBalances = (
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  tickCurrent: number
): { amount0: bigint; amount1: bigint } => {
  const sqrtPriceCurrentX96 = getSqrtPriceX96FromTick(tickCurrent);
  const sqrtPriceLowerX96 = getSqrtPriceX96FromTick(tickLower);
  const sqrtPriceUpperX96 = getSqrtPriceX96FromTick(tickUpper);

  let amount0: bigint = BigInt(0);
  let amount1: bigint = BigInt(0);

  if (tickCurrent <= tickLower) {
    // Current tick is below the position range, all value in token0
    amount0 =
      (liquidity * (sqrtPriceUpperX96 - sqrtPriceLowerX96)) / sqrtPriceUpperX96;
    amount0 = amount0 / 2n ** 96n; // Correctly divide by 2**96 to reverse the scaling
    amount1 = BigInt(0);
  } else if (tickCurrent >= tickUpper) {
    // Current tick is above the position range, all value in token1
    amount0 = BigInt(0);
    amount1 = liquidity * (sqrtPriceUpperX96 - sqrtPriceLowerX96);
    amount1 = amount1 / 2n ** 96n; // Correctly divide by 2**96 to reverse the scaling
  } else {
    // Current tick is within the position range, mixed tokens
    amount0 =
      (liquidity * (sqrtPriceUpperX96 - sqrtPriceCurrentX96)) /
      sqrtPriceUpperX96;
    amount0 = amount0 / 2n ** 96n; // Correctly divide by 2**96 to reverse the scaling
    amount1 = liquidity * (sqrtPriceCurrentX96 - sqrtPriceLowerX96);
    amount1 = amount1 / 2n ** 96n; // Correctly divide by 2**96 to reverse the scaling
  }

  return { amount0, amount1 };
};

const getUnderlyingTotalPoolBalance = async ({ poolId }: { poolId: Hex }) => {
  const tickLower = TickMath.MIN_TICK;
  const tickUpper = TickMath.MAX_TICK;

  const { liquidity } = await getPoolLiquidity({ poolId });
  const { tick: tickCurrent } = await getPoolSlot0({ poolId });

  console.log({
    liquidity,
    tickCurrent,
    tickLower,
    tickUpper,
  });

  const { amount0, amount1 } = calculateUnderlyingTokenBalances(
    liquidity,
    tickLower,
    tickUpper,
    tickCurrent
  );

  return { amount0, amount1 };
};

const main = async () => {
  currentChain = baseSepolia;
  publicClient = createPublicClient({
    chain: currentChain,
    transport: http(RPC_URL[currentChain.id]),
  });

  const { amount0, amount1 } = await getUnderlyingTotalPoolBalance({
    poolId:
      "0x3f08a616131c6bbae508fb0f94f66acf1d9ac7ebdca43050dc883d2ac344c5a1",
  });

  console.log({
    amount0: formatEther(amount0),
    amount1: formatEther(amount1),
  });
};

main();
