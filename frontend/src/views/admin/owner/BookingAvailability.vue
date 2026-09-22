<template>
  <div class="flex min-h-screen bg-slate-900 text-white owner-theme"><OwnerSidebar /><main class="flex-1 p-6 md:p-8"><div class="mx-auto max-w-5xl">
    <h1 class="text-3xl font-bold">Booking Availability</h1><p class="mt-2 text-slate-400">Set the recurring times customers can book with each practitioner. This is separate from HR shifts.</p>
    <section class="mt-7 rounded-2xl border border-slate-700 bg-slate-800 p-5"><div class="grid gap-4 md:grid-cols-2"><label class="text-sm">Branch<select v-model="branchId" class="field"><option value="">Select branch</option><option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option></select></label><label class="text-sm">Practitioner<select v-model="employeeId" class="field" :disabled="!branchId"><option value="">Select practitioner</option><option v-for="p in practitioners" :key="p.id" :value="p.id">{{ p.fullName }}</option></select></label></div>
      <div v-if="employeeId" class="mt-6 space-y-3"><article v-for="day in days" :key="day" class="grid items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3 md:grid-cols-[130px_1fr_1fr]"><label class="flex items-center gap-2 font-medium"><input v-model="availability[day].enabled" type="checkbox">{{ day }}</label><input v-model="availability[day].start" type="time" :disabled="!availability[day].enabled" class="field m-0"><input v-model="availability[day].end" type="time" :disabled="!availability[day].enabled" class="field m-0"></article></div>
      <div class="mt-6 flex justify-end"><button class="rounded-lg bg-amber-600 px-5 py-2 font-semibold hover:bg-amber-500 disabled:opacity-50" :disabled="!employeeId || saving" @click="save">{{ saving ? 'Saving…' : 'Save availability' }}</button></div>
    </section>
  </div></main></div>
</template>
<script setup>
import { onMounted, ref, watch } from 'vue'
import { collection, doc, getDocs, getDoc, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']; const branches=ref([]), practitioners=ref([]), branchId=ref(''), employeeId=ref(''), saving=ref(false)
const blank=()=>Object.fromEntries(days.map(d=>[d,{enabled:false,start:'09:00',end:'17:00'}])); const availability=ref(blank())
const nameOf=d=>String(d.fullName||`${d.firstName||''} ${d.lastName||''}`).trim()||d.email||'Practitioner'
const loadBranches=async()=>{const uid=auth.currentUser?.uid;if(!uid)return;const s=await getDocs(query(collection(db,'clinics'),where('ownerId','==',uid)));branches.value=s.docs.map(x=>({id:x.id,name:x.data().clinicBranch||x.data().clinicName||'Branch'}));if(branches.value.length===1)branchId.value=branches.value[0].id}
const loadPractitioners=async()=>{practitioners.value=[];employeeId.value='';if(!branchId.value)return;const s=await getDocs(query(collection(db,'users'),where('branchId','==',branchId.value)));practitioners.value=s.docs.map(x=>({id:x.id,...x.data(),fullName:nameOf(x.data())})).filter(x=>!['inactive','disabled','archived'].includes(String(x.status||'').toLowerCase()) && !String(x.userType||'').toLowerCase().includes('customer'))}
const load=async()=>{availability.value=blank();if(!employeeId.value)return;const s=await getDoc(doc(db,'users',employeeId.value,'schedules','recurring'));if(s.exists()&&s.data().availability){availability.value=Object.fromEntries(days.map(d=>[d,{...availability.value[d],...(s.data().availability[d]||{})}]))}}
const save=async()=>{for(const d of days){const x=availability.value[d];if(x.enabled&&(!x.start||!x.end||x.end<=x.start))return toast.error(`Enter a valid time range for ${d}.`)} saving.value=true;try{const p=practitioners.value.find(x=>x.id===employeeId.value);await setDoc(doc(db,'users',employeeId.value,'schedules','recurring'),{employeeId:employeeId.value,employeeName:p?.fullName||'',branchId:branchId.value,recurring:true,type:'recurring',availability:availability.value,updatedAt:serverTimestamp()},{merge:true});toast.success('Booking availability saved.')}catch(e){toast.error('Failed to save booking availability.')}finally{saving.value=false}}
watch(branchId,loadPractitioners);watch(employeeId,load);onMounted(loadBranches)
</script>
<style scoped>.field{display:block;width:100%;margin-top:.5rem;border:1px solid #475569;border-radius:.5rem;background:#0f172a;padding:.6rem .75rem;color:#fff}</style>
