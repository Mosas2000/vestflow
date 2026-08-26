import { NextRequest, NextResponse } from "next/server";
import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  rpc as StellarRpc,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  CONTRACT_ID,
  NETWORK,
  RPC_URL,
  NETWORK_PASSPHRASE,
} from "@/lib/stellar";

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const FALLBACK_ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

/**
 * GET /api/streams/incoming?account=G...&network=testnet
 *
 * Returns incoming streams for a Stellar address — accounts that are
 * streaming tokens to the given `account`.
 *
 * Response shape:
 *   { streams: Array<{ sender: string; token: string; rate_per_sec: string; max_end_time: number }> }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const account = request.nextUrl.searchParams.get("account");

  if (!account) {
    return NextResponse.json(
      { error: "Missing required query parameter: account" },
      { status: 400 },
    );
  }

  if (!STELLAR_ADDRESS_RE.test(account)) {
    return NextResponse.json(
      { error: "Invalid Stellar address format" },
      { status: 400 },
    );
  }

  try {
    const server = new StellarRpc.Server(RPC_URL);
    const contract = new Contract(CONTRACT_ID);
    const source = account ?? FALLBACK_ACCOUNT;

    const accountData = await server.getAccount(source);
    const tx = new TransactionBuilder(accountData, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "get_incoming_streams",
          nativeToScVal(account, { type: "address" }),
        ),
      )
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);

    if (StellarRpc.Api.isSimulationError(result)) {
      return NextResponse.json({ streams: [] }, { headers: { "Cache-Control": "public, max-age=10" } });
    }

    const retval = (result as any).result?.retval;
    if (!retval) {
      return NextResponse.json({ streams: [] }, { headers: { "Cache-Control": "public, max-age=10" } });
    }

    const native = scValToNative(retval) as any;
    const streams = Array.isArray(native)
      ? native.map((s: any) => ({
          sender: String(s.sender ?? ""),
          token: String(s.token ?? ""),
          rate_per_sec: String(s.rate_per_sec ?? s.ratePerSec ?? 0),
          max_end_time: Number(s.max_end_time ?? s.maxEndTime ?? 0),
        }))
      : [];

    return NextResponse.json(
      { streams, account, network: NETWORK },
      { headers: { "Cache-Control": "public, max-age=10" } },
    );
  } catch (error) {
    console.error("Error fetching incoming streams:", error);
    return NextResponse.json({ streams: [] }, { headers: { "Cache-Control": "public, max-age=10" } });
  }
}
