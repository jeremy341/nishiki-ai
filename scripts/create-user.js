// Creates a login for your friend (or resets its password).
//   npm run user:add -- AB            create user "ab" (you will be asked for a password)
//   npm run user:add -- AB --admin    create an admin user
//   npm run user:passwd -- AB         reset the password of an existing user
import readline from "node:readline";
import { db } from "../server/db.js";
import { hashPassword } from "../server/security.js";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const admin = args.includes("--admin");
const username = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();

if (!username || !/^[a-z0-9_-]{2,20}$/.test(username)) {
  console.error("Usage: npm run user:add -- <initials, 2-20 letters/digits>  [--admin]");
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = rl._writeToOutput;
    rl._writeToOutput = (text) => {
      if (text.includes(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl._writeToOutput = write;
      rl.output.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

const password = await askHidden("New password (min. 8 characters): ");
if (password.length < 8) {
  console.error("Password too short. Use at least 8 characters.");
  process.exit(1);
}
const again = await askHidden("Repeat password: ");
if (again !== password) {
  console.error("Passwords do not match.");
  process.exit(1);
}

const hash = hashPassword(password);
const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);

if (reset) {
  if (!existing) {
    console.error(`No user "${username}".`);
    process.exit(1);
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, existing.id);
  // Log the user out everywhere after a password reset.
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
  console.log(`Password for "${username}" reset. Existing sessions were signed out.`);
} else {
  if (existing) {
    console.error(`User "${username}" already exists. Use npm run user:passwd to reset its password.`);
    process.exit(1);
  }
  db.prepare("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)")
    .run(username, hash, admin ? 1 : 0);
  console.log(`User "${username}" created${admin ? " (admin)" : ""}.`);
}
