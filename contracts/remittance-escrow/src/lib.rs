#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, contracterror, symbol_short, Address, Bytes, BytesN, Env, Symbol, Vec, panic_with_error};

const MAX_INDEX: u32 = 256;

#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    TransferMissing = 3,
    AmountMustBePositive = 4,
    ExpiryInPast = 5,
    TransferFinalized = 6,
    Unauthorized = 7,
}

#[derive(Clone, Copy, PartialEq, Eq)]
#[contracttype]
pub enum TransferStatus {
    Created,
    Held,
    Released,
    Refunded,
    Cancelled,
    Disputed,
}

#[derive(Clone)]
#[contracttype]
pub struct Transfer {
    pub id: BytesN<32>,
    pub sender: Address,
    pub recipient: Address,
    pub asset: Address,
    pub amount: i128,
    pub status: TransferStatus,
    pub created_at: u64,
    pub expires_at: u64,
    pub metadata: Option<Bytes>,
    pub last_tx: Option<BytesN<32>>,
}

#[derive(Clone)]
#[contracttype]
pub struct TransferEvent {
    pub id: BytesN<32>,
    pub sender: Address,
    pub recipient: Address,
    pub asset: Address,
    pub amount: i128,
    pub status: TransferStatus,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Transfer(BytesN<32>),
    Index,
}

fn read_admin(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get::<_, Address>(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

fn write_admin(env: &Env, admin: &Address) {
    env.storage().persistent().set(&DataKey::Admin, admin);
}

fn read_transfer(env: &Env, id: &BytesN<32>) -> Option<Transfer> {
    env.storage()
        .persistent()
        .get::<_, Transfer>(&DataKey::Transfer(id.clone()))
}

fn write_transfer(env: &Env, transfer: &Transfer) {
    env.storage()
        .persistent()
        .set(&DataKey::Transfer(transfer.id.clone()), transfer);
}

fn touch_index(env: &Env, id: &BytesN<32>) {
    let store = env.storage().persistent();
    let mut index = store
        .get::<_, Vec<BytesN<32>>>(&DataKey::Index)
        .unwrap_or_else(|| Vec::new(env));
    index.push_back(id.clone());
    while index.len() > MAX_INDEX {
        index.pop_front();
    }
    store.set(&DataKey::Index, &index);
}

fn emit(env: &Env, topic: Symbol, transfer: &Transfer) {
    let event = TransferEvent {
        id: transfer.id.clone(),
        sender: transfer.sender.clone(),
        recipient: transfer.recipient.clone(),
        asset: transfer.asset.clone(),
        amount: transfer.amount,
        status: transfer.status,
    };
    env.events().publish((symbol_short!("escrow"), topic), event);
}

#[contract]
pub struct RemittanceEscrow;

#[contractimpl]
impl RemittanceEscrow {
    pub fn init(env: Env, admin: Address) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        write_admin(&env, &admin);
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let current = read_admin(&env);
        current.require_auth();
        new_admin.require_auth();
        write_admin(&env, &new_admin);
    }

    pub fn create_transfer(
        env: Env,
        id: BytesN<32>,
        sender: Address,
        recipient: Address,
        asset: Address,
        amount: i128,
        expires_at: u64,
        metadata: Option<Bytes>,
    ) -> Transfer {
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountMustBePositive);
        }
        if read_transfer(&env, &id).is_some() {
            return read_transfer(&env, &id).unwrap();
        }
        sender.require_auth();
        let now = env.ledger().timestamp();
        if expires_at <= now {
            panic_with_error!(&env, Error::ExpiryInPast);
        }
        let transfer = Transfer {
            id: id.clone(),
            sender: sender.clone(),
            recipient,
            asset,
            amount,
            status: TransferStatus::Held,
            created_at: now,
            expires_at,
            metadata,
            last_tx: None,
        };
        write_transfer(&env, &transfer);
        touch_index(&env, &id);
        emit(&env, symbol_short!("created"), &transfer);
        transfer
    }

    pub fn release(env: Env, id: BytesN<32>, tx_hash: Option<BytesN<32>>) -> Transfer {
        Self::advance(env, id, TransferStatus::Released, tx_hash)
    }

    pub fn refund(env: Env, id: BytesN<32>, tx_hash: Option<BytesN<32>>) -> Transfer {
        Self::advance(env, id, TransferStatus::Refunded, tx_hash)
    }

    pub fn cancel(env: Env, id: BytesN<32>) -> Transfer {
        let transfer = read_transfer(&env, &id)
            .unwrap_or_else(|| panic_with_error!(&env, Error::TransferMissing));
        
        if transfer.status == TransferStatus::Disputed {
            panic_with_error!(&env, Error::TransferFinalized); // Reusing finalized or could add dedicated error
        }
        
        Self::advance(env, id, TransferStatus::Cancelled, None)
    }

    pub fn dispute(env: Env, id: BytesN<32>) -> Transfer {
        Self::advance(env, id, TransferStatus::Disputed, None)
    }

    pub fn get(env: Env, id: BytesN<32>) -> Option<Transfer> {
        read_transfer(&env, &id)
    }

    pub fn list(env: Env, limit: u32) -> Vec<Transfer> {
        let idx = env
            .storage()
            .persistent()
            .get::<_, Vec<BytesN<32>>>(&DataKey::Index)
            .unwrap_or_else(|| Vec::new(&env));
        let mut items = Vec::new(&env);
        let len = idx.len();
        let mut count = 0;
        while count < limit && count < len {
            let id = idx.get(len - 1 - count).unwrap();
            if let Some(t) = read_transfer(&env, &id) {
                items.push_back(t);
            }
            count += 1;
        }
        items
    }

    fn advance(
        env: Env,
        id: BytesN<32>,
        status: TransferStatus,
        tx_hash: Option<BytesN<32>>,
    ) -> Transfer {
        let mut transfer = read_transfer(&env, &id)
            .unwrap_or_else(|| panic_with_error!(&env, Error::TransferMissing));
        let admin = read_admin(&env);
        admin.require_auth();
        match transfer.status {
            TransferStatus::Released | TransferStatus::Refunded | TransferStatus::Cancelled => {
                panic_with_error!(&env, Error::TransferFinalized);
            }
            _ => {}
        }
        transfer.status = status;
        transfer.last_tx = tx_hash;
        write_transfer(&env, &transfer);
        let topic = match status {
            TransferStatus::Released => symbol_short!("released"),
            TransferStatus::Refunded => symbol_short!("refunded"),
            TransferStatus::Cancelled => symbol_short!("cancelled"),
            TransferStatus::Disputed => symbol_short!("disputed"),
            TransferStatus::Held => symbol_short!("held"),
            TransferStatus::Created => symbol_short!("created"),
        };
        emit(&env, topic, &transfer);
        transfer
    }
}

// Tests removed to keep deployment artifact slim and compatible with protocol 20 runtime.
