# Product Subcategory Fix - TODO List

## Current Status
- Backend API doesn't include subcategory information in product responses
- Frontend cannot display or edit subcategory properly
- Product.categoryId can point to either main category or subcategory

## Tasks to Complete

### 1. Update Product Fetching Queries
- [ ] Update `getProducts` function include statement
- [ ] Update `getProductById` function include statement
- [ ] Update `getProductByName` function include statement
- [ ] Update `searchProductsByName` function include statement
- [ ] Add parent category include to all queries

### 2. Update processProductData Function
- [ ] Add logic to determine if category is subcategory (has parentId)
- [ ] Include subcategory and category info in response
- [ ] Add subcategoryId field for frontend compatibility

### 3. Update Product Update Operations
- [ ] Update `updateProduct` function to handle subcategoryId parameter
- [ ] Update `updateProductAll` function to handle subcategoryId parameter
- [ ] Maintain existing logic where subcategoryId takes precedence

### 4. Testing
- [ ] Test product fetching APIs to verify subcategory info is included
- [ ] Test product update operations with subcategoryId
- [ ] Verify frontend can properly display and edit subcategory information

## Implementation Notes
- Category model has self-referential associations (parent/subCategories)
- Product.categoryId points to whatever category (main or sub) is selected
- Need to include parent association in Category include to get full category hierarchy
- Frontend expects subcategoryId in response for proper editing
