// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title UserRegistry
 * @dev Stores WarSafe Network user registrations on-chain.
 *      Passwords are pre-hashed by the client (keccak256) before
 *      being sent, so plain-text credentials never touch the chain.
 */
contract UserRegistry {
    struct User {
        string   username;
        string   role;
        bytes32  passwordHash; // keccak256 of the plain password, hashed client-side
        uint256  registeredAt;
        bool     exists;
    }

    // key = keccak256(abi.encodePacked(username, role))
    mapping(bytes32 => User) private users;

    event UserRegistered(
        bytes32 indexed usernameHash,
        string  role,
        uint256 timestamp
    );

    // ─── Write ────────────────────────────────────────────────────────────────

    /**
     * @param _username     Plain username string
     * @param _role         "user" or "admin"
     * @param _passwordHash keccak256 of the password, computed client-side
     */
    function registerUser(
        string  memory _username,
        string  memory _role,
        bytes32        _passwordHash
    ) external {
        require(bytes(_username).length >= 3, "Username too short");
        require(
            keccak256(bytes(_role)) == keccak256(bytes("user")) ||
            keccak256(bytes(_role)) == keccak256(bytes("admin")),
            "Invalid role"
        );

        bytes32 key = _userKey(_username, _role);
        require(!users[key].exists, "Username already taken");

        users[key] = User({
            username:     _username,
            role:         _role,
            passwordHash: _passwordHash,
            registeredAt: block.timestamp,
            exists:       true
        });

        emit UserRegistered(key, _role, block.timestamp);
    }

    // ─── Read (view) ──────────────────────────────────────────────────────────

    /**
     * @dev Validates login credentials. Returns true only if the user exists
     *      and the supplied password hash matches the stored one.
     */
    function validateLogin(
        string  memory _username,
        string  memory _role,
        bytes32        _passwordHash
    ) external view returns (bool) {
        bytes32 key = _userKey(_username, _role);
        if (!users[key].exists) return false;
        return users[key].passwordHash == _passwordHash;
    }

    /**
     * @dev Returns true if the username+role pair is already registered.
     */
    function userExists(
        string memory _username,
        string memory _role
    ) external view returns (bool) {
        return users[_userKey(_username, _role)].exists;
    }

    /**
     * @dev Returns public profile info (role + registration timestamp).
     */
    function getUserInfo(
        string memory _username,
        string memory _role
    ) external view returns (string memory, uint256) {
        bytes32 key = _userKey(_username, _role);
        require(users[key].exists, "User not found");
        return (users[key].role, users[key].registeredAt);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _userKey(
        string memory _username,
        string memory _role
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_username, _role));
    }
}
