#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

/// Role-based access control definitions
#[derive(Clone, Copy, PartialEq, Eq)]
#[contracttype]
pub enum Role {
    Admin = 0,
    User = 1,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Gate,
    Allow(Address),
    Role(Address),
    Owner,
}

fn read_admin(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get::<_, Address>(&DataKey::Admin)
        .expect("not initialized")
}

fn write_admin(env: &Env, admin: &Address) {
    env.storage().persistent().set(&DataKey::Admin, admin);
}

fn read_owner(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get::<_, Address>(&DataKey::Owner)
        .expect("not initialized")
}

fn write_owner(env: &Env, owner: &Address) {
    env.storage().persistent().set(&DataKey::Owner, owner);
}

fn read_gate(env: &Env) -> bool {
    env.storage()
        .persistent()
        .get::<_, bool>(&DataKey::Gate)
        .unwrap_or(false)
}

fn write_gate(env: &Env, value: bool) {
    env.storage().persistent().set(&DataKey::Gate, &value);
}

fn write_allow(env: &Env, addr: &Address, allow: bool) {
    env.storage()
        .persistent()
        .set(&DataKey::Allow(addr.clone()), &allow);
}

fn read_allow(env: &Env, addr: &Address) -> bool {
    env.storage()
        .persistent()
        .get::<_, bool>(&DataKey::Allow(addr.clone()))
        .unwrap_or(false)
}

/// Read the role assigned to an address
fn read_role(env: &Env, addr: &Address) -> Role {
    env.storage()
        .persistent()
        .get::<_, Role>(&DataKey::Role(addr.clone()))
        .unwrap_or(Role::User)
}

/// Write the role assigned to an address
fn write_role(env: &Env, addr: &Address, role: Role) {
    env.storage()
        .persistent()
        .set(&DataKey::Role(addr.clone()), &role);
}

/// Check if address has admin privileges
fn is_admin(env: &Env, addr: &Address) -> bool {
    read_role(env, addr) == Role::Admin
}

fn emit(env: &Env, topic: &'static str, addr: Option<&Address>, state: bool) {
    let symbol = match topic {
        "gate" => symbol_short!("gate"),
        _ => symbol_short!("allow"),
    };
    if let Some(a) = addr {
        env.events()
            .publish((symbol_short!("guard"), symbol), (a, state));
    } else {
        env.events()
            .publish((symbol_short!("guard"), symbol), state);
    }
}

fn emit_role_change(env: &Env, addr: &Address, role: Role) {
    env.events()
        .publish((symbol_short!("guard"), symbol_short!("role")), (addr, role as u32));
}

#[contract]
pub struct AccessGuard;

#[contractimpl]
impl AccessGuard {
    /// Initialize the access guard contract
    /// Sets the caller as the owner and admin
    pub fn init(env: Env, admin: Address) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        write_owner(&env, &admin);
        write_admin(&env, &admin);
        write_role(&env, &admin, Role::Admin);
        write_gate(&env, false);
        emit(&env, "gate", None, false);
        emit_role_change(&env, &admin, Role::Admin);
    }

    /// Set the gate state (open/closed)
    /// Permission: Admin only
    pub fn set_gate(env: Env, open: bool) {
        let caller = env.invoker();
        caller.require_auth();
        
        // Verify caller has admin privileges
        if !is_admin(&env, &caller) {
            panic!("insufficient permissions: admin role required");
        }
        
        write_gate(&env, open);
        emit(&env, "gate", None, open);
    }

    /// Add or remove an address from the allowed list
    /// Permission: Admin only
    pub fn set_allow(env: Env, addr: Address, allow: bool) {
        let caller = env.invoker();
        caller.require_auth();
        
        // Verify caller has admin privileges
        if !is_admin(&env, &caller) {
            panic!("insufficient permissions: admin role required");
        }
        
        write_allow(&env, &addr, allow);
        emit(&env, "allow", Some(&addr), allow);
    }

    /// Assign a role to an address
    /// Permission: Admin only
    pub fn assign_role(env: Env, addr: Address, role: Role) {
        let caller = env.invoker();
        caller.require_auth();
        
        // Verify caller has admin privileges
        if !is_admin(&env, &caller) {
            panic!("insufficient permissions: admin role required");
        }
        
        write_role(&env, &addr, role);
        emit_role_change(&env, &addr, role);
    }

    /// Get the current role of an address
    pub fn get_role(env: Env, addr: Address) -> Role {
        read_role(&env, &addr)
    }

    /// Check if a gate is open and an address is allowed
    pub fn check(env: Env, addr: Address) -> bool {
        read_gate(&env) && read_allow(&env, &addr)
    }

    /// Check if an address has admin privileges
    pub fn is_admin_role(env: Env, addr: Address) -> bool {
        is_admin(&env, &addr)
    }

    /// Get the current gate state
    pub fn get_gate(env: Env) -> bool {
        read_gate(&env)
    }

    /// Check if an address is in the allowed list
    pub fn is_allowed(env: Env, addr: Address) -> bool {
        read_allow(&env, &addr)
    }
}
