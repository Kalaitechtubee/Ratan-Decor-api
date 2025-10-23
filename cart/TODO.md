# Cart Rate Limiting and Timeout Fix

## Tasks
- [ ] Define cart-specific rate limiter in server.js (500 requests per 15 minutes)
- [ ] Apply cart rate limiter to cart routes in routes.js
- [ ] Add 30-second timeout handling to all cart controller database operations
- [ ] Test rate limiting behavior
- [ ] Monitor for performance issues

## Details
- Global rate limit: 100 requests per 15 minutes
- Cart-specific rate limit: 500 requests per 15 minutes (5x more permissive)
- Database timeout: 30 seconds for all cart operations
- Files to edit: server.js, cart/routes.js, cart/controller.js
