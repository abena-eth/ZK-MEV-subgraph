import { Address, BigInt, ByteArray, Bytes } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/Hashmasks/Hashmasks";
import { Singleton, Transfer, Wash, Washer } from "../generated/schema";

const NULL_ADDRESS = Bytes.fromHexString(
  "0x0000000000000000000000000000000000000000"
);

export function handleTransfer(event: TransferEvent): void {
  let thisId =
    event.params.from.toHexString() +
    event.params.to.toHexString() +
    event.params.tokenId.toString();
  let reverseId =
    event.params.to.toHexString() +
    event.params.from.toHexString() +
    event.params.tokenId.toString();

  let entity = new Transfer(thisId);

  entity.txHash = event.transaction.hash;

  entity.value = event.transaction.value;
  entity.from = event.params.from;
  entity.to = event.params.to;
  entity.tokenId = event.params.tokenId;
  entity.save();

  let before = Transfer.load(reverseId);

  if (
    before != null &&
    entity.from != NULL_ADDRESS &&
    entity.to != NULL_ADDRESS &&
    (event.transaction.value.gt(BigInt.fromI32(0)) ||
      before.value.gt(BigInt.fromI32(0)))
  ) {
    let singleton = getSingleton();
    singleton.washCount = singleton.washCount.plus(BigInt.fromI32(1));
    singleton.totalWashValue = singleton.totalWashValue
      .plus(event.transaction.value)
      .plus(before.value);
    singleton.save();

    let washer = getOrCreateWasher(entity.from);
    washer.washCount = washer.washCount.plus(BigInt.fromI32(1));
    washer.totalWashValue = washer.totalWashValue
      .plus(event.transaction.value)
      .plus(before.value);
    washer.save();

    let wash = new Wash(
      event.transaction.hash.concatI32(event.transactionLogIndex.toI32())
    );
    wash.outTransfer = reverseId;
    wash.inTransfer = thisId;
    wash.washer = washer.id;
    wash.save();
  }
}

function getOrCreateWasher(id: Bytes): Washer {
  let washer = Washer.load(id);
  if (washer == null) {
    washer = new Washer(id);
    washer.washCount = BigInt.fromI32(0);
    washer.totalWashValue = BigInt.fromI32(0);
  }
  return washer;
}

function getSingleton(): Singleton {
  let singleton = Singleton.load("singleton");
  if (singleton == null) {
    singleton = new Singleton("singleton");
    singleton.washCount = BigInt.fromI32(0);
    singleton.totalWashValue = BigInt.fromI32(0);
  }
  return singleton;
}
