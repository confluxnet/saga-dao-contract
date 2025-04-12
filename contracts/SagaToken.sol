// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SagaToken
 * @dev Implementation of the SAGA token for the SAGA DAO marketplace
 */
contract SagaToken is ERC20Votes {
    constructor() ERC20("SAGA Token", "SAGA") ERC20Permit("SAGA Token") {
        // Initial supply of 1,000,000 SAGA tokens
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }

    /**
     * @dev Mints new tokens to the specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    /**
     * @dev Burns tokens from the caller's address
     * @param amount The amount of tokens to burn
     */
    function burn(uint256 amount) public {
        _burn(_msgSender(), amount);
    }
    
    // The following functions are overrides required by Solidity.
    
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
    }
    
    function _mint(
        address to,
        uint256 amount
    ) internal virtual override {
        super._mint(to, amount);
    }
    
    function _burn(
        address account,
        uint256 amount
    ) internal virtual override {
        super._burn(account, amount);
    }
} 