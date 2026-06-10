import { createClient } from "@supabase/supabase-js";

const url1 = "https://lfgjyrytlavoequltefm.supabase.co";
const key1 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmZ2p5cnl0bGF2b2VxdWx0ZWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNjc3NjQsImV4cCI6MjA5Mzc0Mzc2NH0.eLFze09BFvVI4wEUL0zTg_QL7vO6I5YNCYY-5iohG7I";

const url2 = "https://lfgjyrtlavoqutlefm.supabase.co";
const key2 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmZ2p5cnl0bGF2b2VxdWx0ZWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNjc3NjQsImV4cCI6MjA5Mzc0Mzc2NH0.eLFze09BFvVI4wEUL0zTg_QL7vO6I5YNCYY-5iohG7I"; // Wait, is the key the same?

async function testUrl(url: string, key: string, name: string) {
  try {
    const supabase = createClient(url, key);
    const { data: staff, error } = await supabase.from("staff_members").select("*");
    if (error) {
      console.log(`${name} failed:`, error.message);
    } else {
      console.log(`${name} succeeded, found ${staff?.length} staff members.`);
    }
  } catch (e: any) {
    console.log(`${name} threw error:`, e.message);
  }
}

async function main() {
  await testUrl(url1, key1, "URL 1 (.env.local)");
  await testUrl(url2, key2, "URL 2 (.env.local.save)");
}

main().catch(console.error);
