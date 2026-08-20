module.exports = {
  dialect: "postgresql",
  schema: "./db/index.js",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/visa_reminder",
  },
  breakpoints: true,
  verbose: true,
  strict: true,
};
