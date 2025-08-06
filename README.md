# Ratan Decor Backend API

A complete backend API for the Ratan Decor platform built with Node.js, Express, and Sequelize.

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Setup environment:**
   ```bash
   npm run setup
   ```

3. **Configure database:**
   - Update the `.env` file with your MySQL credentials
   - Create the database: `CREATE DATABASE ratan_decor;`

4. **Start the server:**
   ```bash
   npm run dev
   ```

## 📋 API Endpoints

### Products
- `POST /api/product/create` - Create a new product
- `GET /api/product/all` - Get all products
- `GET /api/product/:id` - Get product by ID
- `PUT /api/product/:id` - Update product
- `DELETE /api/product/:id` - Delete product

### User Types
- `GET /api/usertype/all` - Get all user types
- `POST /api/usertype/create` - Create user type

### Categories
- `GET /api/category/all` - Get all categories
- `POST /api/category/create` - Create category

## 🔧 Troubleshooting

### Common Issues

1. **"Product name must be unique" error:**
   - This means a product with that name already exists
   - Use a unique name for each product
   - Check existing products: `GET /api/product/all`

2. **Database connection error:**
   - Make sure MySQL is running
   - Check your `.env` file credentials
   - Verify the database exists: `CREATE DATABASE ratan_decor;`

3. **Port 3000 already in use:**
   - Kill existing process: `netstat -ano | findstr :3000`
   - Or change port in `.env` file

4. **Missing dependencies:**
   - Run: `npm install`
   - Check if all packages are installed

### Testing the API

Run the test script to verify everything is working:
```bash
node test-api.js
```

### Health Check

Check if the server is running:
```bash
curl http://localhost:3000/health
```

## 📁 Project Structure

```
ratan-decor-backend/
├── config/
│   └── database.js          # Database configuration
├── product/
│   ├── models.js           # Product model
│   ├── productController.js # Product controller
│   └── routes.js           # Product routes
├── category/
│   ├── models.js           # Category model
│   ├── categoryController.js # Category controller
│   └── routes.js           # Category routes
├── userType/
│   ├── models.js           # UserType model
│   ├── userTypeController.js # UserType controller
│   └── routes.js           # UserType routes
├── server.js               # Main server file
├── setup.js               # Setup script
├── test-api.js            # API test script
└── package.json           # Dependencies
```

## 🛠️ Development

### Available Scripts
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run setup` - Setup environment configuration
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with initial data

### Environment Variables
Create a `.env` file with:
```env
DB_NAME=ratan_decor
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=3306
PORT=3000
NODE_ENV=development
```

## 📝 API Examples

### Create a Product
```bash
curl -X POST http://localhost:3000/api/product/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Unique Product Name",
    "price": 150.75,
    "description": "Product description",
    "userTypeId": 1,
    "categoryId": 1
  }'
```

### Get All Products
```bash
curl http://localhost:3000/api/product/all
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 