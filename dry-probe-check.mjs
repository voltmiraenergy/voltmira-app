import fs from "fs";
import { createClient } from "@supabase/supabase-js";
for (const line of fs.readFileSync(".env.local","utf8").split(/\r?\n/)) {
  const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
}
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
let page=1, probe=null;
while(page<=10){ const {data}=await admin.auth.admin.listUsers({page,perPage:200});
  const us=data?.users||[]; probe=probe||us.find(u=>/@example\.com$/i.test(u.email||"")); if(us.length<200) break; page++; }
const {data:prof}=await admin.from("profiles").select("id,email,company_id,role").eq("id",probe.id).maybeSingle();
console.log("probe profile:", JSON.stringify(prof));
const {data:co}=await admin.from("companies").select("id,name").eq("id",prof?.company_id).maybeSingle();
console.log("its company:", JSON.stringify(co));
const {data:mates}=await admin.from("profiles").select("email").eq("company_id",prof?.company_id);
console.log("company members:", (mates||[]).map(m=>m.email).join(", "));
const {data:projs}=await admin.from("projects").select("id,title,client_name,owner_id,company_id,created_at")
  .or("title.ilike.%Casa Rece%,title.ilike.%Vila Tacuta%");
console.log("seeded-looking projects:", JSON.stringify(projs,null,1));
const {data:props}=await admin.from("proposals").select("id,slug,project_id,company_id").in("slug",["stale001","stale002"]);
console.log("seeded proposals:", JSON.stringify(props,null,1));
