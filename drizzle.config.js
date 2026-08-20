require("dotenv").config({ path: ".env" });

module.exports = {
  dialect: "postgresql",
  schema: "./db/index.js",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  breakpoints: true,
  verbose: true,
  strict: true,
};
