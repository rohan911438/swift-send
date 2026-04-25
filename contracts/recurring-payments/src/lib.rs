#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, contracterror, symbol_short, Address, BytesN, Env, Symbol, Vec, panic_with_error};

#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    ScheduleMissing = 3,
    AmountMustBePositive = 4,
    InvalidFrequency = 5,
    ScheduleExpired = 6,
    Unauthorized = 7,
    PaymentNotDue = 8,
}

#[derive(Clone, Copy, PartialEq, Eq)]
#[contracttype]
pub enum ScheduleStatus {
    Active,
    Cancelled,
    Completed,
}

#[derive(Clone)]
#[contracttype]
pub struct PaymentSchedule {
    pub id: BytesN<32>,
    pub sender: Address,
    pub recipient: Address,
    pub asset: Address,
    pub amount: i128,
    pub frequency: u64, // in seconds
    pub last_run: u64,
    pub end_date: u64,
    pub status: ScheduleStatus,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Schedule(BytesN<32>),
    UserSchedules(Address),
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

fn read_schedule(env: &Env, id: &BytesN<32>) -> Option<PaymentSchedule> {
    env.storage()
        .persistent()
        .get::<_, PaymentSchedule>(&DataKey::Schedule(id.clone()))
}

fn write_schedule(env: &Env, schedule: &PaymentSchedule) {
    env.storage()
        .persistent()
        .set(&DataKey::Schedule(schedule.id.clone()), schedule);
}

#[contract]
pub struct RecurringPayments;

#[contractimpl]
impl RecurringPayments {
    pub fn init(env: Env, admin: Address) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        write_admin(&env, &admin);
    }

    pub fn schedule_payment(
        env: Env,
        id: BytesN<32>,
        sender: Address,
        recipient: Address,
        asset: Address,
        amount: i128,
        frequency: u64,
        end_date: u64,
    ) -> PaymentSchedule {
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountMustBePositive);
        }
        if frequency == 0 {
            panic_with_error!(&env, Error::InvalidFrequency);
        }
        sender.require_auth();

        let now = env.ledger().timestamp();
        if end_date <= now {
            panic_with_error!(&env, Error::ScheduleExpired);
        }

        let schedule = PaymentSchedule {
            id: id.clone(),
            sender: sender.clone(),
            recipient,
            asset,
            amount,
            frequency,
            last_run: 0,
            end_date,
            status: ScheduleStatus::Active,
        };

        write_schedule(&env, &schedule);

        // Emit event
        env.events().publish(
            (symbol_short!("recur"), symbol_short!("created")),
            schedule.clone(),
        );

        schedule
    }

    pub fn execute_payment(env: Env, id: BytesN<32>) -> PaymentSchedule {
        let mut schedule = read_schedule(&env, &id)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ScheduleMissing));

        if schedule.status != ScheduleStatus::Active {
            panic_with_error!(&env, Error::ScheduleExpired);
        }

        let now = env.ledger().timestamp();
        if now >= schedule.end_date {
            schedule.status = ScheduleStatus::Completed;
            write_schedule(&env, &schedule);
            return schedule;
        }

        if schedule.last_run != 0 && now < schedule.last_run + schedule.frequency {
            panic_with_error!(&env, Error::PaymentNotDue);
        }

        // In a real implementation, we would call the token contract's transfer method here.
        // For this mock-heavy codebase, we'll just update the state and emit an event.
        // The backend worker will be the one triggering this.

        schedule.last_run = now;
        write_schedule(&env, &schedule);

        env.events().publish(
            (symbol_short!("recur"), symbol_short!("executed")),
            schedule.clone(),
        );

        schedule
    }

    pub fn cancel_payment(env: Env, id: BytesN<32>) -> PaymentSchedule {
        let mut schedule = read_schedule(&env, &id)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ScheduleMissing));
        
        schedule.sender.require_auth();
        schedule.status = ScheduleStatus::Cancelled;
        write_schedule(&env, &schedule);

        env.events().publish(
            (symbol_short!("recur"), symbol_short!("cancelled")),
            schedule.clone(),
        );

        schedule
    }

    pub fn get_schedule(env: Env, id: BytesN<32>) -> Option<PaymentSchedule> {
        read_schedule(&env, &id)
    }
}
