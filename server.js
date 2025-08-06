const express = require("express");
const dotenv = require("dotenv");
const sequelize = require("./config/database");
const seedUserTypes = require("./userType/seedDefaultUserTypes");
const seedCategoriesAndSubcategories = require("./category/seedCategories");

dotenv.config();
const app = express();
app.use("/api/category", require("./category/routes"));
app.use("/api/subcategory", require("./subcategory/routes"));
app.use("/api/product", require("./product/routes")); // ✅ correct path
app.use(express.json());

app.use("/api/userType", require("./userType/routes"));

sequelize.authenticate()
  .then(() => console.log("✅ DB Connected"))
  .catch(err => console.error("❌ DB Error:", err));

sequelize.sync({ alter: true })
  .then(async () => {
    console.log("✅ Models Synced");
    await seedUserTypes();
    await seedCategoriesAndSubcategories(); // ✅ Seeds 4 default categories
  })
  .catch(err => console.error("❌ Sync Error:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
