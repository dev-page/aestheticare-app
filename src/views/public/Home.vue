<template>
  <div class="bg-gradient-to-br from-cream-100 via-gold-100 to-cream-200 text-charcoal-800 overflow-x-hidden">
    <nav class="public-glass-nav sticky top-0 inset-x-0 z-50">
      <div class="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 md:px-8 h-16">
        <router-link to="/" class="public-brand-cluster shrink-0">
          <span class="public-nav-mark" aria-hidden="true"></span>
          <span class="public-nav-brand text-lg sm:text-xl tracking-wide">
            AesthetiCare
          </span>
        </router-link>

        <ul class="hidden lg:flex items-center gap-6 lg:gap-10 text-[11px] tracking-[0.2em] uppercase text-charcoal-600">
          <li>
            <button @click="scrollToSection('features')" class="relative text-charcoal-700 hover:text-gold-700 hover:font-bold transition-all duration-300
                      before:absolute before:left-0 before:bottom-[-4px] before:w-0 before:h-[2px] before:bg-gold-700
                      before:transition-all before:duration-300 hover:before:w-full">
              Features
            </button>
          </li>

          <li>
            <button @click="scrollToSection('solutions')" class="relative text-charcoal-700 hover:text-gold-700 hover:font-bold transition-all duration-300
                      before:absolute before:left-0 before:bottom-[-4px] before:w-0 before:h-[2px] before:bg-gold-700
                      before:transition-all before:duration-300 hover:before:w-full">
              Solutions
            </button>
          </li>
          <li>
            <router-link to="/subscription-features" class="relative text-charcoal-700 hover:text-gold-700 hover:font-bold transition-all duration-300
                      before:absolute before:left-0 before:bottom-[-4px] before:w-0 before:h-[2px] before:bg-gold-700
                      before:transition-all before:duration-300 hover:before:w-full">
              Pricing
            </router-link>
          </li>
          <li>
            <router-link to="/centers"
              class="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-gold-500 text-gold-500 font-medium
                    hover:bg-gold-500 hover:text-white transition-all duration-300"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 11a2 2 0 110-4 2 2 0 010 4z"
                />
              </svg>
              Centers
            </router-link>
          </li>
        </ul>

        <div class="hidden lg:flex items-center gap-2 sm:gap-4">
          <router-link
            to="/login"
            class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-gold-700 text-gold-700 text-xs sm:text-sm tracking-widest uppercase hover:bg-gold-700 hover:text-white transition"
          >
            Login
          </router-link>
          <router-link
            to="/register"
            class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gold-700 text-white text-xs sm:text-sm tracking-widest uppercase hover:bg-gold-800 transition"
          >
            Register
          </router-link>
        </div>

        <button
          @click="isMobileMenuOpen = !isMobileMenuOpen"
          class="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg border border-gold-500/60 text-gold-700 hover:bg-gold-100 transition"
          aria-label="Toggle navigation menu"
        >
          <svg v-if="!isMobileMenuOpen" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <transition name="menu-overlay">
        <div
          v-if="isMobileMenuOpen"
          class="lg:hidden fixed inset-0 z-[60] bg-charcoal-900/40 backdrop-blur-[2px]"
          @click="closeMobileMenu"
        ></div>
      </transition>

      <transition name="sidebar-menu">
        <aside
          v-if="isMobileMenuOpen"
          class="lg:hidden fixed top-0 right-0 h-screen w-[84%] max-w-[340px] z-[70] bg-gradient-to-b from-gold-50 via-cream-100 to-gold-100 border-l border-gold-300/40 shadow-2xl flex flex-col"
        >
          <div class="h-16 px-4 flex items-center justify-between border-b border-gold-300/40">
            <span class="text-xs tracking-[0.24em] uppercase text-charcoal-700">Menu</span>
            <button
              @click="closeMobileMenu"
              class="inline-flex items-center justify-center h-9 w-9 rounded-md border border-gold-500/50 text-gold-700 hover:bg-gold-100 transition"
              aria-label="Close navigation menu"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 flex flex-col text-xs tracking-[0.2em] uppercase text-charcoal-700">
            <div class="flex flex-col gap-2">
              <button @click="scrollToSection('features'); closeMobileMenu()" class="py-2 border-b border-gold-200/70 text-left transition-all duration-200 hover:text-gold-700 hover:pl-1">Features</button>
              <button @click="scrollToSection('solutions'); closeMobileMenu()" class="py-2 border-b border-gold-200/70 text-left transition-all duration-200 hover:text-gold-700 hover:pl-1">Solutions</button>
              <router-link to="/subscription-features" @click="closeMobileMenu" class="py-2 border-b border-gold-200/70 transition-all duration-200 hover:text-gold-700 hover:pl-1">Pricing</router-link>
              <router-link to="/centers" @click="closeMobileMenu" class="py-2 border-b border-gold-200/70 transition-all duration-200 hover:text-gold-700 hover:pl-1">Centers</router-link>
            </div>

            <div class="mt-auto pt-6 flex flex-col gap-3">
              <router-link
                to="/login"
                @click="closeMobileMenu"
                class="px-4 py-3 rounded-full border border-gold-700 text-gold-700 text-center transition hover:bg-gold-50"
              >
                Login
              </router-link>
              <router-link
                to="/register"
                @click="closeMobileMenu"
                class="px-4 py-3 rounded-full bg-gold-700 text-white text-center transition hover:bg-gold-800"
              >
                Register
              </router-link>
            </div>
          </div>
        </aside>
      </transition>
    </nav>

    <section class="relative min-h-screen pt-20 sm:pt-24 md:pt-24 pb-16 overflow-hidden bg-gradient-to-tr from-cream-50 via-cream-100 to-gold-100">
      <svg class="hero-line hero-line-left-a hidden lg:block" viewBox="0 0 180 700" preserveAspectRatio="none">
        <path fill="none" stroke="#d7aa7d" stroke-width="2.2" stroke-opacity="0.22" d="M150,0 C96,95 82,210 112,322 C144,432 138,548 96,700" />
      </svg>
      <svg class="hero-line hero-line-left-b hidden lg:block" viewBox="0 0 160 620" preserveAspectRatio="none">
        <path fill="none" stroke="#c6946c" stroke-width="1.8" stroke-opacity="0.18" d="M120,0 C64,82 58,172 84,278 C106,372 98,492 66,620" />
      </svg>
      <svg class="hero-line hero-line-right-a hidden lg:block" viewBox="0 0 180 700" preserveAspectRatio="none">
        <path fill="none" stroke="#c6946c" stroke-width="2.2" stroke-opacity="0.2" d="M26,0 C80,110 98,220 70,332 C42,442 48,562 84,700" />
      </svg>
      <svg class="hero-line hero-line-right-b hidden lg:block" viewBox="0 0 160 620" preserveAspectRatio="none">
        <path fill="none" stroke="#e6c196" stroke-width="1.7" stroke-opacity="0.16" d="M38,0 C90,78 104,168 82,272 C60,370 68,500 96,620" />
      </svg>
      <svg class="hero-wave hidden md:block" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path fill="none" style="stroke: var(--color-gold-500);" stroke-width="4" stroke-opacity="0.34" d="M0,224 C180,160 320,288 500,224 C690,155 760,82 920,125 C1088,171 1214,288 1440,256" />
      </svg>

      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
        <div class="pt-2 lg:min-h-[610px] flex flex-col lg:justify-between">
          <div class="lg:flex-1 lg:flex lg:flex-col lg:justify-center">
            <p class="text-[11px] sm:text-xs tracking-[0.22em] uppercase text-gold-700 mb-3">Glow Naturally With</p>
            <h1 class="hero-editorial-title text-4xl sm:text-5xl md:text-[3.35rem] leading-tight mb-3">
              <span class="text-charcoal-800">AesthetiCare</span>
              <br />
              <span class="text-gold-700">Skin Solutions</span>
            </h1>
            <p class="text-charcoal-600 max-w-xl mb-6 text-sm sm:text-base leading-relaxed">
              Your skin deserves the best. Discover elegant, clinic-ready solutions crafted for modern aesthetic centers.
            </p>
            <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
              <router-link to="/register" class="bg-charcoal-900 text-cream-50 px-6 py-3 rounded-full text-xs sm:text-sm tracking-widest uppercase hover:bg-charcoal-800 transition w-full sm:w-auto text-center">
                Get Started
              </router-link>
              <router-link to="/subscription-features" class="px-6 py-3 rounded-full border border-gold-700 text-gold-700 text-xs sm:text-sm tracking-widest uppercase hover:bg-gold-700 hover:text-white transition w-full sm:w-auto text-center">
                View Plans
              </router-link>
            </div>
          </div>

          <div class="w-full max-w-xl rounded-2xl border border-gold-300/45 bg-cream-50/80 backdrop-blur-sm p-4 sm:p-5 shadow-[0_12px_24px_rgba(54,34,22,0.08)]">
            <p class="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-gold-700 mb-3">Clinic Essentials</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="relative overflow-hidden rounded-tl-[24px] rounded-tr-xl rounded-br-xl rounded-bl-[18px] border border-gold-200/55 bg-white/55 px-3 py-2.5 text-left">
                <p class="font-playfair text-base text-charcoal-900 leading-tight">Smart Scheduling</p>
                <p class="text-[11px] text-charcoal-600 mt-1">Bookings and reminders in one flow</p>
              </div>
              <div class="relative overflow-hidden rounded-t-[24px] rounded-b-[14px] border border-gold-200/55 bg-white/55 px-3 py-2.5 text-left">
                <p class="font-playfair text-base text-charcoal-900 leading-tight">Patient Journey</p>
                <p class="text-[11px] text-charcoal-600 mt-1">Track treatments from consult to follow-up</p>
              </div>
              <div class="relative overflow-hidden rounded-tr-[24px] rounded-tl-xl rounded-br-[18px] rounded-bl-xl border border-gold-200/55 bg-white/55 px-3 py-2.5 text-left">
                <p class="font-playfair text-base text-charcoal-900 leading-tight">Performance Insights</p>
                <p class="text-[11px] text-charcoal-600 mt-1">Clear metrics for clinics and med spas</p>
              </div>
            </div>
          </div>

        </div>

        <div class="relative">
          <div class="collage-grid mx-auto" role="img" aria-label="Aesthetic model collage">
            <div class="shape-card shape-top-left"></div>
            <div class="shape-card shape-top-right"></div>
            <div class="shape-card shape-bottom-right"></div>

            <div class="photo-card photo-main"></div>
            <div class="photo-card photo-detail-1"></div>
            <div class="photo-card photo-detail-2"></div>
            <div class="photo-card photo-detail-3"></div>
          </div>
        </div>
      </div>
    </section>

    <section id="features-section" class="relative h-[54vh] sm:h-[62vh] md:h-[72vh] overflow-hidden">
      <video
        v-if="showHeroVideo"
        class="absolute inset-0 w-full h-full object-cover"
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
        :poster="bg"
      >
        <source src="@/assets/home_vid.mp4" type="video/mp4" />
      </video>
      <div
        v-else
        class="absolute inset-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(${bg})` }"
      ></div>
      <div class="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,11,9,0.38)_0%,rgba(24,16,12,0.18)_34%,rgba(21,14,11,0.18)_66%,rgba(16,11,9,0.34)_100%)]"></div>
      <div class="absolute inset-0 bg-black/18"></div>
      <div class="relative z-10 h-full">
        <div class="mx-auto grid h-full max-w-7xl grid-cols-1 items-center px-4 sm:px-6 md:px-8 lg:grid-cols-[240px_minmax(0,1fr)_240px] lg:gap-8">
          <div class="hidden lg:flex flex-col gap-4 justify-center">
            <div class="video-feature-card video-feature-card-soft">
              <p class="video-feature-kicker">Treatment Focus</p>
              <h3 class="video-feature-title">Laser Precision</h3>
              <p class="video-feature-copy">Refined workflows for advanced skin, tone, and texture sessions.</p>
            </div>
            <div class="video-feature-card video-feature-card-soft">
              <p class="video-feature-kicker">Client Comfort</p>
              <h3 class="video-feature-title">Seamless Visits</h3>
              <p class="video-feature-copy">Guide every appointment with calm, premium, clinic-ready coordination.</p>
            </div>
          </div>

          <div class="flex flex-col items-center justify-center text-center px-4">
            <p class="video-showcase-kicker">Advanced aesthetic care</p>
            <h2 class="video-showcase-title">
              SOLACE AESTHETIQUE
            </h2>
            <p class="video-showcase-copy">
              Where precision meets beauty in every personalized aesthetic journey.
            </p>
          </div>

          <div class="hidden lg:flex flex-col gap-4 justify-center">
            <div class="video-feature-card video-feature-card-accent">
              <p class="video-feature-kicker">Signature Result</p>
              <h3 class="video-feature-title">Glow-First Care</h3>
              <p class="video-feature-copy">Tailored treatment paths designed for visible outcomes and patient trust.</p>
            </div>
            <div class="video-stat-card">
              <p class="video-stat-value">3k+</p>
              <p class="video-stat-label">beauty-led workflows supported inside AesthetiCare experiences</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SOLUTIONS -->
    <section id="solutions-section" class="solutions-section py-16 sm:py-24 md:py-32 text-charcoal-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div class="solutions-header text-center">
          <p class="solutions-kicker">Tailored platform modes</p>
          <h2 class="solutions-title">Built for the Aesthetic Industry</h2>
          <p class="solutions-subtitle">
            From boutique med spas to advanced laser centers, AesthetiCare adapts to the pace, treatments, and workflows each practice depends on.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          <div class="solution-card delay-0">
            <div class="solution-card-top">
              <span class="solution-step">01</span>
              <span class="solution-tag">Clinic Core</span>
            </div>
            <div class="solution-icon-wrap">
              <svg class="h-10 w-10 text-gold-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M5 20V7a2 2 0 012-2h10a2 2 0 012 2v13M9 20v-4h6v4M9 10h6M12 8v4M10 10h4" />
              </svg>
            </div>
            <h3 class="solution-title">Aesthetic Clinics</h3>
            <p class="solution-description">Tailored workflows and features designed specifically for this practice type.</p>
            <div class="solution-footer">
              <span class="solution-chip">Appointments</span>
              <span class="solution-chip">Treatment flow</span>
            </div>
          </div>

          <div class="solution-card delay-1">
            <div class="solution-card-top">
              <span class="solution-step">02</span>
              <span class="solution-tag">Luxury Service</span>
            </div>
            <div class="solution-icon-wrap solution-icon-wrap-rose">
              <svg class="h-10 w-10 text-gold-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M12 4c3 4 5 6.5 5 9a5 5 0 01-10 0c0-2.5 2-5 5-9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M17.5 7.5v3M16 9h3" />
              </svg>
            </div>
            <h3 class="solution-title">Med Spas</h3>
            <p class="solution-description">Tailored workflows and features designed specifically for this practice type.</p>
            <div class="solution-footer">
              <span class="solution-chip">Packages</span>
              <span class="solution-chip">Client retention</span>
            </div>
          </div>

          <div class="solution-card delay-2">
            <div class="solution-card-top">
              <span class="solution-step">03</span>
              <span class="solution-tag">Clinical Detail</span>
            </div>
            <div class="solution-icon-wrap solution-icon-wrap-cream">
              <svg class="h-10 w-10 text-gold-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M12 3l7 3v6c0 4.2-2.9 7.6-7 8.9C7.9 19.6 5 16.2 5 12V6l7-3z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M9 10.5c.8-.8 1.8-1.2 3-1.2s2.2.4 3 1.2M9.5 14h5" />
              </svg>
            </div>
            <h3 class="solution-title">Cosmetic Dermatology</h3>
            <p class="solution-description">Tailored workflows and features designed specifically for this practice type.</p>
            <div class="solution-footer">
              <span class="solution-chip">Clinical notes</span>
              <span class="solution-chip">Follow-ups</span>
            </div>
          </div>

          <div class="solution-card delay-3">
            <div class="solution-card-top">
              <span class="solution-step">04</span>
              <span class="solution-tag">Precision Tech</span>
            </div>
            <div class="solution-icon-wrap">
              <svg class="h-10 w-10 text-gold-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="6" stroke-width="1.7" />
                <circle cx="12" cy="12" r="2.2" stroke-width="1.7" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M12 3v3M12 18v3M3 12h3M18 12h3" />
              </svg>
            </div>
            <h3 class="solution-title">Laser & Skin Centers</h3>
            <p class="solution-description">Tailored workflows and features designed specifically for this practice type.</p>
            <div class="solution-footer">
              <span class="solution-chip">Device tracking</span>
              <span class="solution-chip">Outcome review</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="section-wave-divider" aria-hidden="true">
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="#fff8ed" d="M0,88 C190,128 360,34 560,62 C760,90 920,126 1120,92 C1268,66 1368,48 1440,58 L1440,120 L0,120 Z" />
      </svg>
    </div>

    <!-- FEATURES / PLATFORM CAPABILITIES SHOWCASE -->
    <section class="capability-section pb-16 pt-8 sm:pb-24 sm:pt-12 md:pb-32 md:pt-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div class="capability-header">
          <p class="capability-section-kicker">Designed for modern clinic teams</p>
          <h2 class="capability-section-title">Platform Capabilities</h2>
          <p class="capability-section-subtitle">
            Explore the operational systems that help aesthetic clinics streamline appointments, treatment visibility, inventory control, and growth decisions.
          </p>
        </div>

        <div
          class="capability-showcase"
          :class="{ 'is-switching': isCapabilitySwitching }"
          :style="{ backgroundImage: `url(${currentCapability.image})` }"
        >
          <div class="capability-showcase-overlay"></div>
          <div class="capability-showcase-sheen" aria-hidden="true"></div>

          <div class="capability-showcase-content" :key="`content-${currentCapabilityIndex}`">
            <p class="capability-eyebrow">{{ currentCapability.eyebrow }}</p>
            <h3 class="capability-showcase-title">{{ currentCapability.title }}</h3>
            <p class="capability-showcase-desc">{{ currentCapability.description }}</p>
          </div>

          <div class="capability-actions">
            <router-link to="/subscription-features" class="capability-btn-main">
              Explore
            </router-link>
            <button @click="prevCapability" class="capability-btn-icon" aria-label="Previous capability">&#8592;</button>
            <button @click="nextCapability" class="capability-btn-icon" aria-label="Next capability">&#8594;</button>
          </div>

          <div class="capability-rail-wrap" :class="{ 'is-switching': isMiniSwitching }">
            <button
              v-if="capabilities.length > 3"
              @click="prevMini"
              class="capability-rail-nav capability-rail-nav-left"
              aria-label="Previous mini cards"
            >
              &#8249;
            </button>

            <div class="capability-rail">
              <button
                v-for="item in visibleMiniCapabilities"
                :key="`${item.index}-${miniMotionTick}`"
                @click="setCapability(item.index)"
                class="capability-mini"
                :class="[{ 'is-active': item.index === currentCapabilityIndex }, { 'is-animating': isMiniSwitching }]"
                :style="{ animationDelay: `${item.offset * 70}ms` }"
              >
                <img :src="item.capability.image" :alt="item.capability.title" class="capability-mini-img" />
                <div class="capability-mini-overlay"></div>
                <div class="capability-mini-text">
                  <p class="capability-mini-eyebrow">{{ item.capability.miniEyebrow }}</p>
                  <p class="capability-mini-title">{{ item.capability.miniTitle }}</p>
                </div>
              </button>
            </div>

            <button
              v-if="capabilities.length > 3"
              @click="nextMini"
              class="capability-rail-nav capability-rail-nav-right"
              aria-label="Next mini cards"
            >
              &#8250;
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="section-wave-divider section-wave-divider-footer" aria-hidden="true">
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="#f8eedf" d="M0,88 C190,128 360,34 560,62 C760,90 920,126 1120,92 C1268,66 1368,48 1440,58 L1440,120 L0,120 Z" />
      </svg>
    </div>

    <!-- CTA + Footer -->
    <section class="footer-cta-section">
      <div class="footer-cta-shell">
        <div class="footer-cta-card">
          <div class="footer-cta-copy">
            <p class="footer-kicker">Launch with confidence</p>
            <h2 class="cta-title text-3xl sm:text-4xl md:text-5xl">Elevate Your Aesthetic Operations</h2>
            <p class="footer-cta-text">
              Join modern aesthetic centers using intelligent systems to manage bookings, treatment journeys, staff visibility, and clinic growth in one elegant platform.
            </p>
            <div class="footer-cta-actions">
              <router-link to="/register" class="footer-primary-btn">
                Register
              </router-link>
              <router-link to="/subscription-features" class="footer-secondary-btn">
                View Plans
              </router-link>
            </div>
            <div class="footer-cta-highlights">
              <span class="footer-highlight-chip">Free Plan available</span>
              <span class="footer-highlight-chip">Clinic-ready setup</span>
            </div>
          </div>

          <div class="footer-cta-side">
            <div class="footer-cta-qr" aria-label="Mobile application QR placeholder">
              <div class="footer-cta-qr-frame">
                <div class="footer-cta-qr-code">
                  <span>QR</span>
                </div>
              </div>
              <div class="footer-cta-qr-copy">
                <p class="footer-cta-qr-title">Mobile App</p>
                <p class="footer-cta-qr-note">QR placeholder</p>
              </div>
            </div>
          </div>
        </div>

        <footer class="site-footer">
          <div class="site-footer-grid">
            <div class="site-footer-brand">
              <div class="public-brand-cluster">
                <span class="public-nav-mark" aria-hidden="true"></span>
                <span class="public-nav-brand text-xl tracking-wide">AesthetiCare</span>
              </div>
              <p class="site-footer-copy">
                A refined platform for aesthetic clinics, med spas, and skin centers that want polished workflows and smarter operations.
              </p>
              <div class="site-footer-social">
                <a href="#" aria-label="Facebook (Coming Soon)" class="social-icon" title="Coming Soon">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.024 4.388 11.018 10.125 11.927v-8.44H7.078v-3.487h3.047V9.414c0-3.017 1.792-4.685 4.533-4.685 1.313 0 2.687.236 2.687.236v2.96h-1.514c-1.49 0-1.954.928-1.954 1.88v2.268h3.328l-.532 3.487h-2.796V24C19.612 23.09 24 18.097 24 12.073z"/>
                  </svg>
                </a>
                <a href="#" aria-label="Instagram (Coming Soon)" class="social-icon" title="Coming Soon">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.75 2h8.5A5.75 5.75 0 0122 7.75v8.5A5.75 5.75 0 0116.25 22h-8.5A5.75 5.75 0 012 16.25v-8.5A5.75 5.75 0 017.75 2zm0 1.7A4.05 4.05 0 003.7 7.75v8.5a4.05 4.05 0 004.05 4.05h8.5a4.05 4.05 0 004.05-4.05v-8.5a4.05 4.05 0 00-4.05-4.05h-8.5zM12 7.5A4.5 4.5 0 1112 16.5 4.5 4.5 0 0112 7.5zm0 1.7a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6zm4.85-2.2a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2z"/>
                  </svg>
                </a>
                <a href="#" aria-label="YouTube (Coming Soon)" class="social-icon" title="Coming Soon">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.5 7.2a3.1 3.1 0 00-2.2-2.2C19.4 4.5 12 4.5 12 4.5s-7.4 0-9.3.5A3.1 3.1 0 00.5 7.2 32.7 32.7 0 000 12a32.7 32.7 0 00.5 4.8 3.1 3.1 0 002.2 2.2c1.9.5 9.3.5 9.3.5s7.4 0 9.3-.5a3.1 3.1 0 002.2-2.2A32.7 32.7 0 0024 12a32.7 32.7 0 00-.5-4.8zM9.6 15.1V8.9l5.5 3.1-5.5 3.1z"/>
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <p class="site-footer-heading">Explore</p>
              <div class="site-footer-links">
                <router-link to="/" class="site-footer-link">Home</router-link>
                <router-link to="/subscription-features" class="site-footer-link">Pricing</router-link>
                <router-link to="/centers" class="site-footer-link">Centers</router-link>
              </div>
            </div>

            <div>
              <p class="site-footer-heading">Access</p>
              <div class="site-footer-links">
                <router-link to="/login" class="site-footer-link">Login</router-link>
                <router-link to="/register" class="site-footer-link">Create Account</router-link>
                <router-link to="/clinic/register" class="site-footer-link">Register Clinic</router-link>
              </div>
            </div>

            <div>
              <p class="site-footer-heading">Why Clinics Choose Us</p>
              <div class="site-footer-links">
                <span class="site-footer-note">Polished booking flow</span>
                <span class="site-footer-note">Treatment visibility</span>
                <span class="site-footer-note">Growth-ready operations</span>
              </div>
            </div>
          </div>

          <div class="site-footer-bottom">
            <p>© 2026 AesthetiCare. Designed for modern aesthetic practices.</p>
            <p class="site-footer-bottom-note">Social links are placeholders for now.</p>
          </div>
        </footer>
      </div>
    </section>

  </div>
</template>


<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useAuth } from "@/composables/useAuth";
import bg from '@/assets/bg.jpg'
import appointmentLanding from '@/assets/apointment_landing.jpg'
import inventoryLanding from '@/assets/inventory_landing.jpg'
import meetingRoomLanding from '@/assets/meetingroom_landing.jpg'
import staffInsightLanding from '@/assets/staffinsight_landing.jpg'

export default {
  name: "HomePage",
  setup() {
    const { user, isLoading, initAuth } = useAuth();
    const isMobileMenuOpen = ref(false);
    const showHeroVideo = ref(false);
    const currentCapabilityIndex = ref(3);
    const miniStartIndex = ref(3);
    const isCapabilitySwitching = ref(false);
    const isMiniSwitching = ref(false);
    const miniMotionTick = ref(0);
    let capabilityTimer = null;
    let capabilitySwitchTimer = null;
    let miniSwitchTimer = null;
    let heroVideoTimer = null;
    const closeMobileMenu = () => {
      isMobileMenuOpen.value = false;
    };

    const scrollToSection = (section) => {
      const sectionId = section === "solutions" ? "solutions-section" : "features-section";
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    watch(isMobileMenuOpen, (isOpen) => {
      document.body.style.overflow = isOpen ? "hidden" : "";
      document.documentElement.style.overflow = isOpen ? "hidden" : "";
    });
    
    const capabilities = [
      {
        eyebrow: "Aesthetic Center Workflow",
        title: "Smart Appointment Flow",
        description: "Automate bookings, assign practitioners, and reduce no-shows with reminders tuned for high-volume aesthetic clinics.",
        miniEyebrow: "Core System",
        miniTitle: "Appointments",
        image: appointmentLanding,
      },
      {
        eyebrow: "Clinical Precision",
        title: "Patient Treatment Timeline",
        description: "Document every procedure with photos, notes, consent history, and outcomes in one longitudinal treatment timeline.",
        miniEyebrow: "Patient Care",
        miniTitle: "Treatment Records",
        image: bg,
      },
      {
        eyebrow: "Operations Control",
        title: "Inventory and Product Tracking",
        description: "Track usage per service, monitor stock thresholds, and avoid treatment delays with real-time supply visibility.",
        miniEyebrow: "Clinic Ops",
        miniTitle: "Inventory",
        image: inventoryLanding,
      },
      {
        eyebrow: "Team Visibility",
        title: "Staff Performance Dashboard",
        description: "Review practitioner productivity, service completion rates, and schedule utilization across your branches.",
        miniEyebrow: "People",
        miniTitle: "Staff Insights",
        image: staffInsightLanding,
      },
      {
        eyebrow: "Growth Intelligence",
        title: "Revenue and Service Analytics",
        description: "Visualize top-performing services, monthly trends, and conversion metrics to guide better business decisions.",
        miniEyebrow: "Growth",
        miniTitle: "Analytics",
        image: meetingRoomLanding,
      },
    ];

    const currentCapability = computed(() => capabilities[currentCapabilityIndex.value]);

    const visibleMiniCapabilities = computed(() => {
      const total = capabilities.length;
      const windowSize = Math.min(3, total);
      return Array.from({ length: windowSize }, (_, offset) => {
        const index = (miniStartIndex.value + offset) % total;
        return { capability: capabilities[index], index, offset };
      });
    });

    const triggerCapabilityAnimation = () => {
      isCapabilitySwitching.value = true;
      if (capabilitySwitchTimer) window.clearTimeout(capabilitySwitchTimer);
      capabilitySwitchTimer = window.setTimeout(() => {
        isCapabilitySwitching.value = false;
      }, 440);
    };

    const triggerMiniAnimation = () => {
      miniMotionTick.value += 1;
      isMiniSwitching.value = true;
      if (miniSwitchTimer) window.clearTimeout(miniSwitchTimer);
      miniSwitchTimer = window.setTimeout(() => {
        isMiniSwitching.value = false;
      }, 380);
    };

    const ensureMiniContains = (index) => {
      const total = capabilities.length;
      if (total <= 3) return;
      const previousStart = miniStartIndex.value;
      const visible = visibleMiniCapabilities.value.map((item) => item.index);
      if (!visible.includes(index)) {
        miniStartIndex.value = index;
      }
      if (previousStart !== miniStartIndex.value) {
        triggerMiniAnimation();
      }
    };

    const setCapability = (index) => {
      currentCapabilityIndex.value = index;
      triggerCapabilityAnimation();
      ensureMiniContains(index);
    };

    const nextCapability = () => {
      currentCapabilityIndex.value = (currentCapabilityIndex.value + 1) % capabilities.length;
      triggerCapabilityAnimation();
      ensureMiniContains(currentCapabilityIndex.value);
    };

    const prevCapability = () => {
      currentCapabilityIndex.value = (currentCapabilityIndex.value - 1 + capabilities.length) % capabilities.length;
      triggerCapabilityAnimation();
      ensureMiniContains(currentCapabilityIndex.value);
    };

    const nextMini = () => {
      if (capabilities.length <= 3) return;
      miniStartIndex.value = (miniStartIndex.value + 1) % capabilities.length;
      triggerMiniAnimation();
    };

    const prevMini = () => {
      if (capabilities.length <= 3) return;
      miniStartIndex.value = (miniStartIndex.value - 1 + capabilities.length) % capabilities.length;
      triggerMiniAnimation();
    };

    onMounted(() => {
      initAuth()
      const revealHeroVideo = () => {
        showHeroVideo.value = true
      }

      if ('requestIdleCallback' in window) {
        heroVideoTimer = window.requestIdleCallback(revealHeroVideo, { timeout: 1500 })
      } else {
        heroVideoTimer = window.setTimeout(revealHeroVideo, 800)
      }

      capabilityTimer = window.setInterval(() => {
        nextCapability();
      }, 5000);
    });

    onBeforeUnmount(() => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      if (capabilityTimer) {
        window.clearInterval(capabilityTimer);
      }
      if (capabilitySwitchTimer) {
        window.clearTimeout(capabilitySwitchTimer);
      }
      if (miniSwitchTimer) {
        window.clearTimeout(miniSwitchTimer);
      }
      if (typeof window.cancelIdleCallback === 'function' && heroVideoTimer) {
        window.cancelIdleCallback(heroVideoTimer)
      } else if (heroVideoTimer) {
        window.clearTimeout(heroVideoTimer)
      }
    });

    return {
      bg,
      capabilities,
      currentCapability,
      currentCapabilityIndex,
      isCapabilitySwitching,
      isMiniSwitching,
      miniMotionTick,
      showHeroVideo,
      visibleMiniCapabilities,
      setCapability,
      nextCapability,
      prevCapability,
      nextMini,
      prevMini,
      scrollToSection,
      user,
      isLoading,
      isMobileMenuOpen,
      closeMobileMenu,
    };
  },
};
</script>

<style scoped>
body {
  font-family: "Playfair Display", serif;
}

.hero-editorial-title {
  font-family: "Bodoni Moda", "Playfair Display", "Times New Roman", serif;
  font-style: italic;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 0.96;
}

/* Parallax animation for blobs */
@keyframes parallaxSlow {
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(20px);
  }
  100% {
    transform: translateY(0px);
  }
}
.animate-parallaxSlow {
  animation: parallaxSlow 8s ease-in-out infinite;
}

/* Slide animations for any additional use */
@keyframes slide-in-left {
  0% {
    opacity: 0;
    transform: translateX(-50px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes slide-in-right {
  0% {
    opacity: 0;
    transform: translateX(50px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}
.animate-slide-in-left {
  animation: slide-in-left 1s forwards;
}
.animate-slide-in-right {
  animation: slide-in-right 1s forwards;
}

/* Base transition for capability slide */
.capability-text,
.capability-image {
  transition: transform 0.8s ease-out, opacity 0.8s ease-out;
}

/* Active state when in view */
.in-view {
  transform: translateX(0) !important;
  opacity: 1 !important;
}

.capability-section {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(circle at top center, rgba(241, 212, 170, 0.46), transparent 28%),
    linear-gradient(180deg, #fff8ed 0%, #fdf3e2 54%, #f8ead4 100%);
}
.capability-section::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: clamp(120px, 18vw, 190px);
  background:
    radial-gradient(ellipse at top center, rgba(255, 249, 241, 0.98) 0%, rgba(255, 248, 237, 0.9) 42%, rgba(255, 248, 237, 0) 100%);
  pointer-events: none;
}
.capability-section > .max-w-7xl {
  position: relative;
  z-index: 1;
}

.capability-header {
  max-width: 760px;
  margin: 0 auto 2.8rem;
  text-align: center;
}

.capability-section-kicker {
  margin: 0 0 0.8rem;
  font-size: 0.74rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a56b44;
}

.capability-section-title {
  margin: 0;
  font-family: "Bodoni Moda", "Playfair Display", serif;
  font-size: clamp(2.35rem, 4vw, 4.25rem);
  line-height: 0.98;
  font-style: italic;
  font-weight: 600;
  letter-spacing: -0.03em;
  background: linear-gradient(120deg, #92583a 0%, #c78558 50%, #a66747 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.capability-section-subtitle {
  margin: 1rem auto 0;
  max-width: 680px;
  color: rgba(84, 58, 41, 0.82);
  font-size: 0.98rem;
  line-height: 1.7;
}

.capability-showcase {
  position: relative;
  min-height: clamp(460px, 62vw, 590px);
  border-radius: 32px;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  border: 1px solid rgba(248, 229, 189, 0.42);
  box-shadow: 0 28px 56px rgba(78, 52, 36, 0.16);
  display: flex;
  align-items: stretch;
}
.capability-showcase.is-switching {
  animation: capabilityBackgroundPulse 0.44s ease;
}
.capability-showcase-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(98deg, rgba(46, 30, 20, 0.7) 0%, rgba(77, 52, 37, 0.52) 38%, rgba(77, 52, 37, 0.18) 64%, rgba(46, 30, 20, 0.62) 100%);
}
.capability-showcase-sheen {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(255, 249, 239, 0.16), transparent 24%),
    linear-gradient(120deg, transparent 48%, rgba(255, 248, 235, 0.08) 58%, transparent 68%);
  pointer-events: none;
}
.capability-showcase-content {
  position: relative;
  z-index: 2;
  width: min(56%, 660px);
  margin: clamp(1.35rem, 3vw, 2rem);
  align-self: center;
  padding: 0;
  color: #fff8eb;
  display: flex;
  flex-direction: column;
  justify-content: center;
  animation: capabilityContentIn 0.52s ease both;
}
.capability-eyebrow {
  font-size: 0.74rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: rgba(248, 229, 189, 0.95);
  margin-bottom: 0.9rem;
}
.capability-showcase-title {
  font-family: "Bodoni Moda", "Playfair Display", serif;
  font-size: clamp(2.6rem, 5.3vw, 5.5rem);
  line-height: 0.9;
  font-style: italic;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: -0.035em;
  margin: 0 0 1rem;
  text-wrap: balance;
  text-shadow: 0 10px 24px rgba(26, 16, 10, 0.28);
}
.capability-showcase-desc {
  max-width: 34rem;
  color: rgba(255, 248, 235, 0.9);
  font-size: clamp(1rem, 1.3vw, 1.15rem);
  line-height: 1.6;
  margin-bottom: 0;
}
.capability-actions {
  position: absolute;
  z-index: 3;
  left: clamp(28px, 3vw, 40px);
  bottom: clamp(24px, 3vw, 34px);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.capability-btn-main {
  border: 1px solid rgba(255, 248, 235, 0.34);
  background: rgba(255, 248, 235, 0.94);
  color: #342419;
  border-radius: 1rem;
  padding: 0.92rem 1.75rem;
  font-weight: 700;
  min-width: 7.75rem;
  transition: transform 0.24s ease, box-shadow 0.24s ease, background 0.24s ease;
  box-shadow: 0 12px 30px rgba(41, 26, 17, 0.14);
}
.capability-btn-main:hover {
  transform: translateY(-1px);
  background: #ffffff;
}
.capability-btn-icon {
  border: 1px solid rgba(255, 248, 235, 0.6);
  background: rgba(255, 248, 235, 0.12);
  color: #fff8eb;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  font-size: 1.2rem;
  line-height: 1;
  backdrop-filter: blur(10px);
  transition: transform 0.22s ease, background 0.22s ease;
}
.capability-btn-icon:hover {
  transform: translateY(-1px);
  background: rgba(255, 248, 235, 0.18);
}
.capability-rail-wrap {
  position: absolute;
  z-index: 2;
  right: clamp(16px, 2vw, 30px);
  bottom: clamp(18px, 2.4vw, 24px);
  width: min(38%, 448px);
}
.capability-rail-wrap.is-switching .capability-mini {
  animation: miniCardIn 0.38s ease both;
}
.capability-rail {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.capability-rail-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 248, 235, 0.65);
  background: rgba(52, 34, 24, 0.58);
  color: #fff8eb;
  font-size: 1.35rem;
  line-height: 1;
  backdrop-filter: blur(10px);
}
.capability-rail-nav-left {
  left: -2.9rem;
}
.capability-rail-nav-right {
  right: -2.9rem;
}
.capability-mini {
  position: relative;
  border: 1px solid rgba(255, 248, 235, 0.35);
  border-radius: 1.3rem;
  overflow: hidden;
  min-width: 0;
  min-height: 11.4rem;
  text-align: left;
  background: transparent;
  padding: 0;
  opacity: 0.82;
  transform: scale(0.98);
  box-shadow: 0 12px 28px rgba(29, 19, 13, 0.16);
  transition: opacity 0.22s ease, transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}
.capability-mini.is-active {
  opacity: 1;
  transform: scale(1);
  border-color: rgba(248, 229, 189, 0.85);
  box-shadow: 0 18px 36px rgba(29, 19, 13, 0.24);
}
.capability-mini-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}
.capability-mini.is-active .capability-mini-img {
  transform: scale(1.06);
}
.capability-mini-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(36, 24, 15, 0.04) 32%, rgba(36, 24, 15, 0.84) 100%);
}
.capability-mini-text {
  position: absolute;
  inset: auto 0.8rem 0.8rem 0.8rem;
  z-index: 2;
}
.capability-mini-eyebrow {
  color: rgba(255, 248, 235, 0.82);
  font-size: 0.63rem;
  letter-spacing: 0.08em;
  margin: 0 0 0.22rem;
}
.capability-mini-title {
  color: #fff8eb;
  font-weight: 700;
  font-size: 1.08rem;
  line-height: 1.05;
  margin: 0;
  text-shadow: 0 6px 16px rgba(26, 16, 10, 0.18);
}

@keyframes capabilityBackgroundPulse {
  0% { filter: saturate(0.9) brightness(0.86); }
  100% { filter: saturate(1) brightness(1); }
}
@keyframes capabilityContentIn {
  0% { opacity: 0; transform: translateY(18px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes miniCardIn {
  0% { opacity: 0; transform: translateY(12px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.solutions-section {
  position: relative;
  background:
    radial-gradient(circle at top center, rgba(241, 212, 170, 0.52), transparent 34%),
    linear-gradient(180deg, #fff9ef 0%, #fdf3e2 52%, #fbefdc 100%);
}

.solutions-header {
  max-width: 760px;
  margin: 0 auto 3rem;
}

.solutions-kicker {
  margin-bottom: 0.75rem;
  font-size: 0.74rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #a56b44;
}

.solutions-title {
  margin: 0;
  font-family: "Bodoni Moda", "Playfair Display", serif;
  font-size: clamp(2.25rem, 4vw, 4rem);
  line-height: 0.96;
  font-style: italic;
  font-weight: 600;
  letter-spacing: -0.03em;
  background: linear-gradient(120deg, #8a5237 0%, #c68457 52%, #a86444 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 8px 24px rgba(198, 148, 108, 0.18);
}

.solutions-subtitle {
  margin: 1rem auto 0;
  max-width: 640px;
  color: rgba(84, 58, 41, 0.86);
  font-size: 0.98rem;
  line-height: 1.65;
}

.solution-card {
  position: relative;
  overflow: hidden;
  border-radius: 1.75rem;
  border: 1px solid rgba(222, 181, 141, 0.44);
  background: linear-gradient(180deg, rgba(255, 252, 246, 0.96) 0%, rgba(255, 247, 236, 0.9) 100%);
  backdrop-filter: blur(12px);
  padding: 1.4rem 1.35rem 1.25rem;
  box-shadow: 0 20px 42px rgba(147, 104, 69, 0.12);
  transition: transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease;
}

.solution-card::before {
  content: "";
  position: absolute;
  inset: 0 auto auto 0;
  width: 100%;
  height: 5px;
  background: linear-gradient(90deg, rgba(233, 194, 143, 0.18), rgba(198, 148, 108, 0.45), rgba(233, 194, 143, 0.18));
  opacity: 0;
  transition: opacity 0.28s ease;
}

.solution-card:hover {
  transform: translateY(-6px);
  border-color: rgba(198, 148, 108, 0.55);
  box-shadow: 0 26px 46px rgba(147, 104, 69, 0.18);
}

.solution-card:hover::before {
  opacity: 1;
}

.solution-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 1.1rem;
}

.solution-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.95rem;
  background: rgba(249, 228, 211, 0.94);
  color: #8c4f31;
  font-size: 1rem;
  font-weight: 700;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.solution-tag {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #9f6946;
}

.solution-icon-wrap {
  width: 5.5rem;
  height: 5.5rem;
  margin: 0 auto 1.2rem;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top left, #fff8eb 0%, #f1d4aa 34%, #efd3ac 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75), 0 12px 24px rgba(198, 148, 108, 0.14);
  border: 1px solid rgba(214, 169, 123, 0.55);
}

.solution-icon-wrap-rose {
  background: radial-gradient(circle at top left, #fff8eb 0%, #f6cfbb 35%, #f1d4aa 100%);
}

.solution-icon-wrap-cream {
  background: radial-gradient(circle at top left, #fff8eb 0%, #fdf3e2 35%, #f1d4aa 100%);
}

.solution-title {
  margin: 0 0 0.65rem;
  font-family: "Bodoni Moda", "Playfair Display", serif;
  font-size: 1.45rem;
  font-weight: 600;
  line-height: 1.08;
  text-align: center;
  color: #3b281d;
}

.solution-description {
  margin: 0;
  min-height: 4.8rem;
  font-size: 0.96rem;
  line-height: 1.7;
  text-align: center;
  color: rgba(74, 53, 40, 0.88);
}

.solution-footer {
  margin-top: 1.15rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.55rem;
}

.solution-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.42rem 0.72rem;
  background: rgba(255, 248, 235, 0.9);
  border: 1px solid rgba(214, 169, 123, 0.34);
  color: #8d5e3f;
  font-size: 0.74rem;
  font-weight: 600;
}

/* Floating animation */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.animate-float {
  animation: float 4s ease-in-out infinite;
}

.section-wave-divider {
  position: relative;
  z-index: 1;
  margin-bottom: -2rem;
  line-height: 0;
  background: #fbefdc;
}
.section-wave-divider svg {
  display: block;
  width: 100%;
  height: 78px;
}
.section-wave-divider-footer {
  background: #f8ead4;
  margin-top: -1px;
  margin-bottom: -1px;
}

.footer-cta-section {
  position: relative;
  background: linear-gradient(180deg, #f8eedf 0%, #f4e4cf 48%, #eed7bc 100%);
  padding: clamp(3.5rem, 8vw, 5.5rem) 0 0;
}

.footer-cta-shell {
  width: 100%;
  margin: 0;
  position: relative;
  z-index: 1;
}

.footer-cta-card {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.2rem;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  border-radius: 0;
  border: none;
  background: transparent;
  padding:
    clamp(1.5rem, 4vw, 2.5rem)
    max(1rem, calc((100vw - 1180px) / 2 + 1rem))
    clamp(1.35rem, 3vw, 2rem);
  box-shadow: none;
}

.footer-kicker {
  margin-bottom: 0.7rem;
  font-size: 0.72rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #a56b44;
}

.footer-cta-text {
  margin-top: 1rem;
  max-width: 42rem;
  color: rgba(84, 58, 41, 0.84);
  font-size: 1rem;
  line-height: 1.7;
}

.footer-cta-actions {
  margin-top: 1.2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.footer-cta-highlights {
  margin-top: 1.05rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.footer-highlight-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.5rem 0.78rem;
  background: rgba(255, 248, 235, 0.86);
  border: 1px solid rgba(198, 148, 108, 0.24);
  color: #87593b;
  font-size: 0.78rem;
  font-weight: 600;
}

.footer-cta-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
}

.footer-primary-btn,
.footer-secondary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  border-radius: 1rem;
  padding: 0.95rem 1.15rem;
  font-size: 0.95rem;
  font-weight: 700;
  min-width: 230px;
  transition: transform 0.22s ease, background 0.22s ease, color 0.22s ease, border-color 0.22s ease;
}

.footer-primary-btn {
  border: 1px solid rgba(126, 78, 53, 0.24);
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 50%, #6e4330 100%);
  color: #fff8eb;
  box-shadow: 0 16px 34px rgba(111, 63, 42, 0.18);
}

.footer-primary-btn:hover {
  transform: translateY(-1px);
}

.footer-secondary-btn {
  border: 1px solid rgba(198, 148, 108, 0.34);
  background: rgba(255, 251, 244, 0.72);
  color: #7b4e35;
}

.footer-secondary-btn:hover {
  background: rgba(255, 248, 235, 0.95);
}

.footer-cta-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  width: 100%;
  max-width: 20rem;
  margin-left: auto;
}

.footer-cta-qr-frame {
  flex: 0 0 auto;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 1.8rem;
  border: 1px solid rgba(198, 148, 108, 0.28);
  background: rgba(255, 251, 244, 0.82);
  padding: 1.05rem;
}

.footer-cta-qr-code {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 1rem;
  border: 1px solid rgba(126, 78, 53, 0.16);
  background:
    linear-gradient(90deg, rgba(123, 78, 53, 0.1) 50%, transparent 50%) 0 0 / 1.05rem 1.05rem,
    linear-gradient(rgba(123, 78, 53, 0.1) 50%, transparent 50%) 0 0 / 1.05rem 1.05rem,
    linear-gradient(135deg, rgba(255, 248, 235, 0.98) 0%, rgba(242, 222, 196, 0.95) 100%);
  color: #7b4e35;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.22em;
}

.footer-cta-qr-copy {
  min-width: 0;
  text-align: center;
}

.footer-cta-qr-title,
.footer-cta-qr-note {
  margin: 0;
}

.footer-cta-qr-title {
  color: #6a4736;
  font-size: 0.96rem;
  font-weight: 700;
}

.footer-cta-qr-note {
  margin-top: 0.2rem;
  color: rgba(106, 71, 54, 0.72);
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.site-footer {
  margin-top: 1.1rem;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  border-radius: 0;
  border: none;
  background: linear-gradient(180deg, #6a4736 0%, #5a3d2f 100%);
  color: #f7eadf;
  padding: clamp(1.4rem, 3.6vw, 2rem) 0 clamp(1.1rem, 2.8vw, 1.5rem);
  box-shadow: none;
}

.site-footer-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 1.2rem;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 1rem;
}

.site-footer-brand {
  max-width: 23rem;
}

.site-footer-brand .public-nav-brand {
  background: linear-gradient(120deg, #fff8eb 0%, #f1d4aa 36%, #d7aa7d 70%, #fff8eb 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.site-footer-copy {
  margin-top: 1rem;
  color: rgba(247, 234, 223, 0.76);
  font-size: 0.9rem;
  line-height: 1.7;
}

.site-footer-social {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1rem;
}

.site-footer-heading {
  margin: 0 0 0.85rem;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(241, 212, 170, 0.82);
}

.site-footer-links {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.site-footer-link,
.site-footer-note {
  color: rgba(247, 234, 223, 0.78);
  font-size: 0.92rem;
  line-height: 1.45;
}

.site-footer-link {
  transition: color 0.2s ease, transform 0.2s ease;
}

.site-footer-link:hover {
  color: #fff8eb;
  transform: translateX(2px);
}

.site-footer-bottom {
  margin-top: 1.2rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 248, 235, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: rgba(247, 234, 223, 0.62);
  font-size: 0.82rem;
  max-width: 1180px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 1rem;
  padding-right: 1rem;
}

.site-footer-bottom-note {
  text-align: right;
}

/* Hero collage layout */
.hero-line {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}
.hero-line-left-a {
  top: 86px;
  left: 0;
  width: 170px;
  height: 76%;
}
.hero-line-left-b {
  top: 142px;
  left: 22px;
  width: 132px;
  height: 64%;
}
.hero-line-right-a {
  top: 92px;
  right: 0;
  width: 168px;
  height: 74%;
}
.hero-line-right-b {
  top: 156px;
  right: 20px;
  width: 130px;
  height: 62%;
}
.hero-wave {
  position: absolute;
  inset: auto 0 42px 0;
  width: 100%;
  height: 220px;
  z-index: 1;
}
.collage-grid {
  position: relative;
  width: clamp(320px, 40vw, 500px);
  height: clamp(410px, 52vw, 610px);
  isolation: isolate;
}
.shape-card {
  position: absolute;
  border-radius: 24px;
  background: linear-gradient(145deg, var(--color-gold-300) 0%, var(--color-gold-600) 100%);
  box-shadow: 0 12px 28px rgba(54, 34, 22, 0.12);
  opacity: 0.6;
}
.shape-top-left {
  left: 12px;
  top: 38px;
  width: 118px;
  height: 98px;
}
.shape-top-right {
  right: 12px;
  top: 26px;
  width: 122px;
  height: 108px;
}
.shape-bottom-right {
  right: 12px;
  bottom: 22px;
  width: 112px;
  height: 96px;
}
.photo-card {
  position: absolute;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 16px 34px rgba(54, 34, 22, 0.18);
  background-image: url("../../assets/home_picture.jpg");
  background-repeat: no-repeat;
  background-color: var(--color-cream-100);
  transition: transform 0.25s ease;
}
.photo-card:hover {
  transform: translateY(-3px);
}
.photo-main {
  left: 70px;
  top: 52px;
  width: 320px;
  height: 452px;
  z-index: 2;
  background-size: cover;
  background-position: center 24%;
  filter: saturate(1.04) contrast(1.02);
}
.photo-detail-1 {
  left: 0;
  top: 170px;
  width: 122px;
  height: 150px;
  z-index: 3;
  background-size: 500px 610px;
  background-position: -8px -176px;
}
.photo-detail-2 {
  right: 0;
  top: 190px;
  width: 126px;
  height: 176px;
  z-index: 3;
  background-size: 500px 610px;
  background-position: -368px -178px;
}
.photo-detail-3 {
  left: 160px;
  bottom: 0;
  width: 140px;
  height: 126px;
  z-index: 3;
  background-size: 500px 610px;
  background-position: -162px -430px;
}

.product-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.product-thumb {
  width: 100%;
  height: 86px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid rgba(181, 127, 92, 0.38);
  box-shadow: 0 8px 18px rgba(54, 34, 22, 0.12);
}
.product-name {
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  color: var(--color-charcoal-700);
  letter-spacing: 0.02em;
}

.video-showcase-kicker {
  margin-bottom: 0.9rem;
  font-size: 0.72rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(255, 248, 235, 0.8);
}

.video-showcase-title {
  font-family: "Bodoni Moda", "Playfair Display", serif;
  font-size: clamp(2.55rem, 4.9vw, 5.2rem);
  line-height: 0.94;
  font-style: italic;
  font-weight: 600;
  letter-spacing: 0.16em;
  background: linear-gradient(120deg, #fff4dc 0%, #f1d4aa 28%, #d7aa7d 58%, #c6946c 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 4px 18px rgba(0, 0, 0, 0.16);
}

.video-showcase-copy {
  margin-top: 1rem;
  max-width: 42rem;
  color: rgba(255, 255, 255, 0.88);
  font-size: clamp(0.95rem, 1.4vw, 1.1rem);
  line-height: 1.45;
  text-wrap: balance;
}

.video-feature-card,
.video-stat-card {
  border-radius: 1.45rem;
  padding: 1rem 1rem 1.05rem;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 248, 235, 0.14);
  box-shadow: 0 18px 34px rgba(9, 6, 5, 0.18);
}

.video-feature-card {
  background: rgba(27, 18, 14, 0.34);
}

.video-feature-card-soft {
  background: linear-gradient(180deg, rgba(27, 18, 14, 0.38) 0%, rgba(27, 18, 14, 0.22) 100%);
}

.video-feature-card-accent {
  background: linear-gradient(180deg, rgba(188, 138, 101, 0.18) 0%, rgba(74, 44, 30, 0.28) 100%);
}

.video-feature-kicker {
  margin: 0 0 0.45rem;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: rgba(241, 212, 170, 0.82);
}

.video-feature-title {
  margin: 0;
  font-family: "Bodoni Moda", "Playfair Display", serif;
  font-size: 1.15rem;
  font-weight: 600;
  color: #fff8eb;
  line-height: 1.05;
}

.video-feature-copy {
  margin: 0.55rem 0 0;
  color: rgba(255, 248, 235, 0.76);
  font-size: 0.8rem;
  line-height: 1.45;
}

.video-stat-card {
  background: rgba(255, 248, 235, 0.14);
  text-align: left;
}

.video-stat-value {
  margin: 0;
  font-family: "Bodoni Moda", "Playfair Display", serif;
  font-size: 2.4rem;
  font-weight: 700;
  line-height: 1;
  color: #fff8eb;
}

.video-stat-label {
  margin: 0.45rem 0 0;
  color: rgba(255, 248, 235, 0.74);
  font-size: 0.78rem;
  line-height: 1.45;
}

@media (max-width: 1023px) {
  .capability-showcase {
    min-height: auto;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    border-radius: 1.8rem;
    padding: 1rem;
  }
  .capability-header {
    margin-bottom: 2.1rem;
  }
  .capability-showcase-content {
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 0;
  }
  .capability-showcase-title {
    font-size: clamp(2.1rem, 9vw, 3.5rem);
  }
  .capability-showcase-desc {
    max-width: 100%;
    margin-bottom: 0;
  }
  .capability-actions {
    position: relative;
    left: auto;
    bottom: auto;
    margin-top: 1.25rem;
  }
  .capability-rail {
    width: auto;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .capability-rail-wrap {
    position: relative;
    left: auto;
    right: auto;
    bottom: auto;
    width: auto;
    margin-top: 1rem;
  }
  .capability-rail-nav {
    display: none;
  }
  .capability-mini {
    min-width: 0;
    min-height: 8.9rem;
  }
  .capability-mini-title {
    font-size: 0.96rem;
  }

  .collage-grid {
    width: 340px;
    height: 450px;
    margin-top: 8px;
  }
  .shape-card {
    border-radius: 20px;
  }
  .shape-top-left {
    left: 6px;
    top: 34px;
    width: 88px;
    height: 74px;
  }
  .shape-top-right {
    right: 8px;
    top: 26px;
    width: 92px;
    height: 82px;
  }
  .shape-bottom-right {
    right: 8px;
    bottom: 22px;
    width: 84px;
    height: 72px;
  }
  .photo-card {
    border-radius: 20px;
  }
  .photo-main {
    left: 50px;
    top: 52px;
    width: 240px;
    height: 338px;
    background-position: center 22%;
  }
  .photo-detail-1 {
    left: 0;
    top: 160px;
    width: 88px;
    height: 116px;
    background-size: 340px 450px;
    background-position: -4px -152px;
  }
  .photo-detail-2 {
    right: 0;
    top: 176px;
    width: 92px;
    height: 130px;
    background-size: 340px 450px;
    background-position: -250px -156px;
  }
  .photo-detail-3 {
    left: 122px;
    bottom: 14px;
    width: 98px;
    height: 92px;
    background-size: 340px 450px;
    background-position: -120px -320px;
  }

  .video-showcase-title {
    letter-spacing: 0.1em;
  }

  .video-showcase-copy {
    max-width: 30rem;
    font-size: 0.95rem;
  }

  .solutions-header {
    margin-bottom: 2.2rem;
  }

  .solution-card {
    padding: 1.2rem 1.05rem 1.1rem;
  }

  .solution-title {
    font-size: 1.25rem;
  }

  .solution-description {
    min-height: auto;
    font-size: 0.92rem;
    line-height: 1.6;
  }
}

@media (max-width: 767px) {
  .capability-header {
    margin-bottom: 1.6rem;
  }

  .capability-section-subtitle {
    font-size: 0.92rem;
    line-height: 1.6;
  }

  .capability-showcase {
    min-height: auto;
    border-radius: 1.5rem;
    padding: 0.9rem;
  }

  .capability-showcase-content {
    margin-top: 0.15rem;
  }

  .capability-eyebrow {
    margin-bottom: 0.7rem;
    font-size: 0.66rem;
    letter-spacing: 0.2em;
  }

  .capability-showcase-title {
    font-size: clamp(1.9rem, 10vw, 3rem);
    margin-bottom: 0.8rem;
  }

  .capability-showcase-desc {
    font-size: 0.95rem;
    line-height: 1.55;
  }

  .capability-actions {
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .capability-btn-main {
    min-width: 6.75rem;
    padding: 0.82rem 1.35rem;
  }

  .capability-btn-icon {
    width: 2.8rem;
    height: 2.8rem;
  }

  .capability-rail-wrap {
    margin-top: 0.9rem;
  }

  .capability-rail {
    display: flex;
    gap: 0.75rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
    scroll-snap-type: x proximity;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .capability-rail::-webkit-scrollbar {
    display: none;
  }

  .capability-mini {
    flex: 0 0 min(12rem, 64vw);
    min-height: 10rem;
    scroll-snap-align: start;
  }

  .capability-mini-title {
    font-size: 0.98rem;
  }
}

@media (max-width: 479px) {
  .capability-showcase {
    border-radius: 1.3rem;
    padding: 0.8rem;
  }

  .capability-showcase-title {
    font-size: clamp(1.65rem, 9.6vw, 2.35rem);
    line-height: 0.94;
  }

  .capability-showcase-desc {
    font-size: 0.9rem;
  }

  .capability-actions {
    gap: 0.55rem;
  }

  .capability-btn-main {
    width: 100%;
    justify-content: center;
  }

  .capability-mini {
    flex-basis: 10.5rem;
    min-height: 9.25rem;
  }
}

/* Mobile sidebar transitions */
.menu-overlay-enter-active,
.menu-overlay-leave-active {
  transition: opacity 0.22s ease;
}
.menu-overlay-enter-from,
.menu-overlay-leave-to {
  opacity: 0;
}
.sidebar-menu-enter-active,
.sidebar-menu-leave-active {
  transition: transform 0.28s ease, opacity 0.28s ease;
}
.sidebar-menu-enter-from,
.sidebar-menu-leave-to {
  transform: translateX(100%);
  opacity: 0.9;
}

.cta-title {
  background: linear-gradient(120deg, #4a2c1e 0%, #996341 44%, #c89066 72%, #7b4e35 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 2px 14px rgba(45, 28, 18, 0.18);
}

.cta-social-wrap {
  position: absolute;
  left: clamp(12px, 3vw, 28px);
  bottom: clamp(12px, 2.4vw, 22px);
  z-index: 12;
}

.cta-social {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.3rem;
}

.social-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 1px solid rgba(198, 148, 108, 0.3);
  background: rgba(255, 248, 235, 0.16);
  color: #fff1e3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.social-icon:hover {
  border-color: rgba(241, 212, 170, 0.42);
  background: rgba(255, 248, 235, 0.22);
  transform: translateY(-1px);
}

.cta-social-note {
  font-size: 0.78rem;
  color: rgba(84, 58, 41, 0.78);
}

.cta-quote {
  position: absolute;
  color: rgba(140, 90, 58, 0.35);
  font-family: "Playfair Display", serif;
  font-size: 1.35rem;
  line-height: 1;
  pointer-events: none;
}

.cta-quote-left {
  left: -4px;
  top: -18px;
}

.cta-quote-right {
  right: 8px;
  bottom: 16px;
}

@media (max-width: 768px) {
  .footer-cta-section {
    padding-bottom: 1.4rem;
  }

  .footer-cta-card {
    padding:
      1.35rem
      1rem
      1.25rem;
  }

  .footer-cta-text {
    font-size: 0.94rem;
    line-height: 1.6;
  }

  .footer-cta-side {
    justify-content: flex-start;
  }

  .footer-cta-qr {
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    gap: 0.9rem;
    max-width: none;
    margin-left: 0;
  }

  .footer-cta-qr-frame {
    width: 5.6rem;
    padding: 0.65rem;
    border-radius: 1.2rem;
  }

  .footer-cta-qr-code {
    border-radius: 0.8rem;
    font-size: 1rem;
    letter-spacing: 0.18em;
    background:
      linear-gradient(90deg, rgba(123, 78, 53, 0.1) 50%, transparent 50%) 0 0 / 0.78rem 0.78rem,
      linear-gradient(rgba(123, 78, 53, 0.1) 50%, transparent 50%) 0 0 / 0.78rem 0.78rem,
      linear-gradient(135deg, rgba(255, 248, 235, 0.98) 0%, rgba(242, 222, 196, 0.95) 100%);
  }

  .site-footer-grid {
    grid-template-columns: 1fr;
  }

  .site-footer-bottom {
    flex-direction: column;
    align-items: flex-start;
  }

  .site-footer-bottom-note {
    text-align: left;
  }

  .cta-social-wrap {
    left: 14px;
    bottom: 12px;
  }
  .cta-social-note {
    font-size: 0.72rem;
  }
}

@media (min-width: 960px) {
  .footer-cta-card {
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
    align-items: start;
  }
}

/* Fade-in upward animation */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

</style>
