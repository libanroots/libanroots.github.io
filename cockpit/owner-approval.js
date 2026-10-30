import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.0?bundle";
const URL="https://tjndgzmstayfxtxbbegd.supabase.co";
const KEY="sb_publishable_n7DqWxKseFOMLviJMdGbJg_YY2VMRAi";
const client=createClient(URL,KEY,{auth:{experimental:{passkey:true},persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const el=id=>document.getElementById(id);
const say=s=>{el("message").textContent=String(s||"").slice(0,520)};
let capability=false, enabled=false, account=null;
const safeError=e=>e?.message?String(e.message).slice(0,200):"Operation unavailable";
async function checkPhone(){
  try {
    if(!window.isSecureContext||!window.PublicKeyCredential){capability=false;el("device-status").textContent="This browser does not expose secure passkeys.";return}
    capability=!!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    el("device-status").textContent=capability?"This phone supports a built-in passkey authenticator.":"No built-in passkey authenticator is available in this browser.";
  } catch {capability=false;el("device-status").textContent="Phone passkey support could not be verified.";}
  update();
}
async function refresh(){
  enabled=false;account=null;
  try{
    const r=await fetch(URL+"/auth/v1/settings",{headers:{apikey:KEY},cache:"no-store"});
    if(!r.ok)throw new Error("Auth settings unavailable");
    const data=await r.json();
    enabled=data.passkeys_enabled===true;
    el("passkey-status").textContent=enabled?"Supabase passkeys are enabled.":"Supabase passkeys are not enabled for this project. Registration is locked.";
  }catch(e){el("passkey-status").textContent="Authentication settings could not be verified. Registration is locked.";}
  try{
    const {data,error}=await client.auth.getUser();
    if(error||!data?.user){el("account-status").textContent="No verified phone account session. Sign in with your email.";account=null;}
    else{account=data.user;el("account-status").textContent=account.email_confirmed_at?"Email confirmed and signed in.":"Signed in, but email confirmation is still required.";el("email").value=account.email||el("email").value;}
  }catch{el("account-status").textContent="Account status unavailable.";account=null;}
  update();
}
function update(){
  const eligible=!!(enabled&&capability&&account?.email_confirmed_at&&!account?.is_anonymous);
  el("register").disabled=!eligible;
  el("overall").textContent="Final mission approval not connected";
  el("overall").className="state";
}
async function sendLink(){
 const email=el("email").value.trim();
 if(!/^\S+@\S+\.\S+$/.test(email)){say("Enter your email address first.");return}
 el("email-link").disabled=true;say("Sending sign-in email…");
 try{
   const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname}});
   if(error)throw error;
   say("Check your email for the secure sign-in link or verification code. Return to this page after confirming.");
 }catch(e){say("Sign-in could not be started: "+safeError(e))}
 finally{el("email-link").disabled=false}
}
async function verifyCode(){
 const email=el("email").value.trim(),token=el("code").value.trim();
 if(!/^\S+@\S+\.\S+$/.test(email)||!token){say("Enter your email and the verification code from the email.");return}
 el("verify-code").disabled=true;
 try{
   const {error}=await client.auth.verifyOtp({email,token,type:"email"});
   if(error)throw error;
   el("code").value="";say("Email verified. Checking passkey eligibility…");await refresh();
 }catch(e){say("Email verification failed: "+safeError(e))}
 finally{el("verify-code").disabled=false}
}
async function register(){
 if(el("register").disabled)return;
 el("register").disabled=true;say("Your phone will ask for fingerprint, face unlock, or screen lock. Only you should confirm this.");
 try {
   const {data,error}=await client.auth.registerPasskey();
   if(error)throw error;
   say("A passkey was registered for this sign-in account. This is NOT yet a SAMERAI mission approval. Final approval remains locked until the owner identity and approval issuer are verified.");
   el("passkey-status").textContent="Phone sign-in passkey registered; SAMERAI owner approval still locked.";
 }catch(e){say("Passkey was not enrolled: "+safeError(e))}
 finally{update()}
}
async function signout(){
 try{await client.auth.signOut();say("Signed out of the setup session.");await refresh()}
 catch(e){say("Sign out unavailable: "+safeError(e))}
}
el("check-device").addEventListener("click",checkPhone);
el("email-link").addEventListener("click",sendLink);
el("verify-code").addEventListener("click",verifyCode);
el("signout").addEventListener("click",signout);
el("register").addEventListener("click",register);
client.auth.onAuthStateChange(()=>{setTimeout(refresh,0)});
await Promise.all([checkPhone(),refresh()]);
say("Setup page connected to the existing SAMERAI authentication service. Owner approval remains locked.");
