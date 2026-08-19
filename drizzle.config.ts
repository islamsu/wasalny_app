import { defineConfig } from "drizzle-kit";

const connectionString = process.env.WASALNY_DATABASE_URL;
if (!connectionString) {
  throw new Error("WASALNY_DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
