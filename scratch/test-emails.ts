import fs from "fs";
import path from "path";

// Load .env.local manually
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    console.log("Loading environment variables from .env.local...");
    const envConfig = fs.readFileSync(envPath, "utf-8");
    for (const line of envConfig.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    }
  } else {
    console.warn(".env.local not found in current directory");
  }
} catch (e: any) {
  console.error("Failed to load .env.local:", e.message);
}

import { sendTaskAssignedEmail, sendTaskCompletedEmail } from "../src/lib/task-notifications";

async function run() {
  const ownerEmail = process.env.OWNER_EMAIL || "info@pristinecleanersoc.com";
  const managerEmail = process.env.OPERATIONS_MANAGER_EMAIL || "carlos@pristinecleanersoc.com";

  console.log(`Using credentials:`);
  console.log(`GMAIL_USER: ${process.env.GMAIL_USER}`);
  console.log(`OWNER_GMAIL_USER: ${process.env.OWNER_GMAIL_USER || "(not set in .env.local)"}`);
  console.log(`OWNER_EMAIL (Recipient): ${ownerEmail}`);
  console.log(`OPERATIONS_MANAGER_EMAIL (Recipient): ${managerEmail}`);

  const testTask = {
    id: "test-task-123",
    title: "Test Task Assignment & Completion",
    dueDate: "2026-06-30",
    frequency: "One-time",
    priority: "High",
    sourceSection: "Debug/Test",
    assignedTo: "Carlos Lopez",
    assignedBy: "System Test",
    description: "This is a diagnostic test to verify that email notifications work correctly.",
  };

  const completedBy = {
    name: "Carlos Lopez",
    role: "Operations Manager",
    email: managerEmail,
  };

  const owner = {
    name: "Jake Ivan-Pal",
    role: "Owner",
    email: ownerEmail,
  };

  console.log("\n--- Sending Task Assigned email to Operations Manager... ---");
  const assignedResult = await sendTaskAssignedEmail(testTask, completedBy);
  console.log("Assigned Result:", assignedResult);

  console.log("\n--- Sending Task Completed email to Owner... ---");
  const completedResult = await sendTaskCompletedEmail(testTask, completedBy, owner);
  console.log("Completed Result:", completedResult);
}

run().catch((err) => {
  console.error("Error running email test:", err);
});
