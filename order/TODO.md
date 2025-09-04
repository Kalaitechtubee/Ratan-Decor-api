# TODO for Order Controller Address Field Fix

- [x] Fix address field name inconsistencies in prepareOrderAddress function:
  - Replace street with address
  - Replace postalCode with pincode
  - Replace type with addressType
- [x] Fix fallback address usage to use correct field names
- [x] Verify no duplicate or redundant lines introduced
- [ ] Test order creation with new, shipping, and default address types
- [ ] Test order retrieval and address data correctness
- [ ] Test address fallback scenarios
- [ ] Review and refactor if any further improvements needed
