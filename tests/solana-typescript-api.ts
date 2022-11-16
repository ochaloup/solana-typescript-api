import * as anchor from "@project-serum/anchor";
import { 
  AnchorProvider,
  Program,
} from "@project-serum/anchor";
import { SolanaTypescriptApi } from "../target/types/solana_typescript_api";
import { assert } from "chai"

import {
  BlockhashWithExpiryBlockHeight,
  Commitment,
  Keypair,
  SimulatedTransactionResponse,
  RpcResponseAndContext,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

// sneaking into non-exported NodeWalled to get Keypair
import NodeWallet from '@project-serum/anchor/dist/cjs/nodewallet';

describe("solana-typescript-api", () => {
  // Transaction commitment level we will use for our testing here.
  const commitmentLevel: Commitment = "confirmed"

  // Configure the client to use the local cluster.
  // We could use the default `.env()` where we can switch to different cluster setting env property `ANCHOR_PROVIDER_URL`
  // but that way we cannot setup the options of the connections
  //  -> anchor.setProvider(anchor.AnchorProvider.env());
  let anchorOptions = AnchorProvider.defaultOptions()
  anchorOptions.commitment = commitmentLevel  // default is 'processed'
  anchorOptions.preflightCommitment = commitmentLevel  // default is 'processed' but we skip preflight either way
  anchorOptions.skipPreflight = true;  // let's not simulate and go directly to blockchain
  anchor.setProvider(anchor.AnchorProvider.local(undefined, anchorOptions))  // undefined will use default localhost

  
  const program = anchor.workspace.SolanaTypescriptApi as Program<SolanaTypescriptApi>;

  let blockhashBeforeCall: BlockhashWithExpiryBlockHeight | null = null
  before(async function() {
    // Taking the current blockhash of the network before every test.
    // Value is used at method waiting for finalizing the transaction within the commitment level (i.e., confirmTransaction)
    // The method checks only in such deep history as defined in parameter of lastValidBlockHeight
    blockhashBeforeCall = await anchor.getProvider().connection.getLatestBlockhash(commitmentLevel)
  });


  // ------------------------------------------------------------------------------
  // ------------------------------ TESTS -----------------------------------------
  // ------------------------------------------------------------------------------

  // NOTE: to execute only one test change it("... to it.only("...
  it("simple call the program", async () => {
    // Anchor Typescript SDK to call our program. Anchor knows about 'intialize' method based on generated IDL (./target/idl/*.json)
    const tx = await program.methods.initialize().rpc();

    // Waiting for transaction to be confirmed by network into level of 'confirmed'
    // commitment levels summarized e.g., at https://solana.stackexchange.com/a/2199/1386
    const txConfirmation = await anchor.getProvider().connection.confirmTransaction(
      {signature: tx, blockhash: blockhashBeforeCall.blockhash, lastValidBlockHeight: blockhashBeforeCall.lastValidBlockHeight},
      commitmentLevel
    )
    assert.isNull(txConfirmation.value.err, `tx ${tx} failed with ${txConfirmation.value.err}`)

    // Transaction is available in blockchain at the commitment level defined
    // we can read it and print data that interested us - what accounts were used, what is log of execution
    const txLog = await anchor.getProvider().connection.getTransaction(
      tx,
      {commitment: commitmentLevel, maxSupportedTransactionVersion: undefined}
    );
    console.log(
      "tx", tx,
      "tx accounts", txLog.transaction.message.getAccountKeys().staticAccountKeys.map((ak) =>  ak.toBase58()),
      "tx log", txLog.meta.logMessages
    )
  });

  it("simulate the program with anchor", async () => {
    const simulateResponse = await program.methods.initialize().simulate();
    console.log("events", simulateResponse.events, "log", simulateResponse.raw)
  });

  it.only("simulate the program with deprecated web3/js call", async () => {
    const ix: TransactionInstruction = await program.methods.initialize().instruction();
    const walletPayer: Keypair = ((anchor.getProvider() as AnchorProvider).wallet as NodeWallet).payer

    const transaction = new Transaction().add(ix);
    const simulatedResponse: RpcResponseAndContext<SimulatedTransactionResponse> =
        await anchor.getProvider().connection.simulateTransaction(transaction, [walletPayer], true)
    
    console.log("accounts", simulatedResponse.value.accounts, "log", simulatedResponse.value.logs)
  });

  // it("call system program transfer", async () => {
  //   // Taking the current blockhash of the network.
  //   // Value is used at method waiting for finalizing the transaction within the commitment level (i.e., confirmTransaction)
  //   // The method checks only in such deep history as defined in parameter of lastValidBlockHeight
  //   const blockhashBeforeCall: BlockhashWithExpiryBlockHeight =
  //     await anchor.getProvider().connection.getLatestBlockhash(commitmentLevel)
  //   // Anchor Typescript SDK to call our program. Anchor knows about 'intialize' method based on generated IDL (./target/idl/*.json)
  //   const tx = await program.methods.initialize().rpc();
  //   // Waiting for transaction to be confirmed by network into level of 'confirmed'
  //   // commitment levels summarized e.g., at https://solana.stackexchange.com/a/2199/1386
  //   const txConfirmation = await anchor.getProvider().connection.confirmTransaction(
  //     {signature: tx, blockhash: blockhashBeforeCall.blockhash, lastValidBlockHeight: blockhashBeforeCall.lastValidBlockHeight},
  //     commitmentLevel
  //   )
  //   assert.isNull(txConfirmation.value.err, `tx ${tx} failed with ${txConfirmation.value.err}`)
  //   // Transaction is available in blockchain at the commitment level defined
  //   // we can read it and print data that interested us - what accounts were used, what is log of execution
  //   const txLog = await anchor.getProvider().connection.getTransaction(
  //     tx,
  //     {commitment: commitmentLevel, maxSupportedTransactionVersion: undefined}
  //   );
  //   console.log(
  //     "tx", tx,
  //     "tx accounts", txLog.transaction.message.getAccountKeys().staticAccountKeys.map((ak) =>  ak.toBase58()),
  //     "tx log", txLog.meta.logMessages
  //   )
  // });
});
