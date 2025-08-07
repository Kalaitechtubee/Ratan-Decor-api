const express = require("express");
const dotenv = require("dotenv");
const sequelize = require("./config/database");
const seedUserTypes = require("./userType/seedDefaultUserTypes");
const seedCategoriesAndSubcategories = require("./category/seedCategories");
const customerTypeRoutes = require('./customerType/routes');
const productUsageTypeRoutes = require('./productUsageType/routes');
const productRoutes = require('./product/routes');
const authRoutes = require("./auth/routes");
const authMiddleware = require("./auth/middleware");
dotenv.config();
const app = express();

app.use(express.json());

app.use("/api/category", require("./category/routes"));
app.use("/api/subcategory", require("./subcategory/routes"));

app.use("/api/product", authMiddleware, productRoutes);

app.use("/api/userType", require("./userType/routes"));
app.use('/api/customer-types', customerTypeRoutes);
app.use('/api/product-usage-types', productUsageTypeRoutes);
app.use("/api/auth", authRoutes);
// app.use('/api/products', productRoutes); // Removed duplicate/conflicting route

sequelize.authenticate()
  .then(() => console.log("✅ DB Connected"))
  .catch(err => console.error("❌ DB Error:", err));


sequelize.sync({ alter: false })
  .then(async () => {
    console.log("✅ Models Synced");
    try {
      await seedUserTypes();
      await seedCategoriesAndSubcategories(); // ✅ Seeds 4 default categories
    } catch (err) {
      console.error("❌ Seeding error:", err);
    }
  })
  .catch(err => console.error("❌ Sync Error:", err));

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.\nError may be related to: app.use("/api/product", require("./product/routes")); // ✅ correct path`);
  } else {
    console.error('❌ Server error:', err);
  }
});