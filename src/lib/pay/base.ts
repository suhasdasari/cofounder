import { encodeFunctionData, parseAbi, type Address } from "viem";

export const BASE_CHAIN_ID = 8453;
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
export const WETH = "0x4200000000000000000000000000000000000006" as Address;
export const SWAP_ROUTER02 = "0x2626664c2603336E57B271c5C0b26F421741e481" as Address;
export const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a" as Address;
export const BASE_RPC = "https://mainnet.base.org";
export const POOL_FEES = [500, 3000, 100] as const;
export const USDC_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export function usdcUnits(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export const quoterAbi = parseAbi([
  "function quoteExactOutputSingle((address tokenIn, address tokenOut, uint256 amount, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

export const routerAbi = parseAbi([
  "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)",
  "function refundETH() payable",
  "function multicall(bytes[] data) payable returns (bytes[] results)",
]);

export function encodeUsdcTransfer(to: Address, amount: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
  });
}

export function encodeEthToUsdcSwap(
  to: Address,
  amountOut: bigint,
  amountInMax: bigint,
  fee: number,
): `0x${string}` {
  const swap = encodeFunctionData({
    abi: routerAbi,
    functionName: "exactOutputSingle",
    args: [
      {
        tokenIn: WETH,
        tokenOut: USDC,
        fee,
        recipient: to,
        amountOut,
        amountInMaximum: amountInMax,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  const refund = encodeFunctionData({
    abi: routerAbi,
    functionName: "refundETH",
  });
  return encodeFunctionData({
    abi: routerAbi,
    functionName: "multicall",
    args: [[swap, refund]],
  });
}
