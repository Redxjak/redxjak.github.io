import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.55.0/+esm";

const SUPABASE_URL = "https://msowbrvpziigoqlpqfuu.supabase.co";
const SUPABASE_KEY = "sb_publishable_P2OwC3HhT1lj75Lq7dQkDw_k6zDJGEb";
const DASHBOARD_URL = "https://redxjak.com/analytics/?auth=20260828";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const $ = (selector) => document.querySelector(selector);
let report = null;
let selectedDays = 30;

const labels = { active_users:"Active users",new_accounts:"New accounts",new_cliques:"New Cliques",grub_hunts:"GrubHunts",swipes:"Swipes",matches:"Matches",messages:"Chat messages",accounts:"Accounts",cliques:"Cliques",active_grub_hunts:"Active GrubHunts",completed_grub_hunts:"Completed GrubHunts",likes:"Likes",accepted_friendships:"Friendships" };
function message(text=""){$("#login-message").textContent=text;$("#dashboard-message").textContent=text}
function metricCards(values){return Object.entries(values).map(([key,value])=>{const card=document.createElement("article");card.className="metric-card";const number=document.createElement("strong");number.textContent=Number(value).toLocaleString();const label=document.createElement("span");label.textContent=labels[key]||key.replaceAll("_"," ");card.append(number,label);return card})}
function renderChart(){const metric=$("#chart-metric").value;const values=report.daily.map(day=>Number(day[metric]||0));const max=Math.max(...values,1);$("#chart").replaceChildren(...report.daily.map((day,index)=>{const wrap=document.createElement("div");wrap.className="bar-wrap";const bar=document.createElement("div");bar.className="bar";bar.style.height=`${Math.max((values[index]/max)*100,values[index]?3:1)}%`;bar.title=`${new Date(`${day.date}T00:00:00`).toLocaleDateString()}: ${values[index].toLocaleString()} ${labels[metric]||metric}`;wrap.append(bar);return wrap}))}
function render(){ $("#updated").textContent=`Updated ${new Date(report.generated_at).toLocaleString()} · ${report.days}-day view`;$("#period-cards").replaceChildren(...metricCards(report.period));$("#total-cards").replaceChildren(...metricCards(report.totals));renderChart() }
async function loadReport(){message("Loading report…");const {data,error}=await supabase.rpc("get_reporting_analytics",{days_back:selectedDays});if(error){message(error.message?.includes("Analytics access")?"This account is not authorized to view analytics.":"The report could not be loaded.");return}report=data;message();render()}
async function setSession(session){const signedIn=Boolean(session);$("#login-view").classList.toggle("hidden",signedIn);$("#dashboard-view").classList.toggle("hidden",!signedIn);$("#sign-out").classList.toggle("hidden",!signedIn);$("#account-label").textContent=signedIn?session.user.email||"Signed in":"";if(signedIn)await loadReport()}
$("#login-form").addEventListener("submit",async(event)=>{event.preventDefault();message();const {error}=await supabase.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});if(error)message("The email or password is incorrect.")});
$("#google-login").addEventListener("click",async()=>{const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:DASHBOARD_URL}});if(error)message("Google sign-in could not be opened.")});
$("#sign-out").addEventListener("click",()=>supabase.auth.signOut());
document.querySelectorAll("[data-days]").forEach(button=>button.addEventListener("click",async()=>{selectedDays=Number(button.dataset.days);document.querySelectorAll("[data-days]").forEach(item=>item.classList.toggle("active",item===button));await loadReport()}));
$("#chart-metric").addEventListener("change",renderChart);
supabase.auth.onAuthStateChange((_event,session)=>setSession(session));
const {data}=await supabase.auth.getSession();await setSession(data.session);
