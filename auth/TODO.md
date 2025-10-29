# TODO: Add GET Endpoints for Staff Users

## Tasks
- [x] Add `getAllStaffUsers` function in `auth/controller.js`
  - Check requester role (superadmin, admin, manager)
  - Find all users with staff roles
  - Return user details (exclude password)
- [x] Add `getStaffUserById` function in `auth/controller.js`
  - Check requester role (superadmin, admin, manager)
  - Find user by ID
  - Verify target user has staff role
  - Return user details (exclude password)
- [x] Add routes in `auth/routes.js`: `GET /staff` and `GET /staff/:id`
  - Use authenticateToken and moduleAccess.requireManagerOrAdmin
- [x] Export new functions in controller.js
- [ ] Test the endpoints

## Dependent Files
- `Ratan-Decor-api/auth/controller.js`
- `Ratan-Decor-api/auth/routes.js`

## Followup Steps
- Test the new endpoints with different user roles
- Ensure proper error handling
e