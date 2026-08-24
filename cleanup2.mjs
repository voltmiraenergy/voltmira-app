import fs from "fs";
import { createClient } from "@supabase/supabase-js";
for (const line of fs.readFileSync(".env.local","utf8").split(/\r?\n/)) {
  const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
}
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
// Every account this session created ends in @example.com. Real users are @gmail.com.
let page=1, targets=[];
while(page<=10){
  const { data } = await admin.auth.admin.listUsers({ page, perPage:200 });
  const us = data?.users||[];
  targets.push(...us.filter(u=>/@example\.com$/i.test(u.email||"")));
  if(us.length<200) break; page++;
}
console.log("probe accounts (@example.com):", targets.length);
const cos=new Set();
for(const u of targets){
  const { data: prof } = await admin.from("profiles").select("company_id").eq("id",u.id).maybeSingle();
  if(prof?.company_id) cos.add(prof.company_id);
  await admin.from("profiles").delete().eq("id",u.id);
  const { error } = await admin.auth.admin.deleteUser(u.id);
  console.log("  removed", u.email, error?("(auth: "+error.message+")"):"");
}
for(const c of cos){
  const { count } = await admin.from("profiles").select("id",{count:"exact",head:true}).eq("company_id",c);
  if((count||0)===0){
    await admin.from("proposals").delete().eq("company_id",c);
    await admin.from("activity").delete().eq("company_id",c);
    await admin.from("projects").delete().eq("company_id",c);
    await admin.from("leads").delete().eq("company_id",c);
    await admin.from("companies").delete().eq("id",c);
    console.log("  removed empty company", c);
  }
}
const { data: profs } = await admin.from("profiles").select("email");
const { data: comps } = await admin.from("companies").select("id");
console.log("leftover @example.com profiles:", (profs||[]).filter(p=>/@example\.com$/i.test(p.email||"")).length);
console.log("totals now:", (profs||[]).length, "profiles |", (comps||[]).length, "companies");
