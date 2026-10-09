import "dotenv/config";
import { connectDatabase, migrate } from "./db.js";
const db = connectDatabase();
try {
  await migrate(db);
  console.log("Migrations complete");
} finally {
  await db.destroy();
}
