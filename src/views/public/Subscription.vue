<template>
  <section class="subscription-shell">
    <div class="subscription-glow subscription-glow-left"></div>
    <div class="subscription-glow subscription-glow-right"></div>

    <div class="subscription-popup">
      <div class="popup-top">
        <div class="popup-copy">
          <p class="popup-eyebrow">AesthetiCare Plans</p>
          <h2 class="popup-title">Choose Your Plan</h2>
          <p class="popup-subtitle">
            Start with what fits your clinic today. You can always upgrade as your operations grow.
          </p>
        </div>

        <div class="popup-aside">
          <div class="aside-pill">Flexible monthly setup</div>
          <p class="aside-copy">Compare access, team scale, and branch support before you continue.</p>
        </div>
      </div>

      <p v-if="error" class="popup-error">{{ error }}</p>

      <div class="plan-grid">
        <button
          v-for="plan in plans"
          :key="plan.id"
          type="button"
          class="plan-card group"
          :class="[
            planCardClass(plan),
            { 'plan-card-active': selectedPlan === plan.id }
          ]"
          @click="selectedPlan = plan.id"
        >
          <span v-if="selectedPlan === plan.id" class="plan-selected-badge">Selected</span>
          <span class="plan-orb"></span>
          <span class="card-shine"></span>

          <div class="plan-card-top">
            <div>
              <p class="plan-kicker">{{ planKicker(plan) }}</p>
              <p class="plan-name">{{ plan.name }}</p>
            </div>
          </div>

          <div class="plan-price-wrap">
            <p class="plan-price">{{ plan.priceLabel }}</p>
            <span class="plan-cycle">{{ plan.cycleLabel || plan.cycle || '-' }}</span>
          </div>

          <p class="plan-desc">{{ plan.description }}</p>
          <p class="plan-caption">{{ planCaption(plan) }}</p>

          <ul class="plan-features">
            <li v-for="item in plan.features" :key="item">{{ item }}</li>
          </ul>

          <div class="plan-footer">
            <span class="plan-select-indicator">
              {{ selectedPlan === plan.id ? "Selected plan" : "Click to select" }}
            </span>
          </div>
        </button>
      </div>

      <div class="popup-actions">
        <button type="button" class="btn-secondary" @click="maybeLater">Maybe Later</button>
        <button type="button" class="btn-primary" @click="continueWithPlan">
          {{ ctaLabel }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebaseConfig";
import {
  buildSubscriptionPlanCatalog,
  filterActiveSubscriptionPlans,
} from "@/utils/subscriptionPlans";

const router = useRouter();

const plans = ref([]);
const error = ref("");
const selectedPlan = ref("free");
let unsubscribePlans = null;

const defaultPlans = () => [
  {
    id: "free",
    name: "Free Plan",
    price: 0,
    billingCycle: "trial",
    description: "Try the platform before choosing a paid plan.",
    features: ["Core modules", "Limited users", "Email support"],
    trialDays: 14,
    isActive: true,
  },
  {
    id: "basic",
    name: "Basic",
    price: "PHP 999",
    cycle: "/month",
    description: "For single-branch clinics with streamlined daily operations.",
    features: ["Scheduling & billing", "Staff management", "Reports"],
    trialDays: 0,
    isActive: true,
    recommended: false,
  },
  {
    id: "premium",
    name: "Premium",
    price: "PHP 2499",
    cycle: "/month",
    description: "For multi-branch clinics that need complete operational control.",
    features: ["Everything in Basic", "Advanced analytics", "Priority support"],
    trialDays: 0,
    isActive: true,
    recommended: true,
  },
];

const loadPlans = async () => {
  error.value = "";
  try {
    if (unsubscribePlans) {
      unsubscribePlans();
      unsubscribePlans = null;
    }
    unsubscribePlans = onSnapshot(
      collection(db, "subscriptionPlans"),
      (snapshot) => {
        const merged = buildSubscriptionPlanCatalog(defaultPlans(), snapshot.docs);
        plans.value = filterActiveSubscriptionPlans(merged);

        if (!plans.value.some((plan) => plan.id === selectedPlan.value)) {
          selectedPlan.value = plans.value[0]?.id || "free";
        }
      },
      (err) => {
        console.error("Failed to load public subscription plans:", err);
        error.value = "Unable to load latest plans right now.";
        plans.value = filterActiveSubscriptionPlans(buildSubscriptionPlanCatalog(defaultPlans(), []));
      }
    );
  } catch (err) {
    console.error("Failed to start public subscription listener:", err);
    error.value = "Unable to load latest plans right now.";
    plans.value = filterActiveSubscriptionPlans(buildSubscriptionPlanCatalog(defaultPlans(), []));
  }
};

const selectedPlanData = computed(() => plans.value.find((plan) => plan.id === selectedPlan.value) || null);

const ctaLabel = computed(() => {
  const current = selectedPlanData.value;
  if (!current) return "Continue";
  return `Continue with ${current.name}`;
});

const continueWithPlan = () => {
  router.push({ name: "login" });
};

const maybeLater = () => {
  router.push({ path: "/" });
};

const planCardClass = (plan) => {
  if (plan.id === "free-trial" || plan.id === "free") return "plan-card-free";
  if (plan.id === "basic") return "plan-card-basic";
  if (plan.id === "premium") return "plan-card-premium";
  return "plan-card-premium";
};

const planKicker = (plan) => {
  if (plan.id === "free-trial" || plan.id === "free") return "For first-time clinics";
  if (plan.id === "basic") return "For growing clinics";
  if (plan.id === "premium") return "For full operations";
  return plan.recommended ? "Featured option" : "Flexible option";
};

const planCaption = (plan) => {
  if (plan.id === "free-trial" || plan.id === "free") return "A no-cost starting point for exploring the platform.";
  if (plan.id === "basic") return "Best fit for clinics focusing on daily bookings, staffing, and reporting.";
  if (plan.id === "premium") return "Built for teams that need deeper visibility, support, and multi-branch control.";
  return "A saved custom plan configured in Setup Plans.";
};

onMounted(loadPlans);

onBeforeUnmount(() => {
  if (unsubscribePlans) {
    unsubscribePlans();
    unsubscribePlans = null;
  }
});
</script>

<style scoped>
.subscription-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.38), transparent 28%),
    radial-gradient(circle at 82% 12%, rgba(198, 148, 108, 0.2), transparent 24%),
    linear-gradient(180deg, #fffdf8 0%, #fbf4e8 52%, #f7eddc 100%);
  padding: clamp(0.9rem, 2vw, 1.4rem);
}

.subscription-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(60px);
  opacity: 0.5;
  pointer-events: none;
}

.subscription-glow-left {
  top: 3rem;
  left: -4rem;
  width: 14rem;
  height: 14rem;
  background: rgba(238, 194, 139, 0.45);
}

.subscription-glow-right {
  right: -2rem;
  bottom: 3rem;
  width: 12rem;
  height: 12rem;
  background: rgba(180, 109, 58, 0.18);
}

.subscription-popup {
  position: relative;
  z-index: 1;
  max-width: 1460px;
  margin: 0 auto;
  padding: clamp(0.8rem, 1.4vw, 1.1rem);
}

.popup-top {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.popup-copy {
  max-width: 780px;
}

.popup-eyebrow {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.24em;
  color: #a56b44;
  margin-bottom: 0.5rem;
}

.popup-title {
  font-family: "Bodoni Moda", "Playfair Display", "Times New Roman", serif;
  font-size: clamp(2rem, 3.7vw, 3.35rem);
  line-height: 0.94;
  letter-spacing: -0.04em;
  color: #4a2c1e;
  margin: 0;
}

.popup-subtitle {
  margin-top: 0.45rem;
  color: #6d513d;
  font-size: 0.94rem;
  max-width: 720px;
  line-height: 1.5;
}

.popup-aside {
  align-self: flex-start;
  width: min(100%, 320px);
  border: 1px solid rgba(198, 148, 108, 0.22);
  border-radius: 1.4rem;
  background: rgba(255, 255, 255, 0.58);
  backdrop-filter: blur(14px);
  padding: 0.8rem 0.9rem;
  box-shadow: 0 10px 24px rgba(104, 67, 42, 0.07);
}

.aside-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.38rem 0.72rem;
  background: rgba(159, 105, 70, 0.08);
  color: #8f5c3d;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.aside-copy {
  margin-top: 0.55rem;
  color: #7a5e4a;
  font-size: 0.84rem;
  line-height: 1.45;
}

.popup-error {
  margin: -0.25rem 0 1rem;
  color: #b91c1c;
  font-size: 0.92rem;
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.85rem;
}

.plan-card {
  position: relative;
  overflow: hidden;
  text-align: left;
  border-radius: 1.45rem;
  border: 1px solid rgba(198, 148, 108, 0.32);
  min-height: 100%;
  padding: 1.05rem 1rem 0.95rem;
  transition: transform 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease;
}

.plan-selected-badge {
  position: absolute;
  top: 0.9rem;
  right: 0.9rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.38rem 0.72rem;
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.88);
  color: #6f3f2a;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  box-shadow: 0 8px 18px rgba(87, 49, 27, 0.12);
}

.plan-card:hover {
  transform: translateY(-4px);
  border-color: rgba(173, 108, 68, 0.56);
}

.plan-card-active {
  transform: translateY(-4px);
  border-width: 3px;
  box-shadow: 0 20px 40px rgba(111, 63, 42, 0.14);
}

.plan-card-free {
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.18), transparent 24%),
    linear-gradient(145deg, #f7f2ea 0%, #ede1cf 52%, #dac4a6 100%);
  box-shadow: 0 18px 34px rgba(116, 89, 63, 0.12);
}

.plan-card-free .plan-name,
.plan-card-free .plan-price,
.plan-card-free .plan-desc,
.plan-card-free .plan-features,
.plan-card-free .plan-caption,
.plan-card-free .plan-cycle,
.plan-card-free .plan-kicker,
.plan-card-free .plan-select-indicator {
  color: #4d3426;
}

.plan-card-basic {
  background:
    radial-gradient(circle at top right, rgba(255, 247, 236, 0.18), transparent 24%),
    linear-gradient(145deg, #eec79c 0%, #ddac75 48%, #c68b58 100%);
  box-shadow: 0 22px 42px rgba(168, 107, 58, 0.17);
}

.plan-card-basic .plan-name,
.plan-card-basic .plan-price,
.plan-card-basic .plan-desc,
.plan-card-basic .plan-features,
.plan-card-basic .plan-caption,
.plan-card-basic .plan-cycle,
.plan-card-basic .plan-kicker,
.plan-card-basic .plan-select-indicator {
  color: #fff9ee;
}

.plan-card-premium {
  border-color: rgba(185, 112, 56, 0.78);
  background:
    radial-gradient(circle at top right, rgba(255, 221, 170, 0.16), transparent 22%),
    linear-gradient(145deg, #f1a24e 0%, #ce7634 44%, #8f4321 100%);
  box-shadow: 0 24px 48px rgba(127, 58, 26, 0.22);
}

.plan-card-premium .plan-name,
.plan-card-premium .plan-price,
.plan-card-premium .plan-desc,
.plan-card-premium .plan-features,
.plan-card-premium .plan-caption,
.plan-card-premium .plan-cycle,
.plan-card-premium .plan-kicker,
.plan-card-premium .plan-select-indicator {
  color: #fff7ea;
}

.plan-orb {
  position: absolute;
  top: -48px;
  right: -18px;
  width: 120px;
  height: 120px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3), transparent 66%);
  opacity: 0.55;
  pointer-events: none;
}

.card-shine {
  pointer-events: none;
  position: absolute;
  inset: 0;
  transform: translateX(-120%);
  background: linear-gradient(110deg, transparent 28%, rgba(255, 255, 255, 0.38) 52%, transparent 76%);
  transition: transform 0.7s ease;
}

.group:hover .card-shine {
  transform: translateX(120%);
}

.plan-card-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.plan-kicker {
  margin: 0 0 0.35rem;
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: #9d6947;
}

.plan-name {
  font-size: 1.22rem;
  font-family: "Bodoni Moda", "Playfair Display", "Times New Roman", serif;
  font-weight: 700;
  color: #3b281d;
}

.plan-price-wrap {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  margin-top: 0.8rem;
}

.plan-price {
  margin: 0;
  font-size: clamp(1.7rem, 2.9vw, 2.5rem);
  line-height: 0.96;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: #6f3f2a;
}

.plan-cycle {
  font-size: 0.84rem;
  font-weight: 600;
  color: #8f6a51;
}

.plan-desc {
  position: relative;
  z-index: 1;
  margin-top: 0.55rem;
  font-size: 0.9rem;
  color: #614837;
  line-height: 1.4;
}

.plan-caption {
  position: relative;
  z-index: 1;
  margin-top: 0.4rem;
  font-size: 0.78rem;
  color: #8a6851;
  line-height: 1.4;
}

.plan-features {
  position: relative;
  z-index: 1;
  margin-top: 0.75rem;
  display: grid;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: #4a3528;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.24);
}

.plan-features li::before {
  content: "\2713";
  color: #9f6946;
  margin-right: 0.55rem;
  font-weight: 700;
}

.plan-card-basic .plan-features li::before,
.plan-card-premium .plan-features li::before {
  color: rgba(255, 250, 238, 0.92);
}

.plan-footer {
  position: relative;
  z-index: 1;
  margin-top: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.plan-select-indicator {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #8d664b;
}

.popup-actions {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.btn-secondary,
.btn-primary {
  width: 100%;
  border-radius: 1rem;
  padding: 0.82rem 1rem;
  font-weight: 700;
  transition: all 0.2s ease;
}

.btn-secondary {
  border: 1px solid rgba(198, 148, 108, 0.4);
  color: #7b4e35;
  background: rgba(255, 255, 255, 0.62);
}

.btn-secondary:hover {
  background: rgba(255, 248, 235, 0.92);
  transform: translateY(-1px);
}

.btn-primary {
  border: 1px solid transparent;
  color: #fff;
  background: linear-gradient(120deg, #9f6946 0%, #7b4e35 100%);
}

.btn-primary:hover {
  filter: brightness(1.03);
  transform: translateY(-1px);
}

@media (min-width: 768px) {
  .subscription-popup {
    padding: 1rem 1.2rem 1.3rem;
  }

  .plan-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .popup-actions {
    flex-direction: row;
    justify-content: flex-end;
    align-items: center;
  }

  .btn-secondary {
    width: 165px;
  }

  .btn-primary {
    width: 285px;
  }
}

@media (min-width: 1024px) {
  .plan-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .popup-top {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}
</style>
