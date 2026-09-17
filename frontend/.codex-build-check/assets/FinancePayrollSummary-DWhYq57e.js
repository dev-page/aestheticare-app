import{e as y,l as G,i as e,I as U,J as q,t as c,F as j,v as M,j as T,r as f,q as W,u as Y,B as J,L as w,c as g,o as u}from"./vue-core-BoUYJLMF.js";import{b as Q,G as B,a as X,o as Z,h as N,q as S,f as D,M as tt,l as et,e as H,d as R,w as k}from"./firebase-477fOLMT.js";import{O as st}from"./OwnerSidebar-Bwf-PX6x.js";import{_ as ot}from"./index-C5FKyh5d.js";import"./BaseCollapsibleSidebar-C4B97nOC.js";import"./ui-D6OJfzeu.js";const at={name:"FinancePayrollSummary",components:{OwnerSidebar:st},setup(){const x=Q(B()),a=X(B()),p=f(""),l=f([]),v=f([]),P=f([]),b=f(new Date().toISOString().slice(0,7)),r=t=>t?.toDate?t.toDate():null,_=t=>t?`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}`:"",h=t=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",currencyDisplay:"code"}).format(Number(t||0)),$=g(()=>{const t={};return v.value.forEach(s=>{t[s.id]=s}),t}),C=g(()=>{const t={};return l.value.forEach(s=>{const n=r(s.createdAt);if(_(n)!==b.value)return;const o=s.employeeId||s.employeeName||s.id;if(!t[o]){const d=$.value[s.employeeId]||{};t[o]={employeeId:s.employeeId||o,employeeName:s.employeeName||`${d.firstName||""} ${d.lastName||""}`.trim()||"Unknown",position:d.role||d.jobTitle||"-",basicSalary:0,commission:0,totalSalary:0}}const i=Number(s.hourlyRate||0)*Number(s.hoursWorked||0);t[o].basicSalary+=i,t[o].commission+=Number(s.commission||0),t[o].totalSalary+=Number(s.totalPay||0)}),Object.values(t).sort((s,n)=>n.totalSalary-s.totalSalary)}),E=g(()=>C.value.reduce((t,s)=>t+Number(s.totalSalary||0),0)),F=t=>{if(!t)return"-";if(t?.toDate)return t.toDate().toLocaleDateString("en-PH");if(t?.seconds)return new Date(t.seconds*1e3).toLocaleDateString("en-PH");const s=new Date(t);return Number.isNaN(s.getTime())?"-":s.toLocaleDateString("en-PH")},O=t=>{const s=t.deductions||{},n=Object.entries(s).map(([i,d])=>{const m=Number(typeof d=="object"?d.amount||0:d||0);return`<tr><td style="padding:8px 0;color:#4b5563;">${i}</td><td style="padding:8px 0;text-align:right;">${h(m)}</td></tr>`}).join(""),o=Object.entries(t.earnings||{}).map(([i,d])=>`<tr><td style="padding:8px 0;color:#4b5563;">${i}</td><td style="padding:8px 0;text-align:right;">${h(d)}</td></tr>`).join("");return`
        <html>
          <head>
            <title>Payslip - ${t.employeeName||"Employee"}</title>
            <style>
              @page { size: A4; margin: 16mm; }
              body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
              .sheet { padding: 0; }
              .header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:24px; }
              .brand { font-size: 18px; font-weight: 700; }
              .muted { color: #6b7280; font-size: 12px; }
              .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
              .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 12px; color: #374151; }
              table { width: 100%; border-collapse: collapse; }
              td { font-size: 13px; border-bottom: 1px solid #f3f4f6; }
              .summary { display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
              .summary .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
              .summary .box p { margin: 0; font-size: 12px; color: #6b7280; }
              .summary .box h3 { margin: 6px 0 0; font-size: 15px; }
              .accent { color: #b45309; }
              .green { color: #047857; }
            </style>
          </head>
          <body>
            <div class="sheet">
              <div class="header">
                <div>
                  <div class="brand">Approved Payslip</div>
                  <div class="muted">${t.branchName||"Clinic Branch"}</div>
                </div>
                <div class="muted" style="text-align:right">
                  <div><strong>Employee:</strong> ${t.employeeName||"-"}</div>
                  <div><strong>Position:</strong> ${t.position||"-"}</div>
                  <div><strong>Period:</strong> ${t.payPeriod||b.value}</div>
                  <div><strong>Generated:</strong> ${t.generatedLabel||"-"}</div>
                </div>
              </div>

              <div class="card">
                <div class="section-title">Earnings</div>
                <table>
                  ${o||'<tr><td style="padding:8px 0;color:#6b7280;">No earnings entries.</td><td></td></tr>'}
                </table>
              </div>

              <div class="card">
                <div class="section-title">Deductions</div>
                <table>
                  ${n||'<tr><td style="padding:8px 0;color:#6b7280;">No deductions entries.</td><td></td></tr>'}
                </table>
              </div>

              <div class="summary">
                <div class="box">
                  <p>Total Earnings</p>
                  <h3 class="accent">${h(t.totalEarnings||0)}</h3>
                </div>
                <div class="box">
                  <p>Total Deductions</p>
                  <h3>${h(t.totalDeductions||0)}</h3>
                </div>
                <div class="box">
                  <p>Net Pay</p>
                  <h3 class="green">${h(t.netPay||0)}</h3>
                </div>
              </div>
            </div>
          </body>
        </html>
      `},z=async t=>{if(t?.employeeId)try{const[s,n]=await Promise.all([N(S(D(x,"users",t.employeeId,"payslips"),tt("dateGenerated","desc"),et(1))),H(R(x,"users",t.employeeId))]),o=s.empty?null:s.docs[0].data()||{},i=n.exists()?n.data()||{}:{},d={employeeName:o?.employeeName||t.employeeName||`${i.firstName||""} ${i.lastName||""}`.trim()||"Employee",position:o?.jobTitle||t.position||i.role||i.jobTitle||"-",branchName:i.clinicBranch||i.branchName||"Clinic Branch",payPeriod:o?.payPeriod||b.value,generatedLabel:F(o?.dateGenerated||o?.createdAt),earnings:o?.earnings||{basicSalary:t.basicSalary||0,commission:t.commission||0,total:t.totalSalary||0},deductions:o?.deductions||{},totalEarnings:o?.totalEarnings??t.totalSalary??0,totalDeductions:o?.totalDeductions??0,netPay:o?.netPay??t.totalSalary??0};o||w.info("No saved payslip found for this employee yet. Printing the payroll summary values instead.");const m=window.open("","_blank","width=900,height=700");if(!m){w.error("Popup blocked. Please allow popups to print the payslip.");return}m.document.open(),m.document.write(O(d)),m.document.close(),m.focus(),m.print()}catch(s){console.error("Failed to print approved payslip:",s),w.error("Unable to print the approved payslip.")}},A=g(()=>P.value.reduce((t,s)=>{const n=r(s.createdAt);return _(n)!==b.value?t:t+Number(s.amount||0)},0)),L=g(()=>A.value>0?E.value/A.value*100:0),V=g(()=>{const t={};return l.value.forEach(s=>{const n=r(s.createdAt),o=_(n);o&&(t[o]||(t[o]={monthKey:o,label:new Date(`${o}-01`).toLocaleDateString("en-PH",{month:"long",year:"numeric"}),total:0,employees:new Set}),t[o].total+=Number(s.totalPay||0),t[o].employees.add(s.employeeId||s.employeeName||s.id))}),Object.values(t).map(s=>({...s,employeeCount:s.employees.size})).sort((s,n)=>s.monthKey<n.monthKey?1:-1)}),K=async()=>{if(!p.value)return;const[t,s,n]=await Promise.all([N(S(D(x,"payrolls"),k("branchId","==",p.value))),N(S(D(x,"users"),k("branchId","==",p.value),k("userType","==","Staff"))),N(S(D(x,"transactions"),k("branchId","==",p.value)))]);l.value=t.docs.map(o=>({id:o.id,...o.data()})),v.value=s.docs.map(o=>({id:o.id,...o.data()})).filter(o=>!o.archived),P.value=n.docs.map(o=>({id:o.id,...o.data()}))};let I=null;return W(()=>{I=Z(a,async t=>{if(!t){p.value="",l.value=[],v.value=[],P.value=[];return}const s=await H(R(x,"users",t.uid));if(p.value=s.exists()&&s.data().branchId||"",!p.value){w.error("Your account has no branch assignment.",{toastId:"missing-branch-assignment"});return}await K()})}),Y(()=>{I&&I()}),{payrolls:l,selectedMonth:b,monthlyPayrollRows:C,monthlyPayrollTotal:E,payrollVsRevenuePercent:L,payrollHistory:V,formatCurrency:h,printApprovedPayslip:z}}},lt={class:"flex module-theme bg-slate-900 min-h-screen"},rt={class:"flex-1 p-8"},nt={class:"mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4"},it={class:"grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"},dt={class:"bg-slate-800 rounded-xl p-6 border border-slate-700"},ct={class:"text-3xl font-bold text-rose-400"},pt={class:"bg-slate-800 rounded-xl p-6 border border-slate-700"},mt={class:"text-3xl font-bold text-white"},yt={class:"bg-slate-800 rounded-xl p-6 border border-slate-700"},ut={class:"text-3xl font-bold text-white"},xt={class:"bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-6"},bt={class:"overflow-x-auto"},ht={class:"w-full"},gt={class:"divide-y divide-slate-700"},ft={class:"px-6 py-4 text-white"},vt={class:"px-6 py-4 text-slate-300"},Pt={class:"px-6 py-4 text-slate-300"},_t={class:"px-6 py-4 text-slate-300"},wt={class:"px-6 py-4 text-rose-400 font-semibold"},Nt={class:"px-6 py-4"},St=["disabled","onClick"],Dt={key:0},kt={key:1},It={class:"bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"},Ct={class:"overflow-x-auto"},Et={class:"w-full"},At={class:"divide-y divide-slate-700"},jt={class:"px-6 py-4 text-white"},Mt={class:"px-6 py-4 text-slate-300"},Tt={class:"px-6 py-4 text-rose-400 font-semibold"},Bt={key:0};function Ht(x,a,p,l,v,P){const b=J("OwnerSidebar");return u(),y("div",lt,[G(b),e("main",rt,[e("div",nt,[a[2]||(a[2]=e("div",null,[e("h1",{class:"text-3xl font-bold text-white mb-2"},"Payroll Summary"),e("p",{class:"text-slate-400"},"Monitor labor costs and payroll trends for finance control.")],-1)),e("div",null,[a[1]||(a[1]=e("label",{class:"block text-slate-400 text-sm mb-2"},"Payroll Month",-1)),U(e("input",{"onUpdate:modelValue":a[0]||(a[0]=r=>l.selectedMonth=r),type:"month",class:"bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"},null,512),[[q,l.selectedMonth]])])]),e("div",it,[e("div",dt,[a[3]||(a[3]=e("p",{class:"text-slate-400 text-sm"},"Payroll Total (Month)",-1)),e("p",ct,c(l.formatCurrency(l.monthlyPayrollTotal)),1)]),e("div",pt,[a[4]||(a[4]=e("p",{class:"text-slate-400 text-sm"},"Employees Paid",-1)),e("p",mt,c(l.monthlyPayrollRows.length),1)]),e("div",yt,[a[5]||(a[5]=e("p",{class:"text-slate-400 text-sm"},"Payroll vs Revenue",-1)),e("p",ut,c(l.payrollVsRevenuePercent.toFixed(2))+"%",1)])]),e("div",xt,[a[9]||(a[9]=e("div",{class:"px-6 py-4 border-b border-slate-700"},[e("h2",{class:"text-lg font-semibold text-white"},"Monthly Payroll Details")],-1)),e("div",bt,[e("table",ht,[a[8]||(a[8]=e("thead",{class:"bg-slate-700"},[e("tr",null,[e("th",{class:"px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"},"Employee"),e("th",{class:"px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"},"Position"),e("th",{class:"px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"},"Basic Salary"),e("th",{class:"px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"},"Commission"),e("th",{class:"px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"},"Total Salary"),e("th",{class:"px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"},"Action")])],-1)),e("tbody",gt,[(u(!0),y(j,null,M(l.monthlyPayrollRows,r=>(u(),y("tr",{key:r.employeeId,class:"hover:bg-slate-700/50 transition-colors"},[e("td",ft,c(r.employeeName),1),e("td",vt,c(r.position),1),e("td",Pt,c(l.formatCurrency(r.basicSalary)),1),e("td",_t,c(l.formatCurrency(r.commission)),1),e("td",wt,c(l.formatCurrency(r.totalSalary)),1),e("td",Nt,[e("button",{type:"button",class:"rounded-lg border border-amber-500/60 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/10",disabled:!r.employeeId,onClick:_=>l.printApprovedPayslip(r)}," Print Payslip ",8,St)])]))),128)),l.payrolls.length===0?(u(),y("tr",Dt,[...a[6]||(a[6]=[e("td",{colspan:"6",class:"px-6 py-8 text-center text-slate-400"},"No payroll records available.",-1)])])):l.monthlyPayrollRows.length===0?(u(),y("tr",kt,[...a[7]||(a[7]=[e("td",{colspan:"6",class:"px-6 py-8 text-center text-slate-400"},"No payroll records for selected month.",-1)])])):T("",!0)])])])]),e("div",It,[a[12]||(a[12]=e("div",{class:"px-6 py-4 border-b border-slate-700"},[e("h2",{class:"text-lg font-semibold text-white"},"Payroll History by Month")],-1)),e("div",Ct,[e("table",Et,[a[11]||(a[11]=e("thead",{class:"bg-slate-700"},[e("tr",null,[e("th",{class:"px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"},"Month"),e("th",{class:"px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"},"Employees"),e("th",{class:"px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"},"Payroll Total")])],-1)),e("tbody",At,[(u(!0),y(j,null,M(l.payrollHistory,r=>(u(),y("tr",{key:r.monthKey,class:"hover:bg-slate-700/50 transition-colors"},[e("td",jt,c(r.label),1),e("td",Mt,c(r.employeeCount),1),e("td",Tt,c(l.formatCurrency(r.total)),1)]))),128)),l.payrollHistory.length===0?(u(),y("tr",Bt,[...a[10]||(a[10]=[e("td",{colspan:"3",class:"px-6 py-8 text-center text-slate-400"},"No payroll history available.",-1)])])):T("",!0)])])])])])])}const Vt=ot(at,[["render",Ht]]);export{Vt as default};
