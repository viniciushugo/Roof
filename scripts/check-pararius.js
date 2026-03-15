require("dotenv").config()
const { createClient } = require("@supabase/supabase-js")
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function check() {
  const { data } = await sb.from("listings").select("title, image_url, external_id").eq("source", "Pararius").eq("is_active", true)
  const noImg = data.filter(r => !r.image_url || r.image_url === "")
  const withImg = data.filter(r => r.image_url && r.image_url !== "")
  const hosted = withImg.filter(r => r.image_url.includes("supabase"))
  console.log("Total Pararius:", data.length)
  console.log("No image:", noImg.length)
  console.log("With image:", withImg.length, "(hosted:", hosted.length, ")")
  noImg.slice(0, 5).forEach(r => console.log("  Missing:", r.title, "| url:", JSON.stringify(r.image_url)))
}
check()
